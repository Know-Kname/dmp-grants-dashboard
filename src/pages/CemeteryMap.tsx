import L from "leaflet";
import { useCallback, useEffect, useRef, useState } from "react";
import "leaflet-draw";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import {
  Download,
  Eye,
  MapPin,
  Pencil,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { Button, Card, CardBody } from "../components/ui";
import { COMPANY } from "../config/company";
import {
  computeStatus,
  generateDemoBurials,
  generateDemoWorkOrders,
  MAP_STORAGE_KEY,
  type SectionProperties,
  statusColor,
  THRESHOLDS,
  typeLabel,
} from "../lib/cemetery-map-utils";

const MAP_CONFIG = {
  images: { east: "/maps/map_east.png", west: "/maps/map_west.png" },
  bounds: {
    east: [
      [0, 0],
      [1500, 2000],
    ] as [[number, number], [number, number]],
    west: [
      [0, 0],
      [1400, 2000],
    ] as [[number, number], [number, number]],
  },
  zoom: { min: -2, max: 3, initial: -1 },
};

type ParkKey = "east" | "west";
type Mode = "view" | "edit";

export default function CemeteryMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);
  const imageOverlayRef = useRef<L.ImageOverlay | null>(null);
  const drawControlRef = useRef<L.Control.Draw | null>(null);
  const selectedLayerRef = useRef<L.Layer | null>(null);

  const [park, setPark] = useState<ParkKey>("east");
  const parkRef = useRef<ParkKey>(park);
  parkRef.current = park;
  const [mode, setModeState] = useState<Mode>("view");
  const [selectedSection, setSelectedSection] =
    useState<SectionProperties | null>(null);
  const [polyCount, setPolyCount] = useState(0);

  const applyLayerStyle = useCallback((layer: L.Layer) => {
    const feat = (layer as L.GeoJSON & { feature?: GeoJSON.Feature }).feature;
    if (!feat?.properties) return;
    const status = computeStatus(feat.properties as SectionProperties);
    const color = statusColor(status);
    (layer as L.Polygon).setStyle({
      color,
      weight: 2,
      opacity: 0.9,
      fillColor: color,
      fillOpacity: 0.2,
    });
  }, []);

  const attachLayerEvents = useCallback(
    (layer: L.Layer, map: L.Map) => {
      const props = (layer as L.GeoJSON & { feature?: GeoJSON.Feature }).feature
        ?.properties as SectionProperties | undefined;
      if (!props) return;
      (layer as L.Polygon).bindTooltip(props.name, {
        permanent: false,
        direction: "center",
        className: "section-tooltip",
      });
      layer.on("mouseover", () => {
        if (layer !== selectedLayerRef.current) {
          (layer as L.Polygon).setStyle({ fillOpacity: 0.45, weight: 3 });
        }
        (layer as L.Polygon).openTooltip();
      });
      layer.on("mouseout", () => {
        if (layer !== selectedLayerRef.current) applyLayerStyle(layer);
        (layer as L.Polygon).closeTooltip();
      });
      layer.on("click", (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        if (mode !== "view" || !props) return;
        if (selectedLayerRef.current && selectedLayerRef.current !== layer) {
          applyLayerStyle(selectedLayerRef.current);
        }
        selectedLayerRef.current = layer;
        (layer as L.Polygon).setStyle({
          color: "#f59e0b",
          weight: 3,
          fillColor: "#f59e0b",
          fillOpacity: 0.35,
        });
        map.flyToBounds((layer as L.Polygon).getBounds(), {
          padding: [40, 40],
          duration: 0.5,
          easeLinearity: 0.5,
        });
        setSelectedSection(props);
      });
    },
    [mode, applyLayerStyle],
  );

  const loadFromStorage = useCallback(
    (map: L.Map, drawnItems: L.FeatureGroup, currentPark: ParkKey) => {
      try {
        const raw = localStorage.getItem(MAP_STORAGE_KEY(currentPark));
        if (!raw) return;
        const geoJSON = JSON.parse(raw) as GeoJSON.FeatureCollection;
        L.geoJSON(geoJSON, {
          onEachFeature: (feature, layer) => {
            (layer as L.GeoJSON & { feature?: GeoJSON.Feature }).feature =
              feature;
            drawnItems.addLayer(layer);
            applyLayerStyle(layer);
            attachLayerEvents(layer, map);
          },
        });
        setPolyCount(drawnItems.getLayers().length);
      } catch {
        setPolyCount(0);
      }
    },
    [applyLayerStyle, attachLayerEvents],
  );

  const loadPark = useCallback(
    (parkKey: ParkKey) => {
      const map = mapRef.current;
      const drawnItems = drawnItemsRef.current;
      if (!map || !drawnItems) return;
      if (imageOverlayRef.current) {
        map.removeLayer(imageOverlayRef.current);
        imageOverlayRef.current = null;
      }
      drawnItems.clearLayers();
      const bounds = MAP_CONFIG.bounds[parkKey];
      const imageUrl = MAP_CONFIG.images[parkKey];
      imageOverlayRef.current = L.imageOverlay(imageUrl, bounds, {
        opacity: 1,
      }).addTo(map);
      map.fitBounds(bounds);
      loadFromStorage(map, drawnItems, parkKey);
      setSelectedSection(null);
      selectedLayerRef.current = null;
    },
    [loadFromStorage],
  );

  useEffect(() => {
    if (!mapContainerRef.current) return;
    const map = L.map(mapContainerRef.current, {
      crs: L.CRS.Simple,
      minZoom: MAP_CONFIG.zoom.min,
      maxZoom: MAP_CONFIG.zoom.max,
      zoomControl: false,
      attributionControl: false,
    });
    L.control.zoom({ position: "topright" }).addTo(map);
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    mapRef.current = map;
    drawnItemsRef.current = drawnItems;

    const drawControl = new L.Control.Draw({
      position: "topleft",
      draw: {
        polygon: {
          allowIntersection: false,
          showArea: true,
          shapeOptions: {
            color: "#0f766e",
            fillColor: "#0f766e",
            fillOpacity: 0.25,
            weight: 2,
          },
        },
        rectangle: {
          shapeOptions: {
            color: "#0f766e",
            fillColor: "#0f766e",
            fillOpacity: 0.25,
            weight: 2,
          },
        },
        marker: false,
        circle: false,
        circlemarker: false,
        polyline: false,
      },
      edit: { featureGroup: drawnItems, remove: true },
    });
    drawControlRef.current = drawControl;

    map.on(L.Draw.Event.CREATED, (e: L.LeafletEvent & { layer: L.Layer }) => {
      const layer = e.layer;
      const currentPark = parkRef.current;
      const editName = document.getElementById(
        "editName",
      ) as HTMLInputElement | null;
      const editType = document.getElementById(
        "editType",
      ) as HTMLSelectElement | null;
      const editCapacity = document.getElementById(
        "editCapacity",
      ) as HTMLInputElement | null;
      const editOccupied = document.getElementById(
        "editOccupied",
      ) as HTMLInputElement | null;
      const name =
        editName?.value.trim() ||
        `Section ${drawnItems.getLayers().length + 1}`;
      const type = editType?.value ?? "standard";
      const capacity = parseInt(editCapacity?.value ?? "0", 10) || 0;
      const occupied = parseInt(editOccupied?.value ?? "0", 10) || 0;
      const props: SectionProperties = {
        id: `${currentPark.toUpperCase()}-${Date.now()}`,
        name,
        type,
        capacity,
        occupied,
        park: currentPark,
      };
      (layer as L.GeoJSON & { feature?: GeoJSON.Feature }).feature = {
        type: "Feature",
        properties: props,
        geometry: null,
      };
      drawnItems.addLayer(layer);
      applyLayerStyle(layer);
      attachLayerEvents(layer, map);
      setPolyCount(drawnItems.getLayers().length);
      if (editName) editName.value = "";
      if (editCapacity) editCapacity.value = "";
      if (editOccupied) editOccupied.value = "";
    });
    map.on(
      L.Draw.Event.EDITED,
      (e: L.LeafletEvent & { layers: L.LayerGroup }) => {
        e.layers.eachLayer((l) => applyLayerStyle(l));
      },
    );
    map.on(L.Draw.Event.DELETED, () =>
      setPolyCount(drawnItems.getLayers().length),
    );

    loadPark("east");
    return () => {
      map.remove();
      mapRef.current = null;
      drawnItemsRef.current = null;
      imageOverlayRef.current = null;
      drawControlRef.current = null;
    };
  }, []);

  useEffect(() => {
    loadPark(park);
  }, [park, loadPark]);

  useEffect(() => {
    const map = mapRef.current;
    const ctrl = drawControlRef.current;
    if (!map || !ctrl) return;
    if (mode === "edit") {
      map.addControl(ctrl);
    } else {
      try {
        map.removeControl(ctrl);
      } catch {
        // ignore
      }
    }
  }, [mode]);

  const setMode = (m: Mode) => setModeState(m);
  const switchPark = (p: ParkKey) => setPark(p);

  const saveToLocal = () => {
    const drawnItems = drawnItemsRef.current;
    if (!drawnItems) return;
    const geoJSON = drawnItems.toGeoJSON();
    const key = MAP_STORAGE_KEY(park);
    localStorage.setItem(key, JSON.stringify(geoJSON));
    alert(
      `Saved ${(geoJSON as GeoJSON.FeatureCollection).features?.length ?? 0} section(s) for ${park === "east" ? "East" : "West"} park.`,
    );
  };

  const exportJSON = () => {
    const drawnItems = drawnItemsRef.current;
    if (!drawnItems) return;
    const geoJSON = drawnItems.toGeoJSON();
    const blob = new Blob([JSON.stringify(geoJSON, null, 2)], {
      type: "application/geo+json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dmp_${park}_sections.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

  const clearAll = () => {
    if (
      !window.confirm(
        `Delete ALL sections for ${park === "east" ? "East" : "West"}? This cannot be undone.`,
      )
    )
      return;
    drawnItemsRef.current?.clearLayers();
    localStorage.removeItem(MAP_STORAGE_KEY(park));
    setPolyCount(0);
    setSelectedSection(null);
    selectedLayerRef.current = null;
  };

  const locationLabel = park === "east" ? "Warren, MI" : "Redford, MI";
  const capacity = selectedSection?.capacity ?? 0;
  const occupied = selectedSection?.occupied ?? 0;
  const available = Math.max(0, capacity - occupied);
  const pct = capacity > 0 ? Math.round((occupied / capacity) * 100) : 0;
  const status = selectedSection ? computeStatus(selectedSection) : "";

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-background">
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <MapPin className="text-white" size={22} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Cemetery Map</h1>
            <p className="text-xs text-foreground-muted">
              {COMPANY.shortName} · 1926–2026
            </p>
          </div>
        </div>
        <div className="flex rounded-full border border-border p-1 bg-muted/50">
          <button
            type="button"
            onClick={() => setMode("view")}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${mode === "view" ? "bg-primary text-primary-foreground" : "text-foreground-muted hover:text-foreground"}`}
          >
            <Eye size={16} className="align-middle" />
            Visitor View
          </button>
          <button
            type="button"
            onClick={() => setMode("edit")}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${mode === "edit" ? "bg-primary text-primary-foreground" : "text-foreground-muted hover:text-foreground"}`}
          >
            <Pencil size={16} className="align-middle" />
            Editor Mode
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <div
          ref={mapContainerRef}
          role="application"
          className="flex-1 bg-muted"
          aria-label="Cemetery section map"
        />
        <aside className="w-[380px] flex-shrink-0 border-l border-border bg-card flex flex-col shadow-lg">
          <div className="flex border-b border-border">
            <button
              type="button"
              onClick={() => switchPark("east")}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${park === "east" ? "text-primary border-b-2 border-primary bg-background" : "text-foreground-muted bg-muted/30 hover:bg-muted/50"}`}
            >
              East (Warren)
            </button>
            <button
              type="button"
              onClick={() => switchPark("west")}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${park === "west" ? "text-primary border-b-2 border-primary bg-background" : "text-foreground-muted bg-muted/30 hover:bg-muted/50"}`}
            >
              West (Redford)
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {mode === "edit" && (
              <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
                <CardBody className="p-4 space-y-3">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    <strong>Editor Mode:</strong> Use the toolbar on the map to
                    draw rectangles or polygons. Fill in the name below, then
                    draw and click Save Work.
                  </p>
                  <div className="space-y-1">
                    <label
                      htmlFor="editName"
                      className="block text-xs font-bold uppercase text-foreground-muted"
                    >
                      Section Name
                    </label>
                    <input
                      id="editName"
                      type="text"
                      placeholder="e.g. Garden of Peace"
                      aria-label="Section name"
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label
                      htmlFor="editType"
                      className="block text-xs font-bold uppercase text-foreground-muted"
                    >
                      Section Type
                    </label>
                    <select
                      id="editType"
                      aria-label="Section type"
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                    >
                      <option value="standard">Standard Burial</option>
                      <option value="garden">Named Garden</option>
                      <option value="mausoleum">Mausoleum</option>
                      <option value="special">Special / Infrastructure</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label
                        htmlFor="editCapacity"
                        className="block text-xs font-bold uppercase text-foreground-muted"
                      >
                        Capacity
                      </label>
                      <input
                        id="editCapacity"
                        type="number"
                        min={0}
                        placeholder="400"
                        aria-label="Total plot capacity"
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label
                        htmlFor="editOccupied"
                        className="block text-xs font-bold uppercase text-foreground-muted"
                      >
                        Occupied
                      </label>
                      <input
                        id="editOccupied"
                        type="number"
                        min={0}
                        placeholder="312"
                        aria-label="Current occupied plots"
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={exportJSON}
                    >
                      <Download size={14} />
                      Export JSON
                    </Button>
                    <Button size="sm" className="flex-1" onClick={saveToLocal}>
                      <Save size={14} />
                      Save Work
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="danger"
                      size="sm"
                      className="flex-1"
                      onClick={clearAll}
                    >
                      <Trash2 size={14} className="mr-1" />
                      Clear All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1"
                      onClick={() =>
                        document.getElementById("importFile")?.click()
                      }
                    >
                      <Upload size={14} />
                      Import JSON
                    </Button>
                  </div>
                  <input
                    id="importFile"
                    type="file"
                    accept=".json"
                    className="hidden"
                    aria-label="Import GeoJSON file"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file || !drawnItemsRef.current) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        try {
                          const geoJSON = JSON.parse(
                            ev.target?.result as string,
                          ) as GeoJSON.FeatureCollection;
                          const map = mapRef.current;
                          if (!map) return;
                          L.geoJSON(geoJSON, {
                            onEachFeature: (feature, layer) => {
                              (
                                layer as L.GeoJSON & {
                                  feature?: GeoJSON.Feature;
                                }
                              ).feature = feature;
                              drawnItemsRef.current?.addLayer(layer);
                              applyLayerStyle(layer);
                              attachLayerEvents(layer, map);
                            },
                          });
                          setPolyCount(
                            drawnItemsRef.current?.getLayers().length ?? 0,
                          );
                          alert(
                            `Imported ${geoJSON.features?.length ?? 0} section(s).`,
                          );
                        } catch {
                          alert("Invalid GeoJSON file.");
                        }
                      };
                      reader.readAsText(file);
                      e.target.value = "";
                    }}
                  />
                  <p className="text-center text-xs text-foreground-muted">
                    <strong className="text-primary">{polyCount}</strong>{" "}
                    sections defined
                  </p>
                </CardBody>
              </Card>
            )}

            {mode === "view" && (
              <div className="space-y-4">
                {!selectedSection ? (
                  <div className="flex flex-col items-center gap-3 py-12 text-foreground-muted text-center">
                    <MapPin size={48} className="opacity-40" />
                    <p className="text-sm">
                      Click any section on the map to view capacity, burials,
                      and work orders.
                    </p>
                  </div>
                ) : (
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold uppercase ${status === "Available"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
                            : status === "Low Stock"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
                              : status === "Full"
                                ? "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200"
                                : "bg-muted text-foreground-muted"
                          }`}
                      >
                        {status}
                      </span>
                      <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-muted text-foreground-muted">
                        {typeLabel(selectedSection.type)}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-foreground">
                      {selectedSection.name}
                    </h2>
                    <p className="text-sm text-foreground-muted">
                      {locationLabel}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg border border-border p-3 bg-muted/30">
                        <div className="text-xs font-bold uppercase text-foreground-muted">
                          Total Plots
                        </div>
                        <div className="text-lg font-bold text-foreground">
                          {capacity > 0 ? capacity.toLocaleString() : "—"}
                        </div>
                      </div>
                      <div className="rounded-lg border border-border p-3 bg-muted/30">
                        <div className="text-xs font-bold uppercase text-foreground-muted">
                          Occupied
                        </div>
                        <div className="text-lg font-bold text-foreground">
                          {capacity > 0 ? `${pct}%` : "—"}
                        </div>
                      </div>
                      <div className="rounded-lg border border-border p-3 bg-muted/30">
                        <div className="text-xs font-bold uppercase text-foreground-muted">
                          Available
                        </div>
                        <div className="text-lg font-bold text-foreground">
                          {capacity > 0 ? available.toLocaleString() : "—"}
                        </div>
                      </div>
                      <div className="rounded-lg border border-border p-3 bg-muted/30">
                        <div className="text-xs font-bold uppercase text-foreground-muted">
                          Status
                        </div>
                        <div className="text-lg font-bold text-foreground">
                          {status}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-foreground-muted">
                        <span>Capacity Usage</span>
                        <span>
                          {capacity > 0
                            ? `${occupied.toLocaleString()} / ${capacity.toLocaleString()}`
                            : "—"}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(pct, 100)}%`,
                            backgroundColor: statusColor(status),
                          }}
                          role="progressbar"
                          aria-valuenow={pct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase text-foreground-muted">
                        Active Work Orders
                      </p>
                      <div className="space-y-2">
                        {generateDemoWorkOrders(selectedSection.id).length ===
                          0 ? (
                          <p className="text-sm text-foreground-muted">
                            No active work orders.
                          </p>
                        ) : (
                          generateDemoWorkOrders(selectedSection.id).map(
                            (wo) => (
                              <div
                                key={wo.id}
                                className="flex items-center justify-between py-2 border-b border-border last:border-0 text-sm"
                              >
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`w-2 h-2 rounded-full ${wo.open ? "bg-red-500" : "bg-emerald-500"}`}
                                  />
                                  <div>
                                    <div className="font-medium">
                                      {wo.description}
                                    </div>
                                    <div className="text-xs text-foreground-muted">
                                      Ticket #{wo.id}
                                    </div>
                                  </div>
                                </div>
                                <span
                                  className={`text-xs font-semibold ${wo.open ? "text-red-600" : "text-emerald-600"}`}
                                >
                                  {wo.open ? "Open" : "Done"}
                                </span>
                              </div>
                            ),
                          )
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase text-foreground-muted">
                        Recent Interments (2025–2026)
                      </p>
                      <div className="space-y-2">
                        {capacity > 0 &&
                          generateDemoBurials(selectedSection.id).length > 0 ? (
                          generateDemoBurials(selectedSection.id).map(
                            (b, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between py-2 border-b border-border last:border-0 text-sm"
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-foreground-muted" />
                                  <div>
                                    <div className="font-medium">{b.name}</div>
                                    <div className="text-xs text-foreground-muted">
                                      Plot {b.plot}
                                    </div>
                                  </div>
                                </div>
                                <span className="text-xs text-foreground-muted">
                                  {b.date}
                                </span>
                              </div>
                            ),
                          )
                        ) : (
                          <p className="text-sm text-foreground-muted">
                            No records in this demo.
                          </p>
                        )}
                      </div>
                    </div>
                    <Button className="w-full" size="sm">
                      View Full Plot Grid →
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
