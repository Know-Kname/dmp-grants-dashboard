/**
 * AI chat client via OpenRouter → Gemini 2.5 Pro (google/gemini-2.5-pro).
 * Streams responses using the OpenAI-compatible chat completions endpoint.
 * VITE_OPENROUTER_API_KEY is visible in the browser bundle — see docs/09-security.md
 * for the Vercel Edge Function proxy pattern to move the key server-side.
 */
const OPENROUTER_KEY = import.meta.env.VITE_OPENROUTER_API_KEY as string;
const MODEL = 'google/gemini-2.5-pro';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SYSTEM_PROMPT = `You are an AI assistant embedded in RIP Cemetery Management, a professional platform for independent cemetery operators.

The system tracks: burials, work orders, inventory, financial records (deposits, accounts receivable/payable), contracts, customers, and grants.

Help staff with questions about:
- Cemetery operations and best practices
- How to use the CMS features (burials, work orders, inventory, financial, contracts, customers, grants)
- Regulatory compliance (cemetery laws, FTC funeral rule, pre-need contract regulations)
- Grief support resources to share with families
- Industry standards and terminology (plot locations, perpetual care, pre-need vs at-need, interment rights)

Keep answers concise, practical, and professional. You are speaking to cemetery staff.`;

export async function sendMessage(messages: ChatMessage[]): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://rip-cms.vercel.app',
      'X-Title': 'RIP Cemetery Management',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages,
      ],
      max_tokens: 1024,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI request failed: ${res.status} — ${err}`);
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices[0]?.message?.content ?? 'No response received.';
}

export async function* streamMessage(messages: ChatMessage[]): AsyncGenerator<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://rip-cms.vercel.app',
      'X-Title': 'RIP Cemetery Management',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages,
      ],
      max_tokens: 1024,
      temperature: 0.7,
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`AI request failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
    for (const line of lines) {
      const data = line.slice(6);
      if (data === '[DONE]') return;
      try {
        const parsed = JSON.parse(data) as {
          choices: Array<{ delta: { content?: string } }>;
        };
        const text = parsed.choices[0]?.delta?.content;
        if (text) yield text;
      } catch {
        // skip malformed chunks
      }
    }
  }
}
