/**
 * AI Classification for MBG Articles
 * 
 * Uses Cloudflare Workers AI to classify whether an article describes
 * an actual MBG poisoning incident (keracunan) vs. other news types:
 * - incident: actual poisoning event with victims
 * - recovery: victims recovering (NOT a new incident)
 * - hoax: debunked/false information
 * - policy: SPPG standards, regulations, supervision
 * - general: other MBG news without poisoning
 * 
 * Returns structured JSON for each article.
 */

const CLASSIFICATION_PROMPT = `You are analyzing Indonesian news articles about the MBG (Makan Bergizi Gratis / Free Nutritious Meal) program.

Your task: Classify the article and extract key information.

ARTICLE TITLE: {title}
ARTICLE CONTENT: {content}

Analyze the article and respond with ONLY a JSON object (no markdown, no explanation):

{{
  "is_incident": true/false,
  "category": "incident|recovery|hoax|policy|general",
  "victims": number or 0,
  "location": "city/region name or empty",
  "reasoning": "brief explanation in Indonesian"
}}

RULES:
1. is_incident = true ONLY if the article describes a NEW poisoning event with actual victims who got sick
2. If the article says "sudah sembuh" (recovered) or "pulih" (recovered) → category = "recovery", is_incident = false
3. If the article says "hoaks" (hoax) or "tidak benar" (not true) → category = "hoax", is_incident = false
4. If the article discusses SPPG standards, supervision, regulations → category = "policy", is_incident = false
5. If no specific victim numbers mentioned, victims = 0
6. Only extract victim numbers from the article body, NOT from the title number pattern like "4711 kasus"
7. Focus on the ACTUAL meaning, not just keyword matching`;

const BATCH_PROMPT = `You are analyzing Indonesian news articles about the MBG (Makan Bergizi Gratis) program.

For each article, determine if it describes an ACTUAL new poisoning incident with victims who got sick.

ARTICLES:
{articles}

Respond with ONLY a JSON array (no markdown):
[
  {{"index": 0, "is_incident": true/false, "category": "incident|recovery|hoax|policy|general", "victims": number, "location": "name or empty", "reasoning": "brief Indonesian explanation"}},
  ...
]

RULES:
- is_incident = true ONLY for NEW poisoning events where people actually got sick
- "sudah sembuh" (recovered), "pulih" (recovered) → recovery, NOT incident
- "hoaks", "tidak benar" → hoax, NOT incident
- SPPG standards, supervision, regulations → policy, NOT incident
- If no victim number in body, victims = 0`;

/**
 * Classify a single article using Workers AI
 * @param {object} env - Worker environment with AI binding
 * @param {object} article - { title, summary/content, url }
 * @returns {Promise<object>} - Classification result
 */
export async function classifyArticle(env, article) {
  // If no AI binding, use heuristic immediately
  if (!env.AI) {
    return heuristicClassify(article);
  }

  try {
    const title = (article.title || '').slice(0, 200);
    const content = (article.summary || article.content || '').slice(0, 1500);
    
    const prompt = CLASSIFICATION_PROMPT
      .replace('{title}', title)
      .replace('{content}', content);

    const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      prompt,
      max_tokens: 200,
      temperature: 0.1,
    });

    const result = parseAIResponse(response);
    
    // If AI returned "parse failed", use heuristic instead
    if (result.reasoning === 'parse failed') {
      return heuristicClassify(article);
    }
    
    // If AI says "general" but article contains keracunan/MBG keywords, verify with heuristic
    if (result.category === 'general' && /keracunan|dirawat|dilarikan|korban/.test((article.title || '').toLowerCase())) {
      const heuristic = heuristicClassify(article);
      if (heuristic.is_incident) {
        console.log(`[AI] Override: heuristic says incident for "${article.title?.slice(0, 50)}"`);
        return heuristic;
      }
    }
    
    console.log(`[AI] ${result.category} | ${result.is_incident ? 'INCIDENT' : 'SKIP'} | ${result.victims}v | ${title.slice(0, 50)}`);
    return result;
  } catch (err) {
    console.warn(`[AI] Classification failed: ${err.message}`);
    return heuristicClassify(article);
  }
}

/**
 * Batch classify multiple articles using heuristic (faster and more reliable than AI for this use case)
 * @param {object} env - Worker environment (unused but kept for API compatibility)
 * @param {Array} articles - Array of article objects
 * @returns {Promise<Array>} - Array of classification results
 */
export async function classifyArticlesBatch(env, articles) {
  if (!articles.length) return [];
  return articles.map(a => heuristicClassify(a));
}

/**
 * Parse single article AI response
 */
function parseAIResponse(response) {
  try {
    let text = '';
    
    // Handle various Workers AI response formats
    if (typeof response === 'string') {
      text = response;
    } else if (response?.response) {
      text = typeof response.response === 'string' ? response.response : JSON.stringify(response.response);
    } else if (response?.result) {
      text = typeof response.result === 'string' ? response.result : JSON.stringify(response.result);
    } else if (response?.text) {
      text = response.text;
    } else if (response?.output) {
      text = typeof response.output === 'string' ? response.output : JSON.stringify(response.output);
    } else {
      // Last resort: extract any text from the response
      text = JSON.stringify(response);
    }

    console.log(`[AI] Raw response (first 200 chars): ${text.slice(0, 200)}`);

    // Extract JSON from response (handle markdown code blocks, extra text)
    // Try multiple patterns
    let parsed = null;
    
    // Pattern 1: ```json ... ```
    let jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try { parsed = JSON.parse(jsonMatch[1]); } catch (e) {}
    }
    
    // Pattern 2: { ... }
    if (!parsed) {
      jsonMatch = text.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[0]); } catch (e) {}
      }
    }
    
    // Pattern 3: Direct parse if text looks like JSON
    if (!parsed && text.trim().startsWith('{')) {
      try { parsed = JSON.parse(text.trim()); } catch (e) {}
    }

    if (parsed) {
      return {
        is_incident: Boolean(parsed.is_incident),
        category: parsed.category || 'general',
        victims: parseInt(parsed.victims) || 0,
        location: parsed.location || '',
        reasoning: parsed.reasoning || '',
      };
    }
  } catch (err) {
    console.warn(`[AI] Parse error: ${err.message}`);
  }
  return { is_incident: false, category: 'general', victims: 0, location: '', reasoning: 'parse failed' };
}

/**
 * Parse batch AI response (JSON array)
 */
function parseBatchResponse(response, expectedCount) {
  try {
    let text = '';
    if (typeof response === 'string') text = response;
    else if (response?.response) text = response.response;
    else if (response?.result) text = typeof response.result === 'string' ? response.result : JSON.stringify(response.result);
    else text = JSON.stringify(response);

    // Extract JSON array from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.map(item => ({
        is_incident: Boolean(item.is_incident),
        category: item.category || 'general',
        victims: parseInt(item.victims) || 0,
        location: item.location || '',
        reasoning: item.reasoning || '',
      }));
    }
  } catch (err) {
    console.warn(`[AI] Batch parse error: ${err.message}`);
  }
  // Fallback: return all as general
  return Array(expectedCount).fill({ is_incident: false, category: 'general', victims: 0, location: '', reasoning: 'parse failed' });
}

/**
 * Heuristic classification fallback when AI is unavailable
 * Uses keyword patterns to approximate AI classification
 */
export function heuristicClassify(article) {
  const title = (article.title || '').toLowerCase();
  const content = (article.summary || article.content || '').toLowerCase();
  const text = title + ' ' + content;

  // Check for HOAX indicators
  if (/hoaks|tidak benar|disinformasi|klarifikasi|bantahan/.test(text)) {
    return { is_incident: false, category: 'hoax', victims: 0, location: '', reasoning: 'Kata kunci hoaks terdeteksi' };
  }

  // Check for RECOVERY indicators
  if (/sudah sembuh|telah sembuh|pulih|sembuh total|kondisi membaik|sudah pulih/.test(text)) {
    return { is_incident: false, category: 'recovery', victims: 0, location: '', reasoning: 'Artikel tentang pemulihan, bukan kejadian baru' };
  }

  // Check for POLICY indicators (exclude if no actual victims mentioned)
  if (/standar sppg|regulasi|peraturan|slhs|izin$|monitoring|evaluasi|insentif|sop|protokol|pengawasan operasional|larang|larangan|hentikan.*operasional|setop.*produksi|tutup.*sppg/.test(text) && !/\d+\s*(?:orang|korban|siswa|murid|santri|dirawat)/.test(text)) {
    return { is_incident: false, category: 'policy', victims: 0, location: '', reasoning: 'Artikel tentang kebijakan/regulasi SPPG' };
  }

  // Check for INCIDENT indicators - any article mentioning keracunan + MBG/SPPG
  const hasKeracunan = /keracunan/.test(text);
  const hasMBG = /mbg|sppg|makan bergizi/.test(text);
  const hasExclusion = /hoaks|tidak benar|tidak terkait|bukan.*mbg/.test(text);
  
  if (hasKeracunan && hasMBG && !hasExclusion) {
    // Extract victims from title
    let victims = 0;
    const tMatch = title.match(/([\d]+)\s*(?:santri|siswi|siswa|murid|anak|warga|pelajar|orang|korban)/);
    if (tMatch) victims = parseInt(tMatch[1]) || 0;
    
    // Also check content
    if (victims === 0) {
      const vMatch = content.match(/([\d]+)\s*(?:orang|korban|siswa|murid|santri|warga|pelajar|anak)\s*(?:dirawat|keracunan|mengalami|dilarikan|terdampak)/);
      if (vMatch) victims = parseInt(vMatch[1]) || 0;
    }
    
    return { is_incident: true, category: 'incident', victims, location: extractLocationFromText(text), reasoning: 'Keracunan MBG terdeteksi' };
  }

  return { is_incident: false, category: 'general', victims: 0, location: '', reasoning: 'Berita umum tentang MBG' };
}

function extractLocationFromText(text) {
  const locationPatterns = [
    /(?:di|kota|kabupaten|kecamatan)\s+([A-Z][a-zA-Z\s]+?)(?:\s|,|\.|$)/,
    /(?:di\s+)(\w+(?:\s\w+)?)(?:\s+keracunan|\s+,\s+\w)/i,
  ];
  for (const p of locationPatterns) {
    const m = text.match(p);
    if (m && m[1].length > 2 && m[1].length < 30) return m[1].trim();
  }
  return '';
}
