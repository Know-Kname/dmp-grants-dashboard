import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { m, AnimatePresence, EASE_LUX } from './motion';

type Variant = 'success' | 'error' | 'warning' | 'info';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastOptions {
  /** Optional action button (e.g. Undo). Extends the toast's lifetime. */
  action?: ToastAction;
}

interface ToastItem {
  id: string;
  message: string;
  title?: string;
  variant: Variant;
  action?: ToastAction;
}

interface ToastContextType {
  success: (message: string, title?: string, options?: ToastOptions) => void;
  error:   (message: string, title?: string, options?: ToastOptions) => void;
  warning: (message: string, title?: string, options?: ToastOptions) => void;
  info:    (message: string, title?: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const DURATION = 4000;
const DURATION_WITH_ACTION = 7000; // give the user time to hit Undo

const STYLE: Record<Variant, { bar: string; icon: string; iconBg: string; symbol: string }> = {
  success: { bar: 'border-l-success',  icon: 'text-success',  iconBg: 'bg-success-100 dark:bg-success-950',  symbol: '✓' },
  error:   { bar: 'border-l-danger',   icon: 'text-danger',   iconBg: 'bg-danger-100 dark:bg-danger-950',    symbol: '✕' },
  warning: { bar: 'border-l-warning',  icon: 'text-warning',  iconBg: 'bg-warning-100 dark:bg-warning-950',  symbol: '!' },
  info:    { bar: 'border-l-info',     icon: 'text-info',     iconBg: 'bg-info-100 dark:bg-info-950',        symbol: 'i' },
};

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const s = STYLE[item.variant];

  useEffect(() => {
    const t = setTimeout(onDismiss, item.action ? DURATION_WITH_ACTION : DURATION);
    return () => clearTimeout(t);
  }, [onDismiss, item.action]);

  return (
    <m.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, transition: { duration: 0.18, ease: 'easeIn' } }}
      transition={{ duration: 0.35, ease: EASE_LUX }}
      className={`
        flex items-start gap-3 bg-card border border-border border-l-4 ${s.bar}
        rounded-xl shadow-lg px-4 py-3 w-full max-w-sm
        pointer-events-auto
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
        {item.action && (
          <button
            onClick={() => {
              item.action?.onClick();
              onDismiss();
            }}
            className="mt-1.5 min-h-0 text-sm font-semibold text-primary hover:text-primary-hover transition-colors"
          >
            {item.action.label}
          </button>
        )}
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
    </m.div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const add = useCallback((message: string, variant: Variant, title?: string, options?: ToastOptions) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts(prev => [...prev.slice(-2), { id, message, variant, title, action: options?.action }]);
  }, []);

  const value: ToastContextType = {
    success: (msg, title, opts) => add(msg, 'success', title, opts),
    error:   (msg, title, opts) => add(msg, 'error',   title, opts),
    warning: (msg, title, opts) => add(msg, 'warning', title, opts),
    info:    (msg, title, opts) => add(msg, 'info',    title, opts),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toaster — above mobile nav on small screens, bottom-right on desktop */}
      <div className="fixed bottom-20 lg:bottom-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map(item => (
            <Toast key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
