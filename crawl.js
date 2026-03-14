/**
 * MBG Monitor — Crawl Logic
 *
 * Security hardening:
 *   - Provider + model validated against strict allowlist (prevents SSRF)
 *   - All AI output fields clamped/typed before DB write
 *   - URL field validated (only http/https allowed)
 *   - Input arrays capped (max 50 incidents, 30 news per crawl)
 *   - All DB writes use parameterized queries
 *
 * Performance:
 *   - stats_snapshot + incidents batch + news batch run in parallel
 *   - Page scraping (fallback) runs concurrently with Promise.allSettled
 */

// ── ALLOWLISTS ────────────────────────────────────────────────────────────────
// Strictly validate provider + model to prevent SSRF via env var injection

const ALLOWED_PROVIDERS = new Set(['google', 'openrouter', 'anthropic']);

const ALLOWED_MODELS = {
  google:     new Set(['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-2.5-flash-preview-04-17']),
  openrouter: new Set(['perplexity/sonar:free', 'perplexity/sonar-pro:free', 'google/gemma-3-27b-it:free',
                       'meta-llama/llama-3.3-70b-instruct:free', 'deepseek/deepseek-chat-v3-0324:free',
                       'microsoft/mai-ds-r1:free']),
  anthropic:  new Set(['claude-haiku-4-5-20251001', 'claude-sonnet-4-20250514']),
};

const MODEL_DEFAULTS = {
  google:     'gemini-2.0-flash',
  openrouter: 'perplexity/sonar:free',
  anthropic:  'claude-haiku-4-5-20251001',
};

// Providers whose models include built-in web search
const HAS_SEARCH = {
  google:     _m => true,
  openrouter: m  => m.includes('sonar'),
  anthropic:  _m => true,
};

// ── LIMITS ────────────────────────────────────────────────────────────────────
const MAX_INCIDENTS = 50;
const MAX_NEWS      = 30;
const MAX_STR       = 1000;   // max string field length from AI output
const MAX_URL_LEN   = 512;

// ── PROMPTS ───────────────────────────────────────────────────────────────────

const SYS_SEARCH = `Kamu adalah data journalist Indonesia yang fokus pada program Makan Bergizi Gratis (MBG).
Cari berita terbaru dan kompilasi data insiden.
Balas HANYA dengan JSON murni. Tidak ada teks lain, tidak ada markdown fences.`;

const SYS_PARSE = `Kamu adalah extractor data dari artikel berita Indonesia tentang program Makan Bergizi Gratis.
Balas HANYA dengan JSON murni. Tidak ada teks lain, tidak ada markdown fences.`;

const JSON_SCHEMA = `{
  "stats": {
    "poisoning_incidents": <integer>,
    "total_victims": <integer>,
    "victims_note": "<string max 200 chars>",
    "budget_spent_trillion": <float>,
    "budget_note": "<string max 200 chars>"
  },
  "incidents": [
    {
      "cat": "<keracunan|sppg|kecelakaan|tewas|lainnya>",
      "date": "<YYYY-MM-DD>",
      "title": "<judul singkat max 200 chars>",
      "loc": "<Kota, Provinsi>",
      "lat": <float lintang atau null>,
      "lng": <float bujur atau null>,
      "victims": <integer >= 0>,
      "note": "<ringkasan 1-2 kalimat>",
      "source": "<nama media>"
    }
  ],
  "news": [
    {
      "date": "<YYYY-MM-DD>",
      "headline": "<judul>",
      "summary": "<2-3 kalimat>",
      "source": "<nama media>",
      "url": "<https://... atau string kosong>",
      "tag": "<keracunan|anggaran|umum>"
    }
  ]
}`;

const SEARCH_PROMPT = `Cari dan kompilasi data terbaru (2025) tentang program Makan Bergizi Gratis (MBG) Indonesia.
Fokus: kasus keracunan massal, masalah SPPG, kecelakaan distribusi, korban jiwa, anggaran.
Sertakan koordinat lat/lng kota Indonesia yang tepat untuk setiap insiden.
Minimal 5 berita terbaru. Semua kasus keracunan yang bisa ditemukan.

Kembalikan JSON:
${JSON_SCHEMA}`;

// Scrape fallback targets
const SCRAPE_TARGETS = [
  'https://www.kompas.com/tag/makan-bergizi-gratis',
  'https://www.detik.com/tag/makan-bergizi-gratis',
  'https://tempo.co/tag/makan-bergizi-gratis',
  'https://www.tribunnews.com/tag/makan-bergizi-gratis',
  'https://health.kompas.com/tag/keracunan-makanan',
];

// ── MAIN ──────────────────────────────────────────────────────────────────────

export async function runCrawl(env) {
  const rawProvider = (env.AI_PROVIDER || 'google').toLowerCase().trim();
  const provider    = ALLOWED_PROVIDERS.has(rawProvider) ? rawProvider : 'google';

  const rawModel = (env.AI_MODEL || MODEL_DEFAULTS[provider]).trim();
  const model    = ALLOWED_MODELS[provider]?.has(rawModel) ? rawModel : MODEL_DEFAULTS[provider];

  const key = env.AI_API_KEY;
  if (!key)    throw new Error('AI_API_KEY not set');
  if (!env.DB) throw new Error('D1 binding DB not configured');

  const t0        = Date.now();
  const useSearch = HAS_SEARCH[provider]?.(model) ?? false;

  console.log(`[crawl] ${provider}/${model} search=${useSearch}`);

  let rawText;
  if (useSearch) {
    rawText = await callWithSearch(provider, key, model);
  } else {
    const texts = await scrapePages(SCRAPE_TARGETS);
    if (!texts.length) throw new Error('All scrape targets failed');
    rawText = await callWithParse(provider, key, model, texts);
  }

  const parsed = parseAndSanitize(rawText);
  return writeToDB(env, parsed, provider, model, Date.now() - t0);
}

// ── AI CALLERS ────────────────────────────────────────────────────────────────

async function callWithSearch(provider, key, model) {
  switch (provider) {
    case 'google':    return googleGenerate(key, model, SYS_SEARCH, SEARCH_PROMPT, true);
    case 'openrouter': return openrouterChat(key, model, SYS_SEARCH, SEARCH_PROMPT);
    case 'anthropic': return anthropicMessages(key, model, SYS_SEARCH, SEARCH_PROMPT, true);
  }
}

async function callWithParse(provider, key, model, texts) {
  const combined = texts.map((t, i) => `=== PAGE ${i + 1} ===\n${t}`).join('\n\n');
  const prompt   = `Ekstrak insiden dan berita MBG dari teks berikut:\n\n${combined}\n\nKembalikan JSON:\n${JSON_SCHEMA}`;
  switch (provider) {
    case 'google':    return googleGenerate(key, model, SYS_PARSE, prompt, false);
    case 'openrouter': return openrouterChat(key, model, SYS_PARSE, prompt);
    case 'anthropic': return anthropicMessages(key, model, SYS_PARSE, prompt, false);
  }
}

async function googleGenerate(key, model, sys, usr, useSearch) {
  const body = {
    system_instruction: { parts: [{ text: sys }] },
    contents: [{ role: 'user', parts: [{ text: usr }] }],
    generationConfig: { maxOutputTokens: 4096 },
  };
  if (useSearch) body.tools = [{ google_search: {} }];
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );
  await assertOk(res, 'Google AI');
  const d = await res.json();
  return (d.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
}

async function openrouterChat(key, model, sys, usr) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
      'HTTP-Referer': 'https://mbg-monitor.pages.dev',
      'X-Title': 'MBG Monitor',
    },
    body: JSON.stringify({
      model, max_tokens: 4096,
      messages: [{ role: 'system', content: sys }, { role: 'user', content: usr }],
    }),
  });
  await assertOk(res, 'OpenRouter');
  return (await res.json()).choices?.[0]?.message?.content || '';
}

async function anthropicMessages(key, model, sys, usr, useSearch) {
  const body = {
    model, max_tokens: 4096, system: sys,
    messages: [{ role: 'user', content: usr }],
  };
  if (useSearch) body.tools = [{ type: 'web_search_20250305', name: 'web_search' }];
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  await assertOk(res, 'Anthropic');
  const d = await res.json();
  return d.content.filter(b => b.type === 'text').map(b => b.text).join('');
}

// ── SCRAPING FALLBACK ─────────────────────────────────────────────────────────

async function scrapePages(urls) {
  const results = await Promise.allSettled(urls.map(async url => {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MBGMonitor/1.0)' },
      signal:  AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    return stripHTML(await res.text()).slice(0, 5000);
  }));
  return results
    .filter(r => r.status === 'fulfilled' && r.value && r.value.length > 200)
    .map(r => r.value);
}

function stripHTML(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s{3,}/g, '\n\n').trim();
}

// ── PARSE + SANITIZE ─────────────────────────────────────────────────────────
// Every field from AI output is typed and clamped before touching the DB.

const VALID_CATS = new Set(['keracunan', 'sppg', 'kecelakaan', 'tewas', 'lainnya']);
const VALID_TAGS = new Set(['keracunan', 'anggaran', 'umum']);
const DATE_RE    = /^\d{4}-\d{2}-\d{2}$/;

function safeStr(v, max = MAX_STR) {
  if (typeof v !== 'string') return '';
  return v.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').slice(0, max);
}

function safeInt(v, def = 0) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : def;
}

function safeFloat(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function safeDate(v) {
  if (typeof v !== 'string') return null;
  return DATE_RE.test(v) ? v : null;
}

function safeUrl(v) {
  if (!v || typeof v !== 'string') return '';
  const s = v.trim().slice(0, MAX_URL_LEN);
  // Only allow http/https — blocks javascript:, data:, etc.
  if (!/^https?:\/\//i.test(s)) return '';
  return s;
}

function safeLat(v) {
  const n = safeFloat(v);
  return (n !== null && n >= -90 && n <= 90) ? n : null;
}

function safeLng(v) {
  const n = safeFloat(v);
  return (n !== null && n >= -180 && n <= 180) ? n : null;
}

function parseAndSanitize(raw) {
  let obj;
  try {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    const text   = fenced ? fenced[1].trim() : raw;
    const match  = text.match(/(\{[\s\S]*\})/);
    obj = JSON.parse(match ? match[1] : text);
  } catch {
    throw new Error('AI returned invalid JSON');
  }

  const stats = obj.stats || {};
  const sanitizedStats = {
    poisoning_incidents:    safeInt(stats.poisoning_incidents, null),
    total_victims:          safeInt(stats.total_victims, null),
    victims_note:           safeStr(stats.victims_note, 200),
    budget_spent_trillion:  safeFloat(stats.budget_spent_trillion),
    budget_note:            safeStr(stats.budget_note, 200),
  };

  const incidents = (Array.isArray(obj.incidents) ? obj.incidents : [])
    .slice(0, MAX_INCIDENTS)
    .map(i => ({
      cat:     VALID_CATS.has(i.cat) ? i.cat : 'lainnya',
      date:    safeDate(i.date),
      title:   safeStr(i.title, 200),
      loc:     safeStr(i.loc, 150),
      lat:     safeLat(i.lat),
      lng:     safeLng(i.lng),
      victims: safeInt(i.victims),
      note:    safeStr(i.note, 500),
      source:  safeStr(i.source, 100),
    }))
    .filter(i => i.date && i.title && i.loc);

  const news = (Array.isArray(obj.news) ? obj.news : [])
    .slice(0, MAX_NEWS)
    .map(n => ({
      date:     safeDate(n.date),
      headline: safeStr(n.headline, 300),
      summary:  safeStr(n.summary, 800),
      source:   safeStr(n.source, 100),
      url:      safeUrl(n.url),
      tag:      VALID_TAGS.has(n.tag) ? n.tag : 'umum',
    }))
    .filter(n => n.headline);

  return { stats: sanitizedStats, incidents, news };
}

// ── D1 WRITES ─────────────────────────────────────────────────────────────────

async function writeToDB(env, data, provider, model, duration) {
  const { DB, MBG_KV } = env;

  // 1. Insert crawl_log row
  const crawlRow = await DB.prepare(`
    INSERT INTO crawl_log (provider, model, duration_ms, poisoning_total, victims_total, budget_spent_t, budget_note, raw_ok)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1) RETURNING id
  `).bind(
    provider, model, duration,
    data.stats.poisoning_incidents ?? null,
    data.stats.total_victims       ?? null,
    data.stats.budget_spent_trillion ?? null,
    data.stats.budget_note,
  ).first();

  const crawlId = crawlRow?.id ?? null;

  // 2. Build all insert statements
  const statsStmt = (data.stats && crawlId) ? DB.prepare(`
    INSERT INTO stats_snapshot (crawl_id, poisoning_incidents, total_victims, victims_note, budget_spent_t, budget_note)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    crawlId,
    data.stats.poisoning_incidents ?? null,
    data.stats.total_victims       ?? null,
    data.stats.victims_note,
    data.stats.budget_spent_trillion ?? null,
    data.stats.budget_note,
  ) : null;

  const incStmts = data.incidents.map(i => DB.prepare(`
    INSERT OR IGNORE INTO incidents (ext_id, cat, date, lat, lng, title, loc, victims, note, source, is_baseline)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).bind(
    `${i.date}|${slugify(i.loc)}`,
    i.cat, i.date, i.lat, i.lng,
    i.title, i.loc, i.victims, i.note, i.source,
  ));

  const newsStmts = (crawlId ? data.news : []).map(n => DB.prepare(`
    INSERT INTO news (crawl_id, date, headline, summary, source, url, tag)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(crawlId, n.date, n.headline, n.summary, n.source, n.url, n.tag));

  // 3. Run stats + incidents + news in parallel via batch
  const allStmts  = [...(statsStmt ? [statsStmt] : []), ...incStmts, ...newsStmts];
  const batchRes  = allStmts.length > 0 ? await DB.batch(allStmts) : [];

  const statsOff  = statsStmt ? 1 : 0;
  const incAdded  = batchRes.slice(statsOff, statsOff + incStmts.length)
                             .filter(r => r.meta?.changes > 0).length;
  const newsAdded = batchRes.slice(statsOff + incStmts.length)
                             .filter(r => r.meta?.changes > 0).length;

  // 4. Update crawl log + prune old news in parallel
  await Promise.all([
    crawlId ? DB.prepare(`UPDATE crawl_log SET incidents_added=?, news_added=? WHERE id=?`)
                .bind(incAdded, newsAdded, crawlId).run() : Promise.resolve(),
    DB.prepare(`DELETE FROM news WHERE crawl_id NOT IN (SELECT id FROM crawl_log ORDER BY id DESC LIMIT 5)`)
      .run().catch(() => {}),
    MBG_KV ? MBG_KV.put('mbg:meta', JSON.stringify({
      refreshed_at: new Date().toISOString(),
      provider, model, crawl_id: crawlId,
    })) : Promise.resolve(),
  ]);

  console.log(`[crawl] inc:${incAdded} news:${newsAdded} id:${crawlId} ${duration}ms`);
  return { incidents_added: incAdded, news_added: newsAdded, crawl_id: crawlId };
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

async function assertOk(res, label) {
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(`${label} ${res.status}: ${e?.error?.message || res.statusText}`);
  }
}

function slugify(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
}
