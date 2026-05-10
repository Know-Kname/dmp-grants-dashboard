/**
 * Floating AI chat panel powered by Gemini 2.5 Pro via OpenRouter.
 * Streams responses token-by-token using streamMessage() from lib/gemini.ts.
 * The VITE_OPENROUTER_API_KEY is visible in the browser bundle — see docs/09-security.md.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Sparkles, RotateCcw, Bot } from 'lucide-react';
import { streamMessage, type ChatMessage } from '../lib/gemini';

const DMP_GREEN = '#1a3d2b';
const DMP_GOLD = '#c49a2c';

const STARTERS = [
  'How do I record a burial?',
  'What are Michigan pre-need regulations?',
  'How does perpetual care work?',
  'Tips for managing work orders?',
];

export default function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<boolean>(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return;
    setError(null);
    const userMsg: ChatMessage = { role: 'user', content: text.trim() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setStreaming(true);
    abortRef.current = false;

    // Add empty assistant message to stream into
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      let fullText = '';
      for await (const chunk of streamMessage(nextMessages)) {
        if (abortRef.current) break;
        fullText += chunk;
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: fullText };
          return updated;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setMessages(prev => prev.slice(0, -1)); // remove empty assistant message
    } finally {
      setStreaming(false);
    }
  }, [messages, streaming]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const reset = () => {
    abortRef.current = true;
    setMessages([]);
    setError(null);
    setStreaming(false);
  };

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="fixed bottom-20 lg:bottom-6 right-4 lg:right-6 z-40 w-12 h-12 rounded-full shadow-xl flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
        style={{ backgroundColor: open ? '#6b7280' : DMP_GREEN, color: DMP_GOLD }}
        aria-label="AI Assistant"
      >
        {open ? <X size={20} strokeWidth={2.5} style={{ color: 'white' }} /> : <Sparkles size={20} strokeWidth={2} />}
      </button>

      {/* Panel */}
      {open && (
        <>
          {/* Mobile scrim */}
          <div
            className="lg:hidden fixed inset-0 bg-black/40 z-40"
            onClick={() => setOpen(false)}
          />

          <div
            className="fixed z-50 flex flex-col shadow-2xl border border-border overflow-hidden"
            style={{
              bottom: '5rem',
              right: '1rem',
              width: 'min(380px, calc(100vw - 2rem))',
              height: 'min(560px, calc(100dvh - 7rem))',
              borderRadius: '1.25rem',
              backgroundColor: 'hsl(var(--card))',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 shrink-0"
              style={{ backgroundColor: DMP_GREEN, borderBottom: '1px solid rgba(255,255,255,0.1)' }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: DMP_GOLD }}
                >
                  <Bot size={16} style={{ color: DMP_GREEN }} strokeWidth={2.5} />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold leading-tight">DMP Assistant</p>
                  <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    Powered by Gemini 2.5 Pro
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    onClick={reset}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: 'rgba(255,255,255,0.5)' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    title="New conversation"
                  >
                    <RotateCcw size={14} />
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: 'rgba(255,255,255,0.5)' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-4 text-center px-2">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(26,61,43,0.1)' }}
                  >
                    <Sparkles size={28} style={{ color: DMP_GREEN }} />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">Ask me anything</p>
                    <p className="text-xs text-foreground-muted mt-0.5">
                      Cemetery operations, regulations, CMS help
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 w-full">
                    {STARTERS.map(s => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="text-left text-xs px-3 py-2 rounded-xl border border-border hover:border-primary hover:bg-accent transition-all text-foreground-muted hover:text-foreground"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role === 'assistant' && (
                        <div
                          className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 mr-2"
                          style={{ backgroundColor: DMP_GREEN }}
                        >
                          <Bot size={12} style={{ color: DMP_GOLD }} strokeWidth={2.5} />
                        </div>
                      )}
                      <div
                        className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'text-white rounded-tr-sm'
                            : 'text-foreground border border-border rounded-tl-sm'
                        }`}
                        style={msg.role === 'user' ? { backgroundColor: DMP_GREEN } : { backgroundColor: 'hsl(var(--background-subtle))' }}
                      >
                        {msg.content || (streaming && i === messages.length - 1 ? (
                          <span className="inline-flex gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-foreground-muted animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-foreground-muted animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-foreground-muted animate-bounce" style={{ animationDelay: '300ms' }} />
                          </span>
                        ) : '')}
                      </div>
                    </div>
                  ))}
                  {error && (
                    <div className="text-xs text-danger bg-danger-50 dark:bg-danger-950 border border-danger-200 dark:border-danger-800 rounded-xl px-3 py-2">
                      {error}
                    </div>
                  )}
                  <div ref={bottomRef} />
                </>
              )}
            </div>

            {/* Input */}
            <div className="shrink-0 px-3 pb-3 pt-2 border-t border-border">
              <div className="flex items-end gap-2 bg-background-subtle border border-border rounded-2xl px-3 py-2 focus-within:border-primary transition-colors">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about cemetery operations…"
                  className="flex-1 bg-transparent resize-none text-sm text-foreground placeholder:text-foreground-muted outline-none max-h-24 leading-5"
                  style={{ fieldSizing: 'content' } as React.CSSProperties}
                  disabled={streaming}
                />
                <button
                  onClick={() => send(input)}
                  disabled={!input.trim() || streaming}
                  className="p-1.5 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-110 active:scale-95 shrink-0"
                  style={{ backgroundColor: DMP_GREEN, color: DMP_GOLD }}
                >
                  <Send size={15} strokeWidth={2.5} />
                </button>
              </div>
              <p className="text-[10px] text-foreground-muted text-center mt-1.5">
                Enter to send · Shift+Enter for new line
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}
