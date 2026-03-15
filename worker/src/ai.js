/**
 * Google Gemini AI integration for article summarization
 * Uses structured JSON output for reliable parsing
 */

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

export async function summarizeWithAI(article, apiKey) {
  const prompt = `You are a news analyst for an Indonesian MBG (Makan Bergizi Gratis / Free Nutritious Meals) incident tracking system.

Analyze this news article and provide a structured summary.

Title: ${article.title}
Source: ${article.source}
URL: ${article.url}
Content: ${article.summary || 'No content available'}

Respond with a JSON object containing:
- "summary": A concise 1-2 sentence summary in Indonesian, focusing on the MBG-related incident details
- "tag": One of: "keracunan" (food poisoning), "sppg" (kitchen/facility issues), "kecelakaan" (accidents), "tewas" (deaths), "mbg" (general MBG news), "lainnya" (other)
- "severity": "high", "medium", or "low" based on number of victims and impact
- "victims": Estimated number of victims mentioned (0 if none)
- "location": Location mentioned in the article (Indonesian city/regency)`;

  try {
    const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 512,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              summary: { type: 'string' },
              tag: { type: 'string', enum: ['keracunan', 'sppg', 'kecelakaan', 'tewas', 'mbg', 'lainnya'] },
              severity: { type: 'string', enum: ['high', 'medium', 'low'] },
              victims: { type: 'integer' },
              location: { type: 'string' },
            },
            required: ['summary', 'tag'],
          },
        },
      }),
    });

    if (!res.ok) {
      console.warn(`[AI] Gemini API returned ${res.status}`);
      return null;
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) return null;

    // Response is already JSON due to structured output
    return JSON.parse(text);
  } catch (err) {
    console.warn('[AI] Gemini error:', err.message);
    return null;
  }
}
