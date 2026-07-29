/**
 * AI chat client for the DMP assistant (Gemini 2.5 Pro via OpenRouter).
 *
 * In production the browser calls our own /api/chat Edge Function, which holds
 * the OpenRouter key server-side — the key is never shipped in the client bundle.
 *
 * For local `npm run dev` (where the Edge Function isn't running) we fall back to
 * calling OpenRouter directly, but ONLY when import.meta.env.DEV is true AND a
 * VITE_OPENROUTER_API_KEY is provided. Production builds set DEV=false, so this
 * branch is dead code there and no key is embedded. Use `vercel dev` to exercise
 * the real proxy locally.
 */
import { COMPANY } from '../config/company';

const PROXY_URL = '/api/chat';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'google/gemini-2.5-pro';

/**
 * Location roster for the system prompt, derived from `COMPANY` rather than
 * retyped. The addresses and phone numbers previously appeared here as literals
 * that duplicated `config/company.ts`, kept in step by hand.
 */
const LOCATION_LINES = Object.values(COMPANY.locations)
  .map((location) => `- ${location.name}: ${location.fullAddress} — ${location.phone}`)
  .join('\n');

// Only used by the dev-only direct path. The production system prompt lives
// server-side in api/chat.ts, which cannot import from src/ (it is a Vercel Edge
// Function with its own bundle) — so that copy still spells the details out.
const SYSTEM_PROMPT = `You are an AI assistant embedded in ${COMPANY.shortName}'s internal Cemetery Management System (CMS). ${COMPANY.name} has operated since ${COMPANY.established} and manages three Michigan cemetery locations:
${LOCATION_LINES}

The CMS tracks: burials, work orders, inventory, financial records (deposits, accounts receivable/payable), contracts, customers, and grants.

Help staff with questions about:
- Cemetery operations and best practices
- How to use the CMS features (burials, work orders, inventory, financial, contracts, customers, grants)
- Regulatory compliance (Michigan cemetery laws, FTC funeral rule, pre-need contract regulations)
- Grief support resources to share with families
- Industry standards and terminology (plot locations, perpetual care, pre-need vs at-need)

Keep answers concise, practical, and professional. You are speaking to DMP internal staff.`;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Build the fetch target + request init for either the proxy or the dev-direct path.
// The dev-direct branch is wrapped in `import.meta.env.DEV` so esbuild strips it
// — along with any inlined VITE_OPENROUTER_API_KEY value — from production builds.
function buildRequest(messages: ChatMessage[], stream: boolean): { url: string; init: RequestInit } {
  if (import.meta.env.DEV) {
    const devKey = import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined;
    if (devKey) {
      return {
        url: OPENROUTER_URL,
        init: {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${devKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://dmpgrants.vercel.app',
            'X-Title': 'DMP Cemetery Management System',
          },
          body: JSON.stringify({
            model: MODEL,
            messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
            max_tokens: 1024,
            temperature: 0.7,
            stream,
          }),
        },
      };
    }
  }

  return {
    url: PROXY_URL,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, stream }),
    },
  };
}

export async function sendMessage(messages: ChatMessage[]): Promise<string> {
  const { url, init } = buildRequest(messages, false);
  const res = await fetch(url, init);

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI request failed: ${res.status} — ${err}`);
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices[0]?.message?.content ?? 'No response received.';
}

/** Sentinel distinguishing the terminating `[DONE]` frame from an empty delta. */
const STREAM_DONE = Symbol('stream-done');

/**
 * Extract the text delta carried by a single SSE line.
 *
 * @param raw One complete line from the event stream.
 * @returns The delta text, `STREAM_DONE` for the terminating frame, or `null`
 *          for lines that carry no text (blank separators, comments, keep-alives).
 */
function parseStreamLine(raw: string): string | typeof STREAM_DONE | null {
  const line = raw.trim();
  if (!line.startsWith('data:')) return null;

  const data = line.slice('data:'.length).trim();
  if (data === '[DONE]') return STREAM_DONE;
  if (!data) return null;

  try {
    const parsed = JSON.parse(data) as {
      choices?: Array<{ delta?: { content?: string } }>;
    };
    return parsed.choices?.[0]?.delta?.content ?? null;
  } catch {
    // Chunk-splitting is handled by the caller's buffer, so a frame that still
    // fails to parse is a genuine server-side anomaly. Surface it rather than
    // dropping it silently, which previously made truncated replies invisible.
    console.warn('Discarding malformed AI stream frame', data);
    return null;
  }
}

export async function* streamMessage(messages: ChatMessage[]): AsyncGenerator<string> {
  const { url, init } = buildRequest(messages, true);
  const res = await fetch(url, init);

  if (!res.ok || !res.body) {
    throw new Error(`AI request failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  // SSE frames are not aligned to network chunks: a single `data:` line can be
  // split across two reads, and a multi-byte UTF-8 character can straddle the
  // boundary as well. `{ stream: true }` holds back partial code points and
  // `buffer` holds back partial lines — without both, tokens are silently lost
  // mid-response.
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Everything up to the final newline forms complete lines; whatever
      // follows is a partial line that must wait for the next read.
      const lastNewline = buffer.lastIndexOf('\n');
      if (lastNewline === -1) continue;

      const lines = buffer.slice(0, lastNewline).split('\n');
      buffer = buffer.slice(lastNewline + 1);

      for (const line of lines) {
        const delta = parseStreamLine(line);
        if (delta === STREAM_DONE) return;
        if (delta) yield delta;
      }
    }

    // Flush a trailing frame that arrived without a terminating newline.
    buffer += decoder.decode();
    const delta = parseStreamLine(buffer);
    if (delta && delta !== STREAM_DONE) yield delta;
  } finally {
    // Runs on the `[DONE]` early return and if the consumer abandons the
    // generator, so the connection is never left open.
    await reader.cancel().catch(() => { /* stream already closed */ });
  }
}
