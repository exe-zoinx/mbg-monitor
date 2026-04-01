---
source: Context7 API
library: openai
package: openai
topic: chat-completions-summarization
fetched: 2026-03-19T07:52:00.751Z
official_docs: https://developers.openai.com/api/docs/
---

### Chat Completions API for Text Summarization

The Chat Completions API can be used for text summarization by providing a system prompt that instructs the model to summarize the given text.

#### Basic Usage for Summarization

```json
{
  "model": "gpt-4",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant that summarizes text concisely."},
    {"role": "user", "content": "Summarize the following article: [insert long text here]"}
  ],
  "max_tokens": 150
}
```

#### Parameters
- **model**: Use gpt-4 or gpt-3.5-turbo for better summarization quality.
- **messages**: Include system prompt for summarization task.
- **max_tokens**: Limit output length for concise summaries.
- **temperature**: Set to 0.3-0.5 for consistent, focused summaries.

### Error Handling and Fallbacks

Implement robust error handling:

- **Network errors**: Retry with exponential backoff.
- **Rate limits**: Implement queuing or backoff.
- **Model errors**: Fallback to simpler models (e.g., gpt-3.5-turbo if gpt-4 fails).
- **Content filtering**: Handle cases where content is flagged.

Example in JavaScript:

```javascript
try {
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: "Summarize the following text concisely." },
      { role: "user", content: textToSummarize }
    ],
    max_tokens: 150
  });

  if (response.choices[0].finish_reason === "length") {
    // Handle incomplete summary
    console.warn("Summary truncated due to length");
  }

  if (response.choices[0].finish_reason === "content_filter") {
    // Handle filtered content
    throw new Error("Content filtered");
  }

  const summary = response.choices[0].message.content;
} catch (error) {
  if (error.code === 'rate_limit_exceeded') {
    // Retry after delay
    await delay(1000);
    return summarizeWithFallback(textToSummarize);
  }
  if (error.code === 'model_not_found') {
    // Fallback to gpt-3.5-turbo
    return summarizeWithGPT35(textToSummarize);
  }
  throw error;
}
```

### Security Best Practices

- **API Key Management**: Store keys securely, rotate regularly, use environment variables.
- **Input Validation**: Sanitize user inputs to prevent prompt injection.
- **Output Filtering**: Check summaries for sensitive information leakage.
- **User Identification**: Use the `user` parameter for abuse monitoring.
- **Rate Limiting**: Implement client-side limits to prevent abuse.
- **Audit Logging**: Log API calls for security reviews.

### Best Practices

- Use structured prompts for consistent summaries.
- Monitor token usage to manage costs.
- Implement caching for repeated summaries.
- Test with various text lengths and types.
- Handle edge cases like empty inputs or very long texts.