import { useParams } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { usePublicBurial } from '../hooks/useData';
import { formatDate } from '../lib/utils';
import { COMPANY } from '../config/company';
import { BRAND } from '../config/brand';

export default function MemorialPage() {
  const { id } = useParams<{ id: string }>();
  const { data: burial, isLoading, isError } = usePublicBurial(id ?? '');

  const url = window.location.href;

  if (!id) {
    return <NotFound />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-stone-200 border-t-stone-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !burial) {
    return <NotFound />;
  }

  const name = [
    burial.deceasedFirstName,
    burial.deceasedMiddleName,
    burial.deceasedLastName,
  ].filter(Boolean).join(' ');

  const lifespan = [
    burial.dateOfBirth ? formatDate(burial.dateOfBirth) : null,
    burial.dateOfDeath ? formatDate(burial.dateOfDeath) : null,
  ].filter(Boolean).join(' — ');

  const plotLabel = burial.plotLocation
    || [burial.section, burial.lot, burial.grave].filter(Boolean).join('-');

  return (
    <div className="min-h-screen bg-stone-50 font-sans">
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>

      {/* Hero band */}
      <div
        className="w-full py-8 px-4 text-center"
        style={{ background: `linear-gradient(135deg, ${BRAND.greenDeep} 0%, ${BRAND.green} 100%)` }}
      >
        <p className="text-sm font-medium uppercase tracking-widest mb-2" style={{ color: BRAND.goldLight }}>
          {COMPANY.name}
        </p>
        <p className="text-xs text-white/60 uppercase tracking-widest">In Loving Memory</p>
      </div>

      {/* Main card */}
      <div className="max-w-lg mx-auto px-4 py-10">
        <div className="bg-white rounded-2xl shadow-lg border border-stone-200 overflow-hidden">
          {/* Name section */}
          <div className="px-8 pt-8 pb-6 text-center border-b border-stone-100">
            <h1 className="text-3xl font-bold text-stone-900 mb-2">{name}</h1>
            {lifespan && (
              <p className="text-stone-500 text-sm tracking-wide">{lifespan}</p>
            )}
          </div>

          {/* Details */}
          <div className="px-8 py-6 space-y-4">
            {burial.burialDate && (
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">Burial Date</span>
                <span className="font-medium text-stone-800">{formatDate(burial.burialDate)}</span>
              </div>
            )}
            {plotLabel && (
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">Plot Location</span>
                <span className="font-mono text-stone-800 bg-stone-100 px-2 py-0.5 rounded text-xs">{plotLabel}</span>
              </div>
            )}
          </div>

          {/* QR Section */}
          <div className="px-8 py-6 bg-stone-50 border-t border-stone-100 flex flex-col items-center gap-3">
            <div className="bg-white p-3 rounded-xl shadow-sm border border-stone-200">
              <QRCode value={url} size={140} />
            </div>
            <p className="text-xs text-stone-400 text-center max-w-xs">
              Scan to visit this memorial page. Place on a marker so families can find their loved one.
            </p>
            <button
              onClick={() => window.print()}
              className="no-print mt-1 text-xs font-medium px-4 py-2 rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-100 transition-colors"
            >
              Print / Save QR
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-stone-400 mt-6">
          {COMPANY.name} · <a href={COMPANY.website} target="_blank" rel="noopener noreferrer" className="hover:text-stone-600 transition-colors">{COMPANY.website}</a>
        </p>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div
          className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
          style={{ background: BRAND.green }}
        >
          <span className="text-white text-2xl font-bold">?</span>
        </div>
        <h1 className="text-xl font-semibold text-stone-800 mb-2">Memorial Not Found</h1>
        <p className="text-stone-500 text-sm">
          This memorial page is not published or does not exist.
        </p>
      </div>
    </div>
  );
}
