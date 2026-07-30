/**
 * Shell for the secondary auth pages (forgot / reset password).
 *
 * Deliberately reuses the Login page's editorial vocabulary — bone ground,
 * Fraunces display face, gold hairlines, EASE_LUX entrances — without its
 * full-bleed photo panel, so these read as the same product without cloning
 * six hundred lines of hero markup.
 */
import { Link } from 'react-router-dom';
import Balancer from 'react-wrap-balancer';
import { m, stagger, fadeUp } from '../lib/motion';
import { COMPANY } from '../config/company';
import { BRAND } from '../config/brand';

export function AuthLayout({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bone)' }}>
      {/* Brand bar */}
      <div className="flex items-center px-6 py-4" style={{ backgroundColor: BRAND.greenDeep }}>
        <Link to="/login">
          <img
            src="/dmp-logo.png"
            alt="Detroit Memorial Park"
            className="h-9 w-auto"
            style={{ filter: 'brightness(0) saturate(100%) invert(1)', opacity: 0.9 }}
          />
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-16 sm:px-12">
        <m.div className="w-full max-w-[420px]" initial="hidden" animate="show" variants={stagger}>
          <m.p
            variants={fadeUp}
            className="text-[10px] uppercase mb-5"
            style={{ color: BRAND.green, letterSpacing: '0.28em', fontWeight: 600 }}
          >
            {eyebrow}
          </m.p>

          <m.h1
            variants={fadeUp}
            className="leading-tight mb-3"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(1.9rem, 3.2vw, 2.5rem)',
              fontWeight: 400,
              fontVariationSettings: '"opsz" 144, "SOFT" 30, "WONK" 0',
              letterSpacing: '-0.02em',
              color: 'var(--ink)',
            }}
          >
            <Balancer>{title}</Balancer>
          </m.h1>

          {subtitle && (
            <m.div
              variants={fadeUp}
              className="text-sm mb-9"
              style={{
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic',
                color: 'rgba(26,26,26,0.5)',
              }}
            >
              {subtitle}
            </m.div>
          )}

          {children}

          <m.div
            variants={fadeUp}
            className="mt-12 pt-7"
            style={{ borderTop: '1px solid rgba(26,61,43,0.12)' }}
          >
            {footer}
            <p
              className="text-[10px] uppercase text-center mt-3"
              style={{ color: 'rgba(26,26,26,0.3)', letterSpacing: '0.2em' }}
            >
              {COMPANY.legal.copyright}
            </p>
          </m.div>
        </m.div>
      </div>
    </div>
  );
}

/** Underlined field matching the Login page's inputs. */
export function AuthField({
  id,
  label,
  icon,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; icon?: React.ReactNode }) {
  return (
    <div className="mb-6">
      <label
        htmlFor={id}
        className="block text-[10px] uppercase mb-2.5"
        style={{ color: 'rgba(26,26,26,0.55)', letterSpacing: '0.22em', fontWeight: 600 }}
      >
        {label}
      </label>
      <div
        className="relative flex items-center transition-all duration-200"
        style={{ borderBottom: '1px solid rgba(26,61,43,0.25)' }}
      >
        {icon && <span style={{ color: 'rgba(26,26,26,0.4)' }}>{icon}</span>}
        <input
          id={id}
          className="w-full pl-3 pr-2 py-3 bg-transparent text-base outline-none"
          style={{ color: 'var(--ink)', fontFamily: 'var(--font-serif)' }}
          {...props}
        />
      </div>
    </div>
  );
}

/**
 * Primary action button matching the Login page's submit.
 *
 * The drag/animation DOM handlers are omitted because framer's motion props of
 * the same names have incompatible signatures; none of them are wanted here.
 */
type AuthButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration' | 'onDrag' | 'onDragStart' | 'onDragEnd'
> & { loading?: boolean };

export function AuthButton({ loading, children, ...props }: AuthButtonProps) {
  return (
    <m.button
      whileHover={props.disabled || loading ? {} : { scale: 1.005 }}
      whileTap={props.disabled || loading ? {} : { scale: 0.995 }}
      className="w-full flex items-center justify-center gap-2.5 py-4 px-5 text-[11px] uppercase font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      style={{
        backgroundColor: BRAND.greenDeep,
        color: 'var(--bone)',
        letterSpacing: '0.22em',
        border: 'none',
        borderRadius: '2px',
      }}
      disabled={props.disabled || loading}
      {...props}
    >
      {loading && (
        <span
          className="w-3.5 h-3.5 border rounded-full animate-spin"
          style={{ borderColor: 'rgba(245,241,234,0.3)', borderTopColor: 'var(--bone)' }}
        />
      )}
      {children}
    </m.button>
  );
}
