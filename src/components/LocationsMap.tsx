import { Map as MapLibreMap, Marker, Popup, NavigationControl, type MapRef } from 'react-map-gl/maplibre';
import { useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { COMPANY } from '../config/company';
import { BRAND } from '../config/brand';
import { Phone } from 'lucide-react';
import { SATELLITE_STYLE } from '../lib/mapStyles';

type LocKey = keyof typeof COMPANY.locations;

const LOCATIONS = (
  Object.entries(COMPANY.locations) as [LocKey, (typeof COMPANY.locations)[LocKey]][]
).map(([key, loc]) => ({ key, ...loc }));

const STREET_STYLE = 'https://tiles.openfreemap.org/styles/positron';

const lats = LOCATIONS.map(l => l.coordinates.lat);
const lngs = LOCATIONS.map(l => l.coordinates.lng);
const CENTER_LAT = (Math.min(...lats) + Math.max(...lats)) / 2;
const CENTER_LNG = (Math.min(...lngs) + Math.max(...lngs)) / 2;

function DmpPin({ active }: { active: boolean }) {
  return (
    <svg width="30" height="38" viewBox="0 0 30 38" aria-hidden="true">
      <path
        d="M15 0C6.72 0 0 6.72 0 15c0 10.5 15 23 15 23S30 25.5 30 15C30 6.72 23.28 0 15 0z"
        fill={BRAND.greenDeep}
        stroke={active ? BRAND.gold : 'rgba(255,255,255,0.6)'}
        strokeWidth={active ? 2.5 : 1.5}
      />
      <circle cx="15" cy="15" r="5.5" fill={BRAND.gold} />
    </svg>
  );
}

export default function LocationsMap({ height = 420 }: { height?: number }) {
  const mapRef = useRef<MapRef | null>(null);
  const [selected, setSelected] = useState<LocKey | null>(null);
  const [satellite, setSatellite] = useState(false);

  const selectedLoc = selected ? LOCATIONS.find(l => l.key === selected) : null;

  const flyTo = (loc: (typeof LOCATIONS)[number]) => {
    setSelected(loc.key);
    mapRef.current?.flyTo({
      center: [loc.coordinates.lng, loc.coordinates.lat],
      zoom: 14,
      duration: 900,
    });
  };

  return (
    <div className="relative overflow-hidden rounded-b-xl" style={{ height }}>
      <MapLibreMap
        ref={mapRef}
        initialViewState={{ latitude: CENTER_LAT, longitude: CENTER_LNG, zoom: 7.6 }}
        mapStyle={satellite ? SATELLITE_STYLE : STREET_STYLE}
        style={{ width: '100%', height: '100%' }}
      >
        <NavigationControl position="top-right" />

        {LOCATIONS.map(loc => (
          <Marker
            key={loc.key}
            latitude={loc.coordinates.lat}
            longitude={loc.coordinates.lng}
            anchor="bottom"
            onClick={e => {
              e.originalEvent.stopPropagation();
              flyTo(loc);
            }}
          >
            <div className="cursor-pointer hover:scale-110 transition-transform drop-shadow-lg">
              <DmpPin active={loc.key === selected} />
            </div>
          </Marker>
        ))}

        {selectedLoc && (
          <Popup
            latitude={selectedLoc.coordinates.lat}
            longitude={selectedLoc.coordinates.lng}
            anchor="bottom"
            offset={42}
            onClose={() => setSelected(null)}
            closeButton
            closeOnClick={false}
            maxWidth="240px"
          >
            <div className="p-1 space-y-1">
              <p className="font-semibold text-sm">{selectedLoc.name}</p>
              <p className="text-xs text-foreground-muted leading-snug">
                {selectedLoc.address}
                <br />
                {selectedLoc.city}, {selectedLoc.state} {selectedLoc.zip}
              </p>
              <a
                href={`tel:${selectedLoc.phone.replace(/[^\d]/g, '')}`}
                className="inline-flex items-center gap-1.5 text-xs hover:underline mt-0.5"
                style={{ color: BRAND.green }}
              >
                <Phone size={11} />
                {selectedLoc.phone}
              </a>
            </div>
          </Popup>
        )}
      </MapLibreMap>

      {/* Street / Satellite toggle */}
      <div className="absolute top-2 left-2 flex overflow-hidden rounded shadow-lg">
        {(['Map', 'Satellite'] as const).map(label => {
          const active = label === 'Satellite' ? satellite : !satellite;
          return (
            <button
              key={label}
              onClick={() => setSatellite(label === 'Satellite')}
              className="px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                backgroundColor: active ? BRAND.greenDeep : 'rgba(255,255,255,0.93)',
                color: active ? 'white' : BRAND.greenDeep,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Location chips — click to fly to that cemetery */}
      <div className="absolute bottom-6 left-3 flex flex-col gap-1.5">
        {LOCATIONS.map(loc => (
          <button
            key={loc.key}
            onClick={() => flyTo(loc)}
            className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium shadow-md transition-all"
            style={{
              backgroundColor: selected === loc.key ? BRAND.greenDeep : 'rgba(255,255,255,0.92)',
              color: selected === loc.key ? 'white' : BRAND.greenDeep,
              border: `1px solid ${selected === loc.key ? BRAND.gold : 'rgba(26,61,43,0.2)'}`,
            }}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: BRAND.gold }}
            />
            {loc.city}
          </button>
        ))}
      </div>
    </div>
  );
}
