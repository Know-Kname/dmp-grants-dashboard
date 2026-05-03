import { useParams } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { usePublicBurial } from '../hooks/useData';
import { formatDate } from '../lib/utils';
import { COMPANY } from '../config/company';
import { BRAND } from '../config/brand';
import { motion } from 'framer-motion';

const PHOTO_PLACEHOLDER =
  'https://images.unsplash.com/photo-1584036553516-bf83210aa16c?w=900&q=70&auto=format&fit=crop';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
};

export default function MemorialPage() {
  const { id } = useParams<{ id: string }>();
  const { data: burial, isLoading, isError } = usePublicBurial(id ?? '');

  const url = typeof window !== 'undefined' ? window.location.href : '';

  if (!id) return <NotFound />;

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--bone, #F5F1EA)' }}
      >
        <div
          className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: `${BRAND.green}40`, borderTopColor: BRAND.green }}
        />
      </div>
    );
  }

  if (isError || !burial) return <NotFound />;

  const name = [
    burial.deceasedFirstName,
    burial.deceasedMiddleName,
    burial.deceasedLastName,
  ].filter(Boolean).join(' ');

  const lifespan = [
    burial.dateOfBirth ? formatDate(burial.dateOfBirth) : null,
    burial.dateOfDeath ? formatDate(burial.dateOfDeath) : null,
  ].filter(Boolean).join(' — ');

  const plotLabel =
    burial.plotLocation ||
    [burial.section, burial.lot, burial.grave].filter(Boolean).join(' · ');

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: 'var(--bone, #F5F1EA)', fontFamily: 'var(--font-sans)' }}
    >
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #F5F1EA; }
        }
      `}</style>

      {/* Top nav strip */}
      <div
        className="w-full px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: `1px solid rgba(26,61,43,0.12)` }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: BRAND.green, color: BRAND.gold }}
          >
            DMP
          </div>
          <span className="text-sm font-medium" style={{ color: BRAND.green }}>
            Detroit Memorial Park
          </span>
        </div>
        <span
          className="text-xs uppercase tracking-widest"
          style={{ color: 'rgba(26,61,43,0.45)', letterSpacing: '0.12em' }}
        >
          In Memoriam
        </span>
      </div>

      {/* Atmospheric photo */}
      <div
        className="w-full relative overflow-hidden"
        style={{ height: 'clamp(180px, 35vh, 320px)' }}
      >
        <img
          src={PHOTO_PLACEHOLDER}
          alt=""
          role="presentation"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: 'sepia(0.35) saturate(0.75) brightness(0.9)' }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to bottom,
              rgba(245,241,234,0) 0%,
              rgba(245,241,234,0.15) 60%,
              rgba(245,241,234,0.9) 100%)`,
          }}
        />
      </div>

      {/* Main content */}
      <motion.div
        className="max-w-xl mx-auto px-6 pb-16"
        initial="hidden"
        animate="show"
        variants={stagger}
        style={{ marginTop: '-2rem' }}
      >
        {/* Name card */}
        <motion.div variants={fadeUp} className="text-center mb-10">
          <h1
            className="leading-tight mb-3"
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'var(--step-3)',
              fontWeight: 600,
              color: 'var(--ink, #1a1a1a)',
              letterSpacing: '-0.02em',
            }}
          >
            {name}
          </h1>

          {/* Gold rule */}
          <div className="flex items-center justify-center gap-4 mb-3">
            <div className="flex-1 max-w-[80px]" style={{ height: '1px', backgroundColor: BRAND.gold, opacity: 0.5 }} />
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: BRAND.gold, opacity: 0.6 }} />
            <div className="flex-1 max-w-[80px]" style={{ height: '1px', backgroundColor: BRAND.gold, opacity: 0.5 }} />
          </div>

          {lifespan && (
            <p
              className="text-base tracking-wide"
              style={{
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic',
                color: 'rgba(26,26,26,0.55)',
              }}
            >
              {lifespan}
            </p>
          )}
        </motion.div>

        {/* Details */}
        {(burial.burialDate || plotLabel) && (
          <motion.div
            variants={fadeUp}
            className="rounded-2xl overflow-hidden mb-10"
            style={{
              border: '1px solid rgba(26,61,43,0.12)',
              backgroundColor: 'rgba(255,255,255,0.65)',
              backdropFilter: 'blur(8px)',
            }}
          >
            {burial.burialDate && (
              <div
                className="flex justify-between items-center px-6 py-4"
                style={{ borderBottom: plotLabel ? '1px solid rgba(26,61,43,0.08)' : undefined }}
              >
                <span
                  className="text-xs uppercase tracking-widest"
                  style={{ color: 'rgba(26,26,26,0.45)', letterSpacing: '0.1em' }}
                >
                  Burial Date
                </span>
                <span className="text-sm font-medium" style={{ color: 'var(--ink, #1a1a1a)' }}>
                  {formatDate(burial.burialDate)}
                </span>
              </div>
            )}
            {plotLabel && (
              <div className="flex justify-between items-center px-6 py-4">
                <span
                  className="text-xs uppercase tracking-widest"
                  style={{ color: 'rgba(26,26,26,0.45)', letterSpacing: '0.1em' }}
                >
                  Plot Location
                </span>
                <span
                  className="text-xs font-mono px-2.5 py-1 rounded-md"
                  style={{
                    backgroundColor: 'rgba(26,61,43,0.07)',
                    color: BRAND.green,
                    letterSpacing: '0.04em',
                  }}
                >
                  {plotLabel}
                </span>
              </div>
            )}
          </motion.div>
        )}

        {/* QR section */}
        <motion.div variants={fadeUp} className="flex flex-col items-center gap-4">
          <div
            className="bg-white p-4 rounded-2xl shadow-sm"
            style={{ border: '1px solid rgba(26,61,43,0.1)' }}
          >
            <QRCode value={url} size={128} fgColor={BRAND.greenDeep} />
          </div>
          <p
            className="text-xs text-center max-w-[220px]"
            style={{ color: 'rgba(26,26,26,0.4)', lineHeight: 1.6 }}
          >
            Scan to share this memorial. Place on a marker so families can find their loved one.
          </p>
          <button
            onClick={() => window.print()}
            className="no-print text-xs font-medium px-5 py-2.5 rounded-xl transition-colors"
            style={{
              border: `1px solid rgba(26,61,43,0.2)`,
              color: BRAND.green,
              backgroundColor: 'transparent',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(26,61,43,0.06)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            Print · Save QR
          </button>
        </motion.div>

        {/* Footer */}
        <motion.div variants={fadeUp} className="text-center mt-14">
          <div
            className="inline-block mx-auto mb-3"
            style={{ width: '2rem', height: '1px', backgroundColor: BRAND.gold, opacity: 0.4 }}
          />
          <p
            className="text-xs uppercase tracking-widest"
            style={{ color: 'rgba(26,26,26,0.35)', letterSpacing: '0.14em' }}
          >
            {COMPANY.name}
          </p>
          <p
            className="text-xs mt-1"
            style={{ color: 'rgba(26,26,26,0.25)' }}
          >
            Serving Michigan Families Since {COMPANY.established}
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}

function NotFound() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ backgroundColor: 'var(--bone, #F5F1EA)' }}
    >
      <motion.div
        className="text-center max-w-sm"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
      >
        <div
          className="w-px mx-auto mb-8"
          style={{ height: '3rem', backgroundColor: BRAND.gold, opacity: 0.4 }}
        />
        <h1
          className="mb-3"
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'var(--step-2)',
            fontWeight: 500,
            color: 'var(--ink, #1a1a1a)',
            letterSpacing: '-0.01em',
          }}
        >
          Memorial Not Found
        </h1>
        <p
          className="text-sm leading-relaxed"
          style={{ color: 'rgba(26,26,26,0.5)' }}
        >
          This memorial page is not published or does not exist.
        </p>
        <div
          className="mx-auto mt-8"
          style={{ width: '2rem', height: '1px', backgroundColor: BRAND.gold, opacity: 0.3 }}
        />
        <p
          className="text-xs mt-4 uppercase tracking-widest"
          style={{ color: 'rgba(26,26,26,0.3)', letterSpacing: '0.12em' }}
        >
          {COMPANY.name}
        </p>
      </motion.div>
    </div>
  );
}
