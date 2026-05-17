import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

type Variant = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  message: string;
  title?: string;
  variant: Variant;
}

interface ToastContextType {
  success: (message: string, title?: string) => void;
  error:   (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info:    (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const DURATION = 4000;

const STYLE: Record<Variant, { bar: string; icon: string; iconBg: string; symbol: string }> = {
  success: { bar: 'border-l-success',  icon: 'text-success',  iconBg: 'bg-success-100 dark:bg-success-950',  symbol: '✓' },
  error:   { bar: 'border-l-danger',   icon: 'text-danger',   iconBg: 'bg-danger-100 dark:bg-danger-950',    symbol: '✕' },
  warning: { bar: 'border-l-warning',  icon: 'text-warning',  iconBg: 'bg-warning-100 dark:bg-warning-950',  symbol: '!' },
  info:    { bar: 'border-l-info',     icon: 'text-info',     iconBg: 'bg-info-100 dark:bg-info-950',        symbol: 'i' },
};

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const s = STYLE[item.variant];

  useEffect(() => {
    const t = setTimeout(onDismiss, DURATION);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      className={`
        flex items-start gap-3 bg-card border border-border border-l-4 ${s.bar}
        rounded-xl shadow-lg px-4 py-3 w-full max-w-sm
        animate-slide-up pointer-events-auto
      `}
    >
      <div className={`w-7 h-7 rounded-lg ${s.iconBg} ${s.icon} flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5`}>
        {s.symbol}
      </div>
      <div className="flex-1 min-w-0">
        {item.title && (
          <p className="text-sm font-semibold text-foreground leading-tight">{item.title}</p>
        )}
        <p className={`text-sm text-foreground-muted ${item.title ? 'mt-0.5' : ''}`}>{item.message}</p>
      </div>
      <button
        onClick={onDismiss}
        className="text-foreground-muted hover:text-foreground transition-colors flex-shrink-0 mt-0.5"
        aria-label="Dismiss"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const add = useCallback((message: string, variant: Variant, title?: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts(prev => [...prev.slice(-2), { id, message, variant, title }]);
  }, []);

  const value: ToastContextType = {
    success: (msg, title) => add(msg, 'success', title),
    error:   (msg, title) => add(msg, 'error',   title),
    warning: (msg, title) => add(msg, 'warning', title),
    info:    (msg, title) => add(msg, 'info',    title),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-20 lg:bottom-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
        {toasts.map(item => (
          <Toast key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
