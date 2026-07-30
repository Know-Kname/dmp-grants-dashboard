/**
 * Shared ESRI World Imagery satellite raster style for MapLibre GL.
 * Free, keyless tile source. Used identically by CemeteryMap and LocationsMap —
 * kept in one place so the two can't silently drift.
 */
import type { StyleSpecification } from 'maplibre-gl';

export const SATELLITE_STYLE: StyleSpecification = {
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
