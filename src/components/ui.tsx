import { useEffect, useId, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';
import { getErrorDetails, getErrorMessage, getErrorRequestId } from '../lib/errors';
import { BRAND } from '../config/brand';
import {
  m, AnimatePresence, scalePop, useCountUp, useReducedMotion,
  useMagnetic, useTilt, useMotionTemplate, SPRING, EASE_LUX,
} from '../lib/motion';

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
// CONFIG ERROR
// ============================================

/**
 * Full-page failure for a misconfigured deployment, rendered by main.tsx in
 * place of the app. Previously a missing Supabase env var only produced a
 * console warning and a client pointed at an `.invalid` host, so every query
 * failed with a network error that was indistinguishable from an outage.
 */
export function ConfigError({ issues }: { issues: { key: string; message: string }[] }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-background">
      <div className="max-w-lg w-full">
        <div className="flex items-start gap-3 mb-6">
          <div className="p-2.5 rounded-lg bg-danger-100 dark:bg-danger-950 text-danger shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Configuration required</h1>
            <p className="text-sm text-foreground-muted mt-1">
              The app can’t start because required environment variables are missing or invalid.
            </p>
          </div>
        </div>

        <ul className="space-y-2 mb-6">
          {issues.map((issue) => (
            <li
              key={issue.key}
              className="text-sm bg-card border border-border rounded-lg px-4 py-3"
            >
              <code className="font-mono text-danger">{issue.key}</code>{' '}
              <span className="text-foreground-muted">{issue.message}</span>
            </li>
          ))}
        </ul>

        <p className="text-sm text-foreground-muted">
          Set these in the Vercel project settings (or <code className="font-mono">.env.local</code>{' '}
          for local development), then redeploy. See <code className="font-mono">docs/08-environment.md</code>.
        </p>
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
 * Animated count-up number. Renders the in-flight value through `format`
 * (defaults to a rounded locale string); jumps instantly under
 * prefers-reduced-motion. Use inside StatCard values:
 * `value={<AnimatedNumber to={total} format={formatCurrency} />}`.
 */
export function AnimatedNumber({ to, format }: { to: number; format?: (n: number) => string }) {
  const v = useCountUp(to);
  return <>{format ? format(v) : Math.round(v).toLocaleString()}</>;
}

/**
 * Tiny inline SVG sparkline — deliberately not Recharts, to stay chunk-light.
 *
 * Draws itself on mount via stroke-dashoffset, fills a soft gradient under the
 * line, and marks the latest point. The draw-on is what makes a stat tile feel
 * live rather than printed; it runs once, not on a loop.
 */
function Sparkline({ data, className = '' }: { data: number[]; className?: string }) {
  const gradientId = useId();
  const reduced = useReducedMotion();
  if (data.length < 2) return null;

  const w = 88, h = 28, pad = 2;
  const min = Math.min(...data);
  const range = (Math.max(...data) - min) || 1;
  const pts = data.map((v, i) => {
    const x = pad + (i * (w - pad * 2)) / (data.length - 1);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return [x, y] as const;
  });
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${pad},${h} ${line} ${w - pad},${h}`;
  const last = pts[pts.length - 1];

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={className} aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gradientId})`} />
      <m.polyline
        points={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.85}
        initial={reduced ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.1, ease: EASE_LUX }}
      />
      <m.circle
        cx={last[0]}
        cy={last[1]}
        r="2"
        fill="currentColor"
        initial={reduced ? false : { scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: reduced ? 0 : 1, duration: 0.3, ease: EASE_LUX }}
      />
    </svg>
  );
}

/**
 * Headline metric tile: label, value, and a tinted icon chip.
 *
 * @param icon A lucide icon component (passed uninstantiated, e.g. `icon={Users}`).
 * @param hint Optional secondary line under the value (subtitle, badge row…).
 * @param trend Optional delta vs a prior period; sign drives color and arrow.
 * @param sparkline Optional series drawn as a small inline line, tinted by tone.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'primary',
  hint,
  trend,
  sparkline,
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  tone?: StatTone;
  hint?: React.ReactNode;
  trend?: { delta: number; label?: string };
  sparkline?: number[];
}) {
  const t = STAT_TONES[tone];
  const trendUp = trend && trend.delta >= 0;
  return (
    <Card tilt>
      <CardBody className="relative overflow-hidden rounded-xl">
        {/* Tonal wash bleeding from the icon corner — gives the tile a light
            source, so the icon chip reads as the brightest thing on it. */}
        <span
          aria-hidden
          className={`pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full blur-2xl opacity-[0.13] ${t.chip}`}
        />
        <div className="relative flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-foreground-muted mb-1">{label}</p>
            <p className={`text-2xl font-bold tabular-nums tracking-tight ${t.value}`}>{value}</p>
            {trend && (
              <p
                className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${
                  trendUp ? 'text-success-600 dark:text-success-400' : 'text-danger-600 dark:text-danger-400'
                }`}
              >
                {trendUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {trendUp ? '+' : ''}{trend.delta.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                {trend.label && <span className="text-foreground-subtle font-normal">{trend.label}</span>}
              </p>
            )}
            {hint && <div className="mt-1 text-xs text-foreground-muted">{hint}</div>}
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            {/* Lifted onto its own Z plane so it parallaxes against the label
                as the card tilts. That separation is the whole trick. */}
            <div
              className={`p-3 ${t.chip} rounded-xl ring-1 ring-inset ring-white/10 shadow-sm transition-transform duration-300 ease-out group-hover:scale-105`}
              style={{ transform: 'translateZ(34px)' }}
            >
              <Icon className={t.icon} size={24} />
            </div>
            {sparkline && <Sparkline data={sparkline} className={t.icon} />}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

// ============================================
// PAGE HEADER
// ============================================

/**
 * The masthead every list page opens with.
 *
 * Extracted because all nine CRUD pages carried the same four lines of markup,
 * and because that duplication is what let them drift: same heading, same
 * subtitle position, same action cluster, retyped nine times.
 *
 * The title is set in Fraunces — the display face the login and memorial pages
 * already use. It was being downloaded on every page load and then never used
 * once you were signed in, so the app interior read like a different product
 * from its own front door. A gold rule ties it to the brand without adding a
 * third definition of the colour (see `config/brand`).
 *
 * @param actions Right-aligned controls. Wraps beneath the title on narrow
 *                viewports rather than crushing the heading.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  return (
    <m.div
      className="flex flex-wrap items-end justify-between gap-4"
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE_LUX }}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="h-7 w-[3px] shrink-0 rounded-full"
            style={{ backgroundColor: BRAND.gold }}
          />
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
        </div>
        {subtitle && <p className="mt-1.5 pl-[15px] text-foreground-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </m.div>
  );
}

// ============================================
// TABLE
// ============================================

/** Shared class for a table `<th>`, previously retyped for every column. */
export const TABLE_HEAD_CLASS =
  'px-6 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider';

// Button Component
//
// The native animation and drag handlers are omitted because Framer redefines
// them with different signatures (`onAnimationStart` takes an animation
// definition, not a DOM event). Keeping both would make the prop type
// unsatisfiable. Nothing in the app passes them to a Button, and anything
// needing them wants a plain <button> rather than this one.
type ConflictingDomHandlers =
  | 'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration'
  | 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onDragEnter'
  | 'onDragExit' | 'onDragLeave' | 'onDragOver' | 'onDrop';

interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, ConflictingDomHandlers> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  loading?: boolean;
}

/**
 * The primary interactive control, with four layers of feedback stacked on it.
 *
 * In order of subtlety: a magnetic lean toward the cursor, a specular sheen
 * that sweeps across on hover, a ripple seeded at the actual click point, and a
 * spring press. None of them is individually noticeable — together they are the
 * difference between a rectangle that changes colour and something that feels
 * like it has a surface.
 *
 * Every layer is decorative and every layer collapses under
 * prefers-reduced-motion, so the button is still a button: same hit area, same
 * focus ring, same disabled semantics.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  children,
  className = '',
  disabled,
  onPointerDown,
  ...props
}: ButtonProps) {
  const reduced = useReducedMotion();
  const magnetic = useMagnetic(variant === 'ghost' || variant === 'outline' ? 3 : 5);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);

  const baseStyles =
    'group/btn relative isolate inline-flex items-center justify-center overflow-hidden font-medium rounded-lg ' +
    'transition-[background-color,border-color,color,box-shadow] duration-200 ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ' +
    'disabled:pointer-events-none disabled:opacity-50';

  // Solid variants carry the sheen and a lifted shadow; quiet variants get a
  // tint only — a sheen on a ghost button is noise with nothing to reflect off.
  const variants = {
    primary:
      'bg-primary text-primary-foreground hover:bg-primary-hover shadow-[0_1px_2px_rgb(0_0_0/0.14),0_0_0_1px_rgb(255_255_255/0.06)_inset] hover:shadow-[0_6px_20px_-6px_hsl(var(--primary)/0.55),0_0_0_1px_rgb(255_255_255/0.10)_inset]',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary-hover',
    success:
      'bg-success-600 text-white hover:bg-success-700 shadow-[0_1px_2px_rgb(0_0_0/0.14)] hover:shadow-[0_6px_20px_-6px_hsl(var(--success-600)/0.5)]',
    danger:
      'bg-destructive text-destructive-foreground hover:bg-destructive-hover shadow-[0_1px_2px_rgb(0_0_0/0.14)] hover:shadow-[0_6px_20px_-6px_hsl(var(--destructive)/0.5)]',
    ghost: 'bg-transparent hover:bg-accent text-foreground hover:text-accent-foreground',
    outline:
      'border border-border bg-transparent hover:bg-accent text-foreground hover:border-border-hover',
  };

  const hasSheen = variant === 'primary' || variant === 'success' || variant === 'danger';

  const sizes = {
    sm: 'h-8 px-3 text-sm gap-1.5',
    md: 'h-10 px-4 text-sm gap-2',
    lg: 'h-12 px-6 text-base gap-2',
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!reduced) {
      const r = e.currentTarget.getBoundingClientRect();
      const id = Date.now() + Math.random();
      setRipples((prev) => [...prev, { id, x: e.clientX - r.left, y: e.clientY - r.top }]);
      // Self-cleaning: the ripple removes itself rather than accumulating nodes
      // over a long session on a page someone leaves open all day.
      window.setTimeout(() => setRipples((prev) => prev.filter((p) => p.id !== id)), 620);
    }
    onPointerDown?.(e);
  };

  return (
    <m.button
      ref={magnetic.ref}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      style={{ x: magnetic.x, y: magnetic.y }}
      whileTap={reduced ? undefined : { scale: 0.97 }}
      transition={SPRING.press}
      onPointerDown={handlePointerDown}
      {...magnetic.handlers}
      {...props}
    >
      {/* Specular sweep. -z-10 keeps it under the label; the group-hover
          translate is what moves it, so it costs nothing when idle. */}
      {hasSheen && !reduced && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-full -z-10 w-1/2 -skew-x-12
                     bg-gradient-to-r from-transparent via-white/25 to-transparent
                     transition-transform duration-700 ease-out
                     group-hover/btn:translate-x-[400%]"
        />
      )}

      {/* Ripple, seeded where the pointer actually landed. */}
      <AnimatePresence>
        {ripples.map((r) => (
          <m.span
            key={r.id}
            aria-hidden
            className="pointer-events-none absolute -z-10 rounded-full bg-current"
            initial={{ opacity: 0.28, width: 0, height: 0, x: '-50%', y: '-50%' }}
            animate={{ opacity: 0, width: 320, height: 320, x: '-50%', y: '-50%' }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: EASE_LUX }}
            style={{ left: r.x, top: r.y }}
          />
        ))}
      </AnimatePresence>

      {loading ? (
        <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : icon ? (
        // Icons lead the label out by a hair on hover — a small cue that the
        // control is directional.
        <span className="shrink-0 transition-transform duration-300 ease-out group-hover/btn:-translate-y-px">
          {icon}
        </span>
      ) : null}
      {children}
    </m.button>
  );
}

// Card Component
interface CardProps {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /**
   * Lean the card in 3D toward the pointer. Reserve it for short, glanceable
   * tiles — on a card holding a table or a paragraph the motion competes with
   * reading, and the effect stops being free.
   */
  tilt?: boolean;
}

export function Card({
  children,
  className = '',
  hoverable = false,
  padding = 'none',
  tilt = false,
}: CardProps) {
  const paddingStyles = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  const surface =
    'relative bg-card text-card-foreground rounded-xl border border-border ' +
    // Layered shadow rather than one blur: a tight contact shadow plus a wide
    // ambient one is what reads as "sitting on" a surface instead of "drawn
    // over" it.
    'shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_24px_-12px_rgb(0_0_0/0.10)]';

  if (!tilt) {
    return (
      <div
        className={`
          ${surface}
          ${hoverable
            ? 'transition-[transform,box-shadow,border-color] duration-300 ease-out hover:-translate-y-0.5 hover:border-border-hover hover:shadow-[0_1px_2px_rgb(0_0_0/0.05),0_18px_40px_-18px_rgb(0_0_0/0.22)]'
            : ''}
          ${paddingStyles[padding]}
          ${className}
        `}
      >
        {children}
      </div>
    );
  }

  return <TiltCard className={`${surface} ${paddingStyles[padding]} ${className}`}>{children}</TiltCard>;
}

/**
 * A card that leans toward the pointer, with a glare that tracks it.
 *
 * Split out rather than branching inside `Card` because it has to call hooks
 * unconditionally. The rotation is deliberately small (6°) — enough to catch
 * the light, not enough to make text swim while someone is reading a figure
 * off it.
 *
 * `perspective` is set on the wrapper, not the card. See `useTilt`.
 */
function TiltCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const { ref, rotateX, rotateY, pointerX, pointerY, handlers } = useTilt({ max: 6 });
  const reduced = useReducedMotion();

  const glare = useMotionTemplate`radial-gradient(600px circle at ${pointerX}% ${pointerY}%, hsl(var(--primary) / 0.10), transparent 42%)`;

  return (
    // The wrapper carries `h-full` so a card in a stretched grid row still
    // fills it — the extra element would otherwise break the height chain.
    <div className="h-full" style={{ perspective: 1200 }}>
      <m.div
        ref={ref}
        {...handlers}
        className={`group h-full ${className} transform-gpu will-change-transform`}
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        whileHover={reduced ? undefined : { y: -3 }}
        transition={SPRING.glide}
      >
        {/* Glare rides above the surface but below the content. */}
        {!reduced && (
          <m.span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300"
            style={{ backgroundImage: glare }}
            whileHover={{ opacity: 1 }}
          />
        )}
        <div className="relative h-full" style={{ transform: 'translateZ(28px)' }}>
          {children}
        </div>
      </m.div>
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

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Wrapper so the panel gets a real exit animation: AnimatePresence needs the
 * child to unmount, which the old `if (!isOpen) return null` made instant.
 */
export function Modal(props: ModalProps) {
  return (
    <AnimatePresence>
      {props.isOpen && <ModalPanel key="modal" {...props} />}
    </AnimatePresence>
  );
}

function ModalPanel({ onClose, title, description, children, footer, size = 'md' }: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  /**
   * `onClose` reaches the effect below through a ref, never through its deps.
   *
   * Not a micro-optimisation — the effect's cleanup calls `previous?.focus()`,
   * so anything that re-runs it yanks focus out of whatever the user is typing
   * into. Every call site passes `onClose` as an inline arrow (there is not one
   * `useCallback` anywhere under `src/pages/`), so its identity changes on every
   * parent render, and a controlled input re-renders its parent on every
   * keystroke. Keyed on `[onClose]`, that chain cost the user every character
   * after the first, in every modal in the app.
   *
   * Re-pointing the ref on each render is what keeps this honest: the handler
   * invoked on Escape is always the current one, so nothing observes a closure
   * over stale state.
   */
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    // Scroll lock while open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
      if (e.key === 'Tab') {
        // Focus trap: cycle within the dialog
        const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (!focusables || focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === dialogRef.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      previous?.focus();
    };
    // Empty deps, deliberately. `Modal` renders this panel only while open (the
    // `isOpen && <ModalPanel/>` guard above), so mount *is* open and unmount
    // *is* close — the effect's whole lifecycle already matches the modal's.
    // Restoring focus to the opener on the way out is the desired behaviour;
    // running that cleanup mid-edit was the fault.
  }, []);

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <m.div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />

      {/* Modal */}
      <m.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        variants={scalePop}
        initial="hidden"
        animate="show"
        exit="exit"
        className={`
          relative bg-card text-card-foreground rounded-xl shadow-xl border border-border
          ${sizes[size]} w-full max-h-[90vh] flex flex-col outline-none
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
      </m.div>
    </div>
  );
}

// ============================================
// CONFIRM DIALOG
// ============================================

/**
 * Styled, themed replacement for `window.confirm()` on destructive actions.
 * Renders on the shared Modal, so it inherits the focus trap, scroll lock,
 * Escape handling, and animated exit.
 */
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Delete',
  loading = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  loading?: boolean;
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-lg bg-danger-100 dark:bg-danger-950 text-danger shrink-0">
          <AlertTriangle size={20} />
        </div>
        <div className="text-sm text-foreground-muted leading-relaxed pt-1.5">{message}</div>
      </div>
    </Modal>
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
  const reduced = useReducedMotion();
  return (
    <div className="relative flex select-none flex-col items-center justify-center overflow-hidden px-6 py-20 text-center">
      {/* A single soft light behind the icon, replacing the two decorative dots
          that used to sit beside it. Those read as debris at this scale; a
          light source reads as depth and needs no explaining. */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-16 h-56 w-56 -translate-x-1/2 rounded-full bg-primary/[0.07] blur-3xl"
      />

      <m.div
        className="relative mb-6"
        initial={reduced ? false : { opacity: 0, scale: 0.94, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE_LUX }}
      >
        <div className="flex h-24 w-24 items-center justify-center rounded-[1.75rem] border border-primary-200/60 bg-gradient-to-br from-primary-50 via-primary-100 to-primary-50 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_28px_-14px_hsl(var(--primary)/0.45)] ring-1 ring-inset ring-white/40 dark:border-primary-700/40 dark:from-primary-950 dark:via-primary-900 dark:to-primary-950 dark:ring-white/5">
          <div className="text-primary/50 dark:text-primary/40">{icon}</div>
        </div>
      </m.div>

      <m.div
        className="relative"
        initial={reduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.08, ease: EASE_LUX }}
      >
        {/* Fraunces here too, so an empty table still sounds like the product
            rather than a browser default. */}
        <h3 className="mb-2 font-display text-xl font-semibold tracking-tight text-foreground">{title}</h3>
        <p className="mx-auto mb-6 max-w-[22rem] text-sm leading-relaxed text-foreground-muted">
          {description}
        </p>
        {action}
      </m.div>
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

// ============================================
// SKELETONS
// ============================================

/**
 * Shimmering placeholder block (the `.skeleton` sweep from index.css).
 * Size it with className, e.g. `<Skeleton className="h-4 w-32" />`.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`skeleton rounded-md ${className}`} />;
}

/** Placeholder row of stat cards, matching StatCard's real layout. */
export function SkeletonStatRow({ count = 3 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 ${count >= 4 ? 'lg:grid-cols-4' : count === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-3'} gap-4`}>
      {Array.from({ length: count }, (_, i) => (
        <Card key={i}>
          <CardBody>
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-7 w-16" />
              </div>
              <Skeleton className="h-12 w-12 rounded-lg" />
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

/** Placeholder table matching the shared table layout. */
export function SkeletonTable({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-background-subtle border-b border-border">
            <tr>
              {Array.from({ length: cols }, (_, i) => (
                <th key={i} className={TABLE_HEAD_CLASS}>
                  <Skeleton className="h-3 w-20" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {Array.from({ length: rows }, (_, r) => (
              <tr key={r}>
                {Array.from({ length: cols }, (_, c) => (
                  <td key={c} className="px-6 py-4">
                    <Skeleton className={`h-4 ${c === 0 ? 'w-32' : 'w-20'}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/** Placeholder chart block. */
export function SkeletonChart({ height = 220 }: { height?: number }) {
  return (
    <div className="flex items-end gap-2 px-2" style={{ height }} aria-hidden>
      {[42, 68, 55, 80, 62, 90, 74, 58, 84, 66, 48, 72].map((h, i) => (
        <div key={i} className="skeleton flex-1 rounded-t-md" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

// ============================================
// TABS
// ============================================

export interface TabItem {
  value: string;
  label: React.ReactNode;
  count?: number;
}

/**
 * Pill tab strip with a sliding active indicator (shared-layout animation).
 * Controlled: pass the active value and an onChange handler.
 */
export function Tabs({
  tabs,
  active,
  onChange,
  className = '',
}: {
  tabs: TabItem[];
  active: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const layoutId = useId();
  return (
    <div role="tablist" className={`inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-background-muted ${className}`}>
      {tabs.map((tab) => {
        const isActive = tab.value === active;
        return (
          <button
            key={tab.value}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.value)}
            className={`relative px-3.5 py-1.5 min-h-0 rounded-md text-sm font-medium transition-colors ${
              isActive ? 'text-foreground' : 'text-foreground-muted hover:text-foreground'
            }`}
          >
            {isActive && (
              <m.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-md bg-card shadow-sm border border-border"
                transition={{ type: 'spring', bounce: 0.18, duration: 0.45 }}
              />
            )}
            <span className="relative inline-flex items-center gap-1.5">
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[11px] leading-none font-semibold ${
                    isActive ? 'bg-primary-100 dark:bg-primary-950 text-primary' : 'bg-background-subtle text-foreground-muted'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

