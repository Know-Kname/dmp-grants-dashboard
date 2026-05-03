import { Map as MapLibreMap, Marker, NavigationControl, Popup } from 'react-map-gl/maplibre';
import { useMemo, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Grave } from '../types';

const STATUS_COLORS: Record<Grave['status'], string> = {
  available: '#16a34a',   // green
  reserved: '#eab308',    // yellow
  occupied: '#dc2626',    // red
  unavailable: '#6b7280', // gray
};

// Detroit Memorial Park (Warren, MI) — fallback center when no graves have coords
const DEFAULT_CENTER = { lat: 42.5145, lng: -83.0286 };

interface Props {
  graves: Grave[];
  height?: number;
}

export default function CemeteryMap({ graves, height = 400 }: Props) {
  const [selected, setSelected] = useState<Grave | null>(null);

  const placedGraves = useMemo(
    () => graves.filter(g => g.lat != null && g.lng != null),
    [graves]
  );

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

  if (placedGraves.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-background-subtle border border-border rounded-lg text-sm text-foreground-muted"
        style={{ height }}
      >
        No graves with coordinates yet — add lat/lng to graves to see them on the map.
      </div>
    );
  }

  return (
    <div className="rounded-lg overflow-hidden border border-border" style={{ height }}>
      <MapLibreMap
        initialViewState={initialView}
        mapStyle="https://tiles.openfreemap.org/styles/liberty"
        style={{ width: '100%', height: '100%' }}
      >
        <NavigationControl position="top-right" />
        {placedGraves.map(g => (
          <Marker
            key={g.id}
            latitude={g.lat!}
            longitude={g.lng!}
            anchor="center"
            onClick={(e) => { e.originalEvent.stopPropagation(); setSelected(g); }}
          >
            <div
              className="w-4 h-4 rounded-full border-2 border-white shadow-md cursor-pointer hover:scale-125 transition-transform"
              style={{ background: STATUS_COLORS[g.status] }}
              title={`Grave ${g.graveNumber} — ${g.status}`}
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
          >
            <div className="text-sm space-y-1 p-1">
              <p className="font-semibold">Grave {selected.graveNumber}</p>
              <p className="capitalize text-foreground-muted">Status: {selected.status}</p>
              {selected.notes && <p className="text-xs text-foreground-muted">{selected.notes}</p>}
            </div>
          </Popup>
        )}
      </MapLibreMap>
    </div>
  );
}
