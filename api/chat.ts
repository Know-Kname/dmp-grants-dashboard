/**
 * Vercel Edge Function: server-side proxy for the OpenRouter (Gemini 2.5 Pro) chat API.
 *
 * The browser calls POST /api/chat with { messages, stream } and this function
 * attaches the secret OPENROUTER_API_KEY (server-only, NOT prefixed with VITE_,
 * so it is never shipped in the client bundle) and forwards the request to
 * OpenRouter. The upstream response body is streamed straight back to the client.
 *
 * Set OPENROUTER_API_KEY in the Vercel project environment variables.
 */
export const config = { runtime: 'edge' };

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'google/gemini-2.5-pro';

// Keep this in sync with the dev-only fallback prompt in src/lib/gemini.ts.
const SYSTEM_PROMPT = `You are an AI assistant embedded in Detroit Memorial Park's internal Cemetery Management System (CMS). Detroit Memorial Park Association has operated since 1925 and manages three Michigan cemetery locations:
- DMP East: 4280 E. Thirteen Mile Rd, Warren, MI 48092 — (586) 751-1313
- DMP West: 25062 Plymouth Road, Redford, MI 48239 — (313) 533-1302
- Gracelawn Cemetery: 5710 N. Saginaw Street, Flint, MI 48505 — (810) 785-7890

The CMS tracks: burials, work orders, inventory, financial records (deposits, accounts receivable/payable), contracts, customers, and grants.

Help staff with questions about:
- Cemetery operations and best practices
- How to use the CMS features (burials, work orders, inventory, financial, contracts, customers, grants)
- Regulatory compliance (Michigan cemetery laws, FTC funeral rule, pre-need contract regulations)
- Grief support resources to share with families
- Industry standards and terminology (plot locations, perpetual care, pre-need vs at-need)

Keep answers concise, practical, and professional. You are speaking to DMP internal staff.`;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return json({ error: 'AI assistant is not configured. Set OPENROUTER_API_KEY.' }, 503);
  }

  let payload: { messages?: ChatMessage[]; stream?: boolean };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  if (messages.length === 0) {
    return json({ error: 'No messages provided' }, 400);
  }
  // Basic abuse guard: this endpoint has no auth check (any caller who can reach
  // the deployed URL can invoke it — see docs/09-security.md), so it at least
  // rejects requests shaped to run up the OpenRouter bill or wedge the upstream
  // call with malformed content, rather than forwarding anything it's handed.
  const MAX_MESSAGES = 50;
  const MAX_MESSAGE_LENGTH = 8000;
  if (messages.length > MAX_MESSAGES) {
    return json({ error: `Too many messages (max ${MAX_MESSAGES})` }, 400);
  }
  const invalid = messages.some(
    (m) => typeof m?.content !== 'string' || m.content.length > MAX_MESSAGE_LENGTH
  );
  if (invalid) {
    return json({ error: `Each message needs string content up to ${MAX_MESSAGE_LENGTH} characters` }, 400);
  }
  const stream = payload.stream !== false;

  const upstream = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
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
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '');
    return json({ error: `AI request failed: ${upstream.status}`, detail }, upstream.status || 502);
  }

  // Pass the (possibly streaming) body straight through to the client.
  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': stream
        ? 'text/event-stream; charset=utf-8'
        : 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}
