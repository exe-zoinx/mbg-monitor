---
source: Context7 API
library: openai
package: openai-node
topic: text summarization integration
fetched: 2026-03-19T07:49:32.186Z
official_docs: https://platform.openai.com/docs/
---

### Client Initialization

Initialize the OpenAI client with your API key from environment variable.

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'], // Uses env var
});
```

### Text Summarization with Chat Completions API

Use chat completions for text summarization by providing a prompt to summarize.

```typescript
const completion = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    { role: 'system', content: 'You are a helpful assistant that summarizes text.' },
    { role: 'user', content: 'Summarize this text: ' + textToSummarize },
  ],
});

console.log(completion.choices[0].message.content);
```

### Error Handling

Handle API errors with typed exceptions.

```typescript
try {
  const completion = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'Summarize: ' + text }],
  });
} catch (err) {
  if (err instanceof OpenAI.APIError) {
    console.log(`Error: ${err.message}`); // Log failure
    // Implement fallback, e.g., return default summary or retry
  }
}
```

For fallback mechanisms, implement retry logic or alternative summarization methods based on error types like RateLimitError or APIConnectionError.

Logging failures can be done by logging err.status, err.code, etc.
</content>
<parameter name="filePath">.tmp/external-context/openai-node/text-summarization-integration.md