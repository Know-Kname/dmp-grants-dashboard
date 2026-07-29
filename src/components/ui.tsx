import { useEffect, useId, useRef } from 'react';
import { AlertCircle, type LucideIcon } from 'lucide-react';
import { getErrorDetails, getErrorMessage, getErrorRequestId } from '../lib/errors';

// ============================================
// PAGE ERROR
// ============================================

/**
 * The standard error banner shown at the top of a CRUD page.
 *
 * Accepts the raw error rather than pre-formatted strings so each page no longer
 * has to derive message/details/requestId itself — that three-line preamble plus
 * a seventeen-line banner was copy-pasted verbatim across all seven pages.
 *
 * @param error Any thrown value. Renders nothing when falsy, so callers can pass
 *              a combined query/mutation error directly without guarding.
 */
export function PageError({ error }: { error: unknown }) {
  if (!error) return null;

  const details = getErrorDetails(error);
  const requestId = getErrorRequestId(error);

  return (
    <div className="bg-danger-50 dark:bg-danger-950 border border-danger-200 dark:border-danger-800 rounded-lg p-4 flex items-start gap-3">
      <AlertCircle className="text-danger shrink-0 mt-0.5" size={20} />
      <div>
        <h3 className="font-medium text-danger">Error</h3>
        <p className="text-sm text-danger-700 dark:text-danger-400">{getErrorMessage(error)}</p>
        {(details.length > 0 || requestId) && (
          <ul className="mt-2 text-sm text-danger-700 dark:text-danger-400 list-disc pl-5 space-y-1">
            {details.map((d, i) => <li key={i}>{d}</li>)}
            {requestId && <li>Request ID: {requestId}</li>}
          </ul>
        )}
      </div>
    </div>
  );
}

// ============================================
// STAT CARD
// ============================================

export type StatTone = 'primary' | 'info' | 'success' | 'warning' | 'danger';

/**
 * Tone → class lookup.
 *
 * Spelled out rather than interpolated (`bg-${tone}-100`) because Tailwind scans
 * source text for complete class names; a constructed string is never emitted.
 * The dark chips also depend on the 950 shades, which only became real when
 * tailwind.config.js was extended to declare the full ramp.
 */
const STAT_TONES: Record<StatTone, { value: string; chip: string; icon: string }> = {
  primary: { value: 'text-primary', chip: 'bg-primary-100 dark:bg-primary-950', icon: 'text-primary' },
  info:    { value: 'text-info',    chip: 'bg-info-100 dark:bg-info-950',       icon: 'text-info' },
  success: { value: 'text-success', chip: 'bg-success-100 dark:bg-success-950', icon: 'text-success' },
  warning: { value: 'text-warning', chip: 'bg-warning-100 dark:bg-warning-950', icon: 'text-warning' },
  danger:  { value: 'text-danger',  chip: 'bg-danger-100 dark:bg-danger-950',   icon: 'text-danger' },
};

/**
 * Headline metric tile: label, value, and a tinted icon chip.
 *
 * @param icon A lucide icon component (passed uninstantiated, e.g. `icon={Users}`).
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'primary',
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  tone?: StatTone;
}) {
  const t = STAT_TONES[tone];
  return (
    <Card>
      <CardBody>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-foreground-muted mb-1">{label}</p>
            <p className={`text-2xl font-bold ${t.value}`}>{value}</p>
          </div>
          <div className={`p-3 ${t.chip} rounded-lg`}>
            <Icon className={t.icon} size={24} />
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

// ============================================
// TABLE
// ============================================

/** Shared class for a table `<th>`, previously retyped for every column. */
export const TABLE_HEAD_CLASS =
  'px-6 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider';

// Button Component
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

  const variants = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm hover:shadow-md active:scale-[0.98]',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary-hover',
    success: 'bg-success-600 text-white hover:bg-success-700 shadow-sm active:scale-[0.98]',
    danger: 'bg-destructive text-destructive-foreground hover:bg-destructive-hover shadow-sm active:scale-[0.98]',
    ghost: 'bg-transparent hover:bg-accent text-foreground hover:text-accent-foreground',
    outline: 'border border-border bg-transparent hover:bg-accent text-foreground hover:border-border-hover',
  };

  const sizes = {
    sm: 'h-8 px-3 text-sm gap-1.5',
    md: 'h-10 px-4 text-sm gap-2',
    lg: 'h-12 px-6 text-base gap-2',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}

// Card Component
interface CardProps {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({ children, className = '', hoverable = false, padding = 'none' }: CardProps) {
  const paddingStyles = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div
      className={`
        bg-card text-card-foreground rounded-xl shadow-sm border border-border
        ${hoverable ? 'hover:shadow-lg hover:border-border-hover transition-all duration-200 hover:-translate-y-0.5' : ''}
        ${paddingStyles[padding]}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-6 py-4 border-b border-border ${className}`}>{children}</div>;
}

export function CardBody({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-6 py-4 ${className}`}>{children}</div>;
}

export function CardFooter({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-6 py-4 border-t border-border bg-background-subtle/50 rounded-b-xl ${className}`}>{children}</div>;
}

// Badge Component
interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
}

export function Badge({ children, variant = 'primary', size = 'md', dot = false }: BadgeProps) {
  const variants = {
    primary: 'bg-primary-100 text-primary-700 dark:bg-primary-950 dark:text-primary-400',
    success: 'bg-success-100 text-success-700 dark:bg-success-950 dark:text-success-400',
    warning: 'bg-warning-100 text-warning-700 dark:bg-warning-950 dark:text-warning-400',
    danger: 'bg-danger-100 text-danger-700 dark:bg-danger-950 dark:text-danger-400',
    info: 'bg-info-100 text-info-700 dark:bg-info-950 dark:text-info-400',
    secondary: 'bg-secondary text-secondary-foreground',
    outline: 'bg-transparent border border-border text-foreground',
  };

  const dotColors = {
    primary: 'bg-primary',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
    info: 'bg-info',
    secondary: 'bg-foreground-muted',
    outline: 'bg-foreground-muted',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-0.5 text-sm',
    lg: 'px-3 py-1 text-sm',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 font-medium rounded-full ${variants[variant]} ${sizes[size]}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />}
      {children}
    </span>
  );
}

// Modal Component
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({ isOpen, onClose, title, description, children, footer, size = 'md' }: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`
          relative bg-card text-card-foreground rounded-xl shadow-xl border border-border
          ${sizes[size]} w-full max-h-[90vh] flex flex-col outline-none
          animate-scale-in
        `}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 id={titleId} className="text-xl font-semibold text-foreground">{title}</h2>
            {description && (
              <p className="mt-1 text-sm text-foreground-muted">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 -mr-1 rounded-lg text-foreground-muted hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-border bg-background-subtle/50 rounded-b-xl flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// Input Component
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
}

export function Input({ label, error, hint, icon, className = '', id, ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-foreground mb-1.5">
          {label}
          {props.required && <span className="text-danger ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none">
            {icon}
          </div>
        )}
        <input
          id={inputId}
          className={`
            w-full h-10 px-4 bg-card border border-input rounded-lg
            text-foreground placeholder:text-foreground-muted
            focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent
            transition-all duration-150
            disabled:opacity-50 disabled:cursor-not-allowed
            ${icon ? 'pl-10' : ''} 
            ${error ? 'border-danger focus:ring-danger' : ''} 
            ${className}
          `}
          {...props}
        />
      </div>
      {hint && !error && <p className="mt-1.5 text-sm text-foreground-muted">{hint}</p>}
      {error && <p className="mt-1.5 text-sm text-danger">{error}</p>}
    </div>
  );
}

// Select Component
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export function Select({ label, error, hint, options, placeholder, className = '', id, ...props }: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-foreground mb-1.5">
          {label}
          {props.required && <span className="text-danger ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          className={`
            w-full h-10 px-4 pr-10 bg-card border border-input rounded-lg
            text-foreground appearance-none
            focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent
            transition-all duration-150
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'border-danger focus:ring-danger' : ''} 
            ${className}
          `}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>{placeholder}</option>
          )}
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-foreground-muted">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {hint && !error && <p className="mt-1.5 text-sm text-foreground-muted">{hint}</p>}
      {error && <p className="mt-1.5 text-sm text-danger">{error}</p>}
    </div>
  );
}

// Textarea Component
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Textarea({ label, error, hint, className = '', id, ...props }: TextareaProps) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={textareaId} className="block text-sm font-medium text-foreground mb-1.5">
          {label}
          {props.required && <span className="text-danger ml-1">*</span>}
        </label>
      )}
      <textarea
        id={textareaId}
        className={`
          w-full px-4 py-3 bg-card border border-input rounded-lg
          text-foreground placeholder:text-foreground-muted
          focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent
          transition-all duration-150 resize-none
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error ? 'border-danger focus:ring-danger' : ''} 
          ${className}
        `}
        rows={4}
        {...props}
      />
      {hint && !error && <p className="mt-1.5 text-sm text-foreground-muted">{hint}</p>}
      {error && <p className="mt-1.5 text-sm text-danger">{error}</p>}
    </div>
  );
}

// Empty State Component
interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center select-none">
      {/* Icon container with brand gradient */}
      <div className="relative mb-6">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary-50 via-primary-100 to-primary-50 dark:from-primary-950 dark:via-primary-900 dark:to-primary-950 border border-primary-200/60 dark:border-primary-700/40 flex items-center justify-center shadow-sm">
          <div className="text-primary/50 dark:text-primary/40">
            {icon}
          </div>
        </div>
        {/* Decorative accent dots */}
        <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary-200 dark:bg-primary-800 rounded-full opacity-50" />
        <div className="absolute -bottom-1 -left-2 w-3 h-3 bg-primary-100 dark:bg-primary-900 rounded-full opacity-50" />
      </div>

      <h3 className="text-xl font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-foreground-muted text-sm max-w-[22rem] mx-auto leading-relaxed mb-6">{description}</p>
      {action}
    </div>
  );
}

// Loading Spinner Component
export function LoadingSpinner({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className={`${sizes[size]} border-border border-t-primary rounded-full animate-spin`} />
    </div>
  );
}

// Avatar Component
interface AvatarProps {
  src?: string;
  alt?: string;
  fallback?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function Avatar({ src, alt, fallback, size = 'md', className = '' }: AvatarProps) {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg',
  };

  if (src) {
    return (
      <img
        src={src}
        alt={alt || ''}
        className={`${sizes[size]} rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <div className={`${sizes[size]} rounded-full bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 flex items-center justify-center font-medium ${className}`}>
      {fallback || '?'}
    </div>
  );
}

