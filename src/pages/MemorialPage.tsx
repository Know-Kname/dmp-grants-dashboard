import { useParams } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { m, EASE_LUX } from '../lib/motion';
import Balancer from 'react-wrap-balancer';
import { usePublicBurial } from '../hooks/useData';
import { formatDate } from '../lib/utils';
import { COMPANY } from '../config/company';
import { BRAND } from '../config/brand';

const PHOTO_PLACEHOLDER = '/dmp-hero.jpg';

/**
 * Word-mask reveal: each word slides up from a clipped container.
 * Mirrors the Green-Wood / Pentagram editorial entrance pattern.
 */
function RevealHeadline({
  text,
  className = '',
  style,
  perWordDelay = 0.08,
}: {
  text: string;
  className?: string;
  style?: React.CSSProperties;
  perWordDelay?: number;
}) {
  const words = text.split(' ');
  return (
    <h1 className={className} style={style} aria-label={text}>
      {words.map((word, wi) => (
        <span
          key={wi}
          aria-hidden="true"
          style={{
            display: 'inline-block',
            overflow: 'hidden',
            verticalAlign: 'baseline',
            marginRight: '0.22em',
            paddingBottom: '0.06em',
          }}
        >
          <m.span
            style={{ display: 'inline-block' }}
            initial={{ y: '108%' }}
            animate={{ y: 0 }}
            transition={{
              delay: 0.1 + wi * perWordDelay,
              duration: 0.95,
              ease: EASE_LUX,
            }}
          >
            {word}
          </m.span>
        </span>
      ))}
    </h1>
  );
}

/** Subtle film grain overlay using SVG feTurbulence — no library, ~1KB inline */
function FilmGrain({ opacity = 0.045 }: { opacity?: number }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{ opacity, mixBlendMode: 'overlay' }}
    >
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <filter id="dmp-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#dmp-grain)" />
      </svg>
    </div>
  );
}

export default function MemorialPage() {
  const { id } = useParams<{ id: string }>();
  const { data: burial, isLoading, isError } = usePublicBurial(id ?? '');

  const url = typeof window !== 'undefined' ? window.location.href : '';

  if (!id) return <NotFound />;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bone)' }}>
        <div
          className="w-1 h-12 origin-bottom"
          style={{
            backgroundColor: BRAND.green,
            animation: 'breathe 1.6s var(--ease-lux) infinite alternate',
          }}
        />
        <style>{`@keyframes breathe { from { transform: scaleY(0.4); opacity: 0.5; } to { transform: scaleY(1); opacity: 1; } }`}</style>
      </div>
    );
  }

  if (isError || !burial) return <NotFound />;

  const name = [burial.deceasedFirstName, burial.deceasedMiddleName, burial.deceasedLastName]
    .filter(Boolean)
    .join(' ');

  const birth = burial.dateOfBirth ? formatDate(burial.dateOfBirth) : null;
  const death = burial.dateOfDeath ? formatDate(burial.dateOfDeath) : null;
  const lifespan = [birth, death].filter(Boolean).join('  —  ');

  const plotLabel =
    burial.plotLocation || [burial.section, burial.lot, burial.grave].filter(Boolean).join(' · ');

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: 'var(--bone)', color: 'var(--ink)', fontFamily: 'var(--font-sans)' }}
    >
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #F5F1EA; }
        }
        @keyframes ken-burns {
          from { transform: scale(1) translateY(0); }
          to   { transform: scale(1.06) translateY(-1.5%); }
        }
      `}</style>

      {/* ───── Top brand strip ───── */}
      <header
        className="relative z-10 px-6 lg:px-12 py-5 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(26,61,43,0.10)' }}
      >
        <m.div
          className="flex items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <img
            src="/dmp-logo.png"
            alt="Detroit Memorial Park"
            className="h-7 w-auto"
          />
        </m.div>
        <m.span
          className="text-[10px] uppercase hidden sm:block"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          style={{ color: 'rgba(26,26,26,0.4)', letterSpacing: '0.22em', fontWeight: 500 }}
        >
          In Memoriam · Est. 1925
        </m.span>
      </header>

      {/* ───── HERO: split duotone portrait + nameplate ───── */}
      <section className="grid grid-cols-1 lg:grid-cols-[5fr_7fr]" style={{ minHeight: 'min(82vh, 760px)' }}>
        {/* Duotone portrait — 4:5 framing */}
        <m.div
          className="relative overflow-hidden"
          initial={{ clipPath: 'inset(0 0 100% 0)' }}
          animate={{ clipPath: 'inset(0 0 0% 0)' }}
          transition={{ duration: 1.4, ease: EASE_LUX, delay: 0.05 }}
          style={{
            backgroundColor: BRAND.greenDeep,
            aspectRatio: '4 / 5',
            maxHeight: 'min(82vh, 760px)',
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url('${PHOTO_PLACEHOLDER}')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'grayscale(1) contrast(1.05) brightness(0.92)',
              animation: 'ken-burns 18s var(--ease-lux) forwards',
            }}
          />
          {/* Forest multiply layer */}
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(180deg, rgba(26,61,43,0.55) 0%, rgba(15,36,25,0.78) 100%)`,
              mixBlendMode: 'multiply',
            }}
          />
          {/* Bone screen tint at bottom */}
          <div
            className="absolute inset-x-0 bottom-0 h-1/2"
            style={{
              background: `linear-gradient(180deg, rgba(245,241,234,0) 0%, rgba(245,241,234,0.32) 100%)`,
              mixBlendMode: 'screen',
            }}
          />
          <FilmGrain opacity={0.06} />

          {/* Vertical gold rule, very thin, anchored bottom-left */}
          <div
            className="absolute left-8 lg:left-12 bottom-8 lg:bottom-12 w-px"
            style={{ height: '64px', backgroundColor: BRAND.gold, opacity: 0.55 }}
          />
          <div
            className="absolute left-8 lg:left-12 bottom-0 text-[10px] uppercase pb-3"
            style={{ color: 'rgba(245,241,234,0.7)', letterSpacing: '0.22em', fontWeight: 500 }}
          >
            Plate I · Portrait
          </div>
        </m.div>

        {/* Nameplate — bone half */}
        <div className="flex flex-col justify-center px-8 sm:px-12 lg:px-20 py-16 lg:py-24">
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-[10px] uppercase mb-8"
            style={{ color: BRAND.green, letterSpacing: '0.28em', fontWeight: 600 }}
          >
            In Loving Memory of
          </m.div>

          <RevealHeadline
            text={name}
            className="leading-[0.96]"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--step-display)',
              fontWeight: 400,
              fontVariationSettings: '"opsz" 144, "SOFT" 50, "WONK" 0',
              letterSpacing: '-0.02em',
              color: 'var(--ink)',
            }}
          />

          {/* Gold rule above dates */}
          <m.div
            className="mt-10 mb-5"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 1, ease: EASE_LUX, delay: 0.9 }}
            style={{ width: '64px', height: '1px', backgroundColor: BRAND.gold, transformOrigin: 'left' }}
          />

          {lifespan && (
            <m.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: EASE_LUX, delay: 1.0 }}
              className="text-base lg:text-lg"
              style={{
                fontFamily: 'var(--font-display)',
                fontStyle: 'italic',
                fontVariationSettings: '"opsz" 60, "SOFT" 0, "WONK" 0',
                color: 'rgba(26,26,26,0.6)',
                letterSpacing: '0.02em',
              }}
            >
              {lifespan}
            </m.p>
          )}

          {/* Sticky-ish metadata block */}
          <m.dl
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE_LUX, delay: 1.15 }}
            className="mt-14 grid grid-cols-2 gap-x-10 gap-y-6 max-w-md"
          >
            <Field label="Born" value={birth} />
            <Field label="Died" value={death} />
            {burial.burialDate && <Field label="Interred" value={formatDate(burial.burialDate)} />}
            {plotLabel && <Field label="Plot" value={plotLabel} mono />}
          </m.dl>
        </div>
      </section>

      {/* ───── PULL-QUOTE: full-bleed forest ───── */}
      <m.section
        className="relative overflow-hidden"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 1, ease: EASE_LUX }}
        style={{
          backgroundColor: BRAND.greenDeep,
          paddingTop: 'clamp(96px, 14vw, 192px)',
          paddingBottom: 'clamp(96px, 14vw, 192px)',
        }}
      >
        <FilmGrain opacity={0.08} />
        <div className="relative max-w-3xl mx-auto px-8 text-center">
          <div className="mx-auto mb-10 w-px" style={{ height: '48px', backgroundColor: BRAND.gold, opacity: 0.55 }} />
          <m.p
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 1.1, ease: EASE_LUX, delay: 0.1 }}
            className="leading-[1.18]"
            style={{
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              fontWeight: 300,
              fontVariationSettings: '"opsz" 144, "SOFT" 60, "WONK" 0',
              fontSize: 'clamp(1.75rem, 3.6vw, 3rem)',
              color: 'rgba(245,241,234,0.94)',
              letterSpacing: '-0.005em',
            }}
          >
            <Balancer>
              Those we love don't go away. They walk beside us every day —
              unseen, unheard, but always near.
            </Balancer>
          </m.p>
          <div className="mx-auto mt-10 w-px" style={{ height: '48px', backgroundColor: BRAND.gold, opacity: 0.55 }} />
        </div>
      </m.section>

      {/* ───── REMEMBRANCE + QR ───── */}
      <section className="px-6 lg:px-12 py-24 lg:py-32 grid grid-cols-1 lg:grid-cols-12 gap-12 max-w-6xl mx-auto">
        <m.div
          className="lg:col-span-7 lg:col-start-1"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 1, ease: EASE_LUX }}
        >
          <p
            className="text-[10px] uppercase mb-5"
            style={{ color: BRAND.green, letterSpacing: '0.26em', fontWeight: 600 }}
          >
            A Place to Visit
          </p>
          <h2
            className="leading-tight mb-6"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--step-2)',
              fontWeight: 500,
              fontVariationSettings: '"opsz" 96, "SOFT" 30, "WONK" 0',
              letterSpacing: '-0.01em',
            }}
          >
            <Balancer>Carrying memory forward, one visit at a time.</Balancer>
          </h2>
          <p
            className="text-base leading-relaxed"
            style={{
              fontFamily: 'var(--font-serif)',
              color: 'rgba(26,26,26,0.72)',
              maxWidth: '58ch',
              lineHeight: 1.7,
            }}
          >
            This memorial is part of the Detroit Memorial Park archive — a public
            record of the lives entrusted to our care. Family and friends may scan
            the code at right to revisit this page from the marker, share it with
            distant relatives, or print a keepsake. The grounds are open daily;
            we welcome you to walk them.
          </p>
        </m.div>

        <m.div
          className="lg:col-span-4 lg:col-start-9 flex flex-col items-start lg:items-center gap-5"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 1, ease: EASE_LUX, delay: 0.15 }}
        >
          <div
            className="bg-white p-5 rounded-sm"
            style={{ border: '1px solid rgba(26,61,43,0.12)' }}
          >
            <QRCode value={url} size={144} fgColor={BRAND.greenDeep} />
          </div>
          <p
            className="text-xs lg:text-center max-w-[220px]"
            style={{ color: 'rgba(26,26,26,0.5)', lineHeight: 1.6, fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}
          >
            Scan to share. Place on a marker so families can find their loved one.
          </p>
          <button
            onClick={() => window.print()}
            className="no-print text-[11px] uppercase font-medium px-5 py-3 rounded-sm transition-colors"
            style={{
              border: `1px solid rgba(26,61,43,0.3)`,
              color: BRAND.green,
              backgroundColor: 'transparent',
              letterSpacing: '0.18em',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(26,61,43,0.06)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            Print · Save QR
          </button>
        </m.div>
      </section>

      {/* ───── FOOTER ───── */}
      <footer
        className="relative overflow-hidden"
        style={{ backgroundColor: BRAND.greenDeep, paddingTop: '64px', paddingBottom: '64px' }}
      >
        <FilmGrain opacity={0.06} />
        <div className="relative max-w-4xl mx-auto px-8 text-center">
          <div className="mx-auto mb-8 w-px" style={{ height: '32px', backgroundColor: BRAND.gold, opacity: 0.5 }} />
          <img
            src="/dmp-logo.png"
            alt="Detroit Memorial Park"
            className="mx-auto mb-4 h-12 w-auto"
            style={{ filter: 'brightness(0) saturate(100%) invert(1)', opacity: 0.88 }}
          />
          <p
            className="text-[10px] uppercase mb-8"
            style={{ color: BRAND.gold, letterSpacing: '0.32em', fontWeight: 500, opacity: 0.85 }}
          >
            {COMPANY.tagline}
          </p>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-[11px] uppercase" style={{ color: 'rgba(245,241,234,0.55)', letterSpacing: '0.2em' }}>
            <span>{COMPANY.locations.east.city}, MI</span>
            <span style={{ color: 'rgba(196,154,44,0.45)' }}>·</span>
            <span>{COMPANY.locations.west.city}, MI</span>
            <span style={{ color: 'rgba(196,154,44,0.45)' }}>·</span>
            <span>{COMPANY.locations.gracelawn.city}, MI</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <dt
        className="text-[10px] uppercase mb-1"
        style={{ color: 'rgba(26,26,26,0.42)', letterSpacing: '0.2em', fontWeight: 600 }}
      >
        {label}
      </dt>
      <dd
        style={{
          fontFamily: mono ? 'ui-monospace, SFMono-Regular, monospace' : 'var(--font-serif)',
          fontSize: '0.95rem',
          color: 'var(--ink)',
          fontWeight: mono ? 500 : 400,
          letterSpacing: mono ? '0.02em' : 'normal',
        }}
      >
        {value}
      </dd>
    </div>
  );
}

function NotFound() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ backgroundColor: 'var(--bone)' }}
    >
      <m.div
        className="text-center max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: EASE_LUX }}
      >
        <div
          className="w-px mx-auto mb-10"
          style={{ height: '64px', backgroundColor: BRAND.gold, opacity: 0.5 }}
        />
        <img
          src="/dmp-logo.png"
          alt="Detroit Memorial Park"
          className="mx-auto mb-6 h-8 w-auto"
        />
        <h1
          className="mb-5"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--step-3)',
            fontWeight: 400,
            fontVariationSettings: '"opsz" 144, "SOFT" 30, "WONK" 0',
            letterSpacing: '-0.01em',
            color: 'var(--ink)',
          }}
        >
          <Balancer>Memorial Not Found</Balancer>
        </h1>
        <p
          className="text-sm leading-relaxed"
          style={{ fontFamily: 'var(--font-serif)', color: 'rgba(26,26,26,0.55)', fontStyle: 'italic' }}
        >
          This memorial page is not published, or has been removed from public view.
        </p>
        <div
          className="mx-auto mt-10"
          style={{ width: '32px', height: '1px', backgroundColor: BRAND.gold, opacity: 0.4 }}
        />
      </m.div>
    </div>
  );
}
