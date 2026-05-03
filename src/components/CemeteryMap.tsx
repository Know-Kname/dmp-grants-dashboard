import { Map as MapLibreMap, Marker, NavigationControl, Popup, type MapRef } from 'react-map-gl/maplibre';
import { useMemo, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Grave } from '../types';

const STATUS_COLORS: Record<Grave['status'], string> = {
  available: '#16a34a',   // green
  reserved: '#eab308',    // yellow
  occupied: '#dc2626',    // red
  unavailable: '#6b7280', // gray
};

const STATUS_LABELS: Record<Grave['status'], string> = {
  available: 'Available',
  reserved: 'Reserved',
  occupied: 'Occupied',
  unavailable: 'Unavailable',
};

// Detroit Memorial Park (Warren, MI) — fallback center when no graves have coords
const DEFAULT_CENTER = { lat: 42.5145, lng: -83.0286 };

interface Props {
  graves: Grave[];
  height?: number;
}

export default function CemeteryMap({ graves, height = 400 }: Props) {
  const mapRef = useRef<MapRef | null>(null);
  const [selected, setSelected] = useState<Grave | null>(null);
  const [hiddenStatuses, setHiddenStatuses] = useState<Set<Grave['status']>>(new Set());

  const placedGraves = useMemo(
    () => graves.filter(g => g.lat != null && g.lng != null),
    [graves]
  );

  const visibleGraves = useMemo(
    () => placedGraves.filter(g => !hiddenStatuses.has(g.status)),
    [placedGraves, hiddenStatuses]
  );

  const statusCounts = useMemo(() => {
    const counts: Record<Grave['status'], number> = { available: 0, reserved: 0, occupied: 0, unavailable: 0 };
    placedGraves.forEach(g => { counts[g.status]++; });
    return counts;
  }, [placedGraves]);

  const initialView = useMemo(() => {
    if (placedGraves.length === 0) {
      return { latitude: DEFAULT_CENTER.lat, longitude: DEFAULT_CENTER.lng, zoom: 17 };
    }
    const lats = placedGraves.map(g => g.lat!);
    const lngs = placedGraves.map(g => g.lng!);
    return {
      latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
      longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
      zoom: 19,
    };
  }, [placedGraves]);

  const toggleStatus = (status: Grave['status']) => {
    setHiddenStatuses(prev => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status); else next.add(status);
      return next;
    });
  };

  const flyToGrave = (g: Grave) => {
    setSelected(g);
    mapRef.current?.flyTo({ center: [g.lng!, g.lat!], zoom: 21, duration: 600 });
  };

  if (placedGraves.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-background-subtle border border-border rounded-lg text-sm text-foreground-muted px-4 text-center"
        style={{ height }}
      >
        No graves with coordinates yet. Open a grave and use <strong className="mx-1">Use My Location</strong>
        on a phone in the cemetery to capture lat/lng in one tap.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2">
        {(['available', 'reserved', 'occupied', 'unavailable'] as Grave['status'][]).map(status => {
          const isHidden = hiddenStatuses.has(status);
          return (
            <button
              key={status}
              type="button"
              onClick={() => toggleStatus(status)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-opacity ${
                isHidden ? 'opacity-40' : ''
              }`}
              style={{ borderColor: STATUS_COLORS[status], color: STATUS_COLORS[status] }}
              aria-pressed={!isHidden}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[status] }} />
              {STATUS_LABELS[status]}
              <span className="text-foreground-muted">{statusCounts[status]}</span>
            </button>
          );
        })}
      </div>

      <div className="rounded-lg overflow-hidden border border-border" style={{ height }}>
        <MapLibreMap
          ref={mapRef}
          initialViewState={initialView}
          mapStyle="https://tiles.openfreemap.org/styles/liberty"
          style={{ width: '100%', height: '100%' }}
        >
          <NavigationControl position="top-right" />
          {visibleGraves.map(g => (
            <Marker
              key={g.id}
              latitude={g.lat!}
              longitude={g.lng!}
              anchor="center"
              onClick={(e) => { e.originalEvent.stopPropagation(); flyToGrave(g); }}
            >
              <div
                className="w-4 h-4 rounded-full border-2 border-white shadow-md cursor-pointer hover:scale-125 transition-transform"
                style={{ background: STATUS_COLORS[g.status] }}
                title={`Grave ${g.graveNumber} — ${STATUS_LABELS[g.status]}`}
              />
            </Marker>
          ))}
          {selected && (
            <Popup
              latitude={selected.lat!}
              longitude={selected.lng!}
              anchor="bottom"
              onClose={() => setSelected(null)}
              closeButton
              closeOnClick={false}
              maxWidth="240px"
            >
              <div className="text-sm space-y-1 p-1">
                <p className="font-semibold">Grave {selected.graveNumber}</p>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[selected.status] }} />
                  <span className="capitalize">{STATUS_LABELS[selected.status]}</span>
                </div>
                {selected.notes && <p className="text-xs text-foreground-muted pt-1">{selected.notes}</p>}
                <p className="text-[10px] text-foreground-muted font-mono pt-1">
                  {selected.lat!.toFixed(6)}, {selected.lng!.toFixed(6)}
                </p>
              </div>
            </Popup>
          )}
        </MapLibreMap>
      </div>
    </div>
  );
}
