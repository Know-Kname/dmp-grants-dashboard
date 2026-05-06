import { Map as MapLibreMap, Marker, NavigationControl, Popup, type MapRef, type MapLayerMouseEvent } from 'react-map-gl/maplibre';
import { useMemo, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { StyleSpecification } from 'maplibre-gl';
import { Search, Compass, Crosshair, X } from 'lucide-react';
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

const STREET_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  name: 'Satellite',
  sources: {
    esri: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 20,
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DigitalGlobe, GeoEye',
    },
  },
  layers: [{ id: 'satellite', type: 'raster', source: 'esri' }],
};

// Detroit Memorial Park (Warren, MI) — fallback center when no graves have coords
const DEFAULT_CENTER = { lat: 42.5145, lng: -83.0286 };

// Haversine distance in meters between two lat/lng points
function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

interface Props {
  graves: Grave[];
  height?: number;
  /** Called with {lat,lng} when the user clicks the map in "drop pin" mode. */
  onMapPinDrop?: (coords: { lat: number; lng: number }) => void;
}

export default function CemeteryMap({ graves, height = 400, onMapPinDrop }: Props) {
  const mapRef = useRef<MapRef | null>(null);
  const [selected, setSelected] = useState<Grave | null>(null);
  const [hiddenStatuses, setHiddenStatuses] = useState<Set<Grave['status']>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [dropMode, setDropMode] = useState(false);
  const [satellite, setSatellite] = useState(false);

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

  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return placedGraves
      .filter(g => g.graveNumber.toLowerCase().includes(q))
      .slice(0, 6);
  }, [searchQuery, placedGraves]);

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

  const findNearestAvailable = (from: Grave) => {
    const ref = { lat: from.lat!, lng: from.lng! };
    const candidates = placedGraves.filter(g => g.status === 'available' && g.id !== from.id);
    if (candidates.length === 0) {
      alert('No available graves with coordinates have been placed yet.');
      return;
    }
    const sorted = candidates
      .map(g => ({ g, d: distanceMeters(ref, { lat: g.lat!, lng: g.lng! }) }))
      .sort((a, b) => a.d - b.d);
    const nearest = sorted[0];
    flyToGrave(nearest.g);
  };

  const handleMapClick = (e: MapLayerMouseEvent) => {
    if (!dropMode || !onMapPinDrop) return;
    onMapPinDrop({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    setDropMode(false);
  };

  if (placedGraves.length === 0 && !onMapPinDrop) {
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
      {/* Toolbar: search + status filter + actions */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-[260px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Find by grave number…"
            className="w-full pl-8 pr-7 py-1.5 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-foreground-muted hover:text-foreground"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
          {searchMatches.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-background border border-border rounded-md shadow-lg max-h-56 overflow-y-auto">
              {searchMatches.map(g => (
                <button
                  key={g.id}
                  onClick={() => { flyToGrave(g); setSearchQuery(''); }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm hover:bg-accent/40 text-left"
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS_COLORS[g.status] }} />
                  <span className="font-mono">{g.graveNumber}</span>
                  <span className="text-xs text-foreground-muted ml-auto">{STATUS_LABELS[g.status]}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Satellite toggle */}
        <div className="flex overflow-hidden rounded-md border border-border shadow-sm">
          {(['Street', 'Satellite'] as const).map(label => {
            const active = label === 'Satellite' ? satellite : !satellite;
            return (
              <button
                key={label}
                type="button"
                onClick={() => setSatellite(label === 'Satellite')}
                className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-foreground-muted hover:text-foreground'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Drop-pin toggle */}
        {onMapPinDrop && (
          <button
            type="button"
            onClick={() => setDropMode(v => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              dropMode
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-foreground-muted hover:text-foreground'
            }`}
            title="Click anywhere on the map to drop a coordinate for a new grave"
          >
            <Crosshair size={14} />
            {dropMode ? 'Click map to drop pin…' : 'Drop pin'}
          </button>
        )}

        {/* Status filter chips */}
        <div className="flex flex-wrap gap-2 ml-auto">
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
      </div>

      <div
        className={`rounded-lg overflow-hidden border border-border relative ${dropMode ? 'ring-2 ring-primary' : ''}`}
        style={{ height }}
      >
        <MapLibreMap
          ref={mapRef}
          initialViewState={initialView}
          mapStyle={satellite ? SATELLITE_STYLE : STREET_STYLE}
          style={{ width: '100%', height: '100%', cursor: dropMode ? 'crosshair' : undefined }}
          onClick={handleMapClick}
        >
          <NavigationControl position="top-right" />
          {visibleGraves.map(g => (
            <Marker
              key={g.id}
              latitude={g.lat!}
              longitude={g.lng!}
              anchor="center"
              onClick={(e) => { e.originalEvent.stopPropagation(); if (!dropMode) flyToGrave(g); }}
            >
              <div
                className="w-4 h-4 rounded-full border-2 border-white shadow-md cursor-pointer hover:scale-125 transition-transform"
                style={{
                  background: STATUS_COLORS[g.status],
                  outline: selected?.id === g.id ? '2px solid #1a3d2b' : undefined,
                  outlineOffset: selected?.id === g.id ? '2px' : undefined,
                }}
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
              maxWidth="260px"
            >
              <div className="text-sm space-y-2 p-1">
                <div>
                  <p className="font-semibold">Grave {selected.graveNumber}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[selected.status] }} />
                    <span className="capitalize">{STATUS_LABELS[selected.status]}</span>
                  </div>
                </div>
                {selected.notes && <p className="text-xs text-foreground-muted">{selected.notes}</p>}
                <p className="text-[10px] text-foreground-muted font-mono">
                  {selected.lat!.toFixed(6)}, {selected.lng!.toFixed(6)}
                </p>
                {selected.status !== 'available' && statusCounts.available > 0 && (
                  <button
                    onClick={() => findNearestAvailable(selected)}
                    className="w-full flex items-center justify-center gap-1.5 mt-1 px-2 py-1 rounded text-xs font-medium bg-success/10 text-success hover:bg-success/20"
                  >
                    <Compass size={12} />
                    Find nearest available
                  </button>
                )}
              </div>
            </Popup>
          )}
        </MapLibreMap>

        {dropMode && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs px-3 py-1.5 rounded-full shadow-lg pointer-events-none">
            Click on the map to set new grave coordinates
          </div>
        )}
      </div>
    </div>
  );
}
