import { useState, useMemo, lazy, Suspense } from 'react';
import {
  useCemeteries, useCreateCemetery, useUpdateCemetery, useDeleteCemetery,
  useSections, useCreateSection, useUpdateSection, useDeleteSection,
  useLots, useCreateLot, useUpdateLot, useDeleteLot,
  useGraves, useCreateGrave, useUpdateGrave, useDeleteGrave,
} from '../hooks/useData';
import type { Cemetery, Section, Lot, Grave } from '../types';
import {
  Card, CardBody, Button, Modal, Input, Select, Textarea,
  Badge, EmptyState, PageError, ConfirmDialog, Skeleton, SkeletonTable,
  TABLE_HEAD_CLASS } from '../components/ui';
import { m, EASE_LUX } from '../lib/motion';
const CemeteryMap = lazy(() => import('../components/CemeteryMap'));
import {
  Plus, Map, ChevronRight, ArrowLeft, Edit, Trash2,
  RefreshCw, MapPin, Loader2, Building2,
} from 'lucide-react';

// ────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ────────────────────────────────────────────────────────────────────────────

const GRAVE_STATUS_VARIANT: Record<Grave['status'], 'success' | 'warning' | 'danger' | 'secondary'> = {
  available: 'success',
  reserved: 'warning',
  occupied: 'danger',
  unavailable: 'secondary',
};

/** Skeleton placeholder matching the cemetery/section card grids. */
function SkeletonCardGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i}>
          <CardBody>
            <div className="flex items-start gap-3">
              <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

/** What a delete confirmation is aimed at, across all four drill-down levels. */
type DeleteTarget = { kind: 'cemetery' | 'section' | 'lot' | 'grave'; id: string; name: string };

// ────────────────────────────────────────────────────────────────────────────
// Cemetery CRUD forms
// ────────────────────────────────────────────────────────────────────────────

type CemeteryForm = { name: string; address: string; city: string; state: string; zip: string; phone: string; notes: string; };
const emptyCemeteryForm: CemeteryForm = { name: '', address: '', city: '', state: '', zip: '', phone: '', notes: '' };

type SectionForm = { name: string; description: string; capacity: string; };
const emptySectionForm: SectionForm = { name: '', description: '', capacity: '' };

type LotForm = { lotNumber: string; description: string; };
const emptyLotForm: LotForm = { lotNumber: '', description: '' };

type GraveForm = { graveNumber: string; status: Grave['status']; lat: string; lng: string; notes: string; };
const emptyGraveForm: GraveForm = { graveNumber: '', status: 'available', lat: '', lng: '', notes: '' };

// ────────────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────────────

export default function Cemeteries() {
  const cemeteriesQuery = useCemeteries();
  const cemeteries = cemeteriesQuery.data ?? [];

  // Drill-down state
  const [selectedCemetery, setSelectedCemetery] = useState<Cemetery | null>(null);
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);

  // Level queries (enabled when parent is selected)
  const sectionsQuery = useSections(selectedCemetery?.id ?? '');
  const lotsQuery = useLots(selectedSection?.id ?? '');
  const gravesQuery = useGraves(selectedLot?.id ?? '');

  const sections = sectionsQuery.data ?? [];
  const lots = lotsQuery.data ?? [];
  const graves = gravesQuery.data ?? [];

  // Cemetery CRUD
  const [showCemeteryModal, setShowCemeteryModal] = useState(false);
  const [editingCemetery, setEditingCemetery] = useState<Cemetery | null>(null);
  const [cemeteryForm, setCemeteryForm] = useState<CemeteryForm>(emptyCemeteryForm);
  const createCemetery = useCreateCemetery({ onSuccess: () => { setShowCemeteryModal(false); setCemeteryForm(emptyCemeteryForm); } });
  const updateCemetery = useUpdateCemetery({ onSuccess: () => { setShowCemeteryModal(false); setEditingCemetery(null); setCemeteryForm(emptyCemeteryForm); } });
  const deleteCemetery = useDeleteCemetery();

  // Section CRUD
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [sectionForm, setSectionForm] = useState<SectionForm>(emptySectionForm);
  const createSection = useCreateSection({ onSuccess: () => { setShowSectionModal(false); setSectionForm(emptySectionForm); } });
  const updateSection = useUpdateSection({ onSuccess: () => { setShowSectionModal(false); setEditingSection(null); setSectionForm(emptySectionForm); } });
  const deleteSection = useDeleteSection();

  // Lot CRUD
  const [showLotModal, setShowLotModal] = useState(false);
  const [editingLot, setEditingLot] = useState<Lot | null>(null);
  const [lotForm, setLotForm] = useState<LotForm>(emptyLotForm);
  const createLot = useCreateLot({ onSuccess: () => { setShowLotModal(false); setLotForm(emptyLotForm); } });
  const updateLot = useUpdateLot({ onSuccess: () => { setShowLotModal(false); setEditingLot(null); setLotForm(emptyLotForm); } });
  const deleteLot = useDeleteLot();

  // Grave CRUD
  const [showGraveModal, setShowGraveModal] = useState(false);
  const [editingGrave, setEditingGrave] = useState<Grave | null>(null);
  const [graveForm, setGraveForm] = useState<GraveForm>(emptyGraveForm);
  const [gpsState, setGpsState] = useState<{ status: 'idle' | 'capturing' | 'error' | 'success'; message?: string }>({ status: 'idle' });
  const createGrave = useCreateGrave({ onSuccess: () => { setShowGraveModal(false); setGraveForm(emptyGraveForm); setGpsState({ status: 'idle' }); } });
  const updateGrave = useUpdateGrave({ onSuccess: () => { setShowGraveModal(false); setEditingGrave(null); setGraveForm(emptyGraveForm); setGpsState({ status: 'idle' }); } });

  const captureGps = () => {
    if (!('geolocation' in navigator)) {
      setGpsState({ status: 'error', message: 'Geolocation not supported on this device' });
      return;
    }
    setGpsState({ status: 'capturing' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGraveForm(p => ({
          ...p,
          lat: pos.coords.latitude.toFixed(7),
          lng: pos.coords.longitude.toFixed(7),
        }));
        const accuracy = Math.round(pos.coords.accuracy);
        setGpsState({ status: 'success', message: `Captured (±${accuracy}m accuracy)` });
      },
      (err) => {
        const messages: Record<number, string> = {
          1: 'Location permission denied — enable it in browser settings',
          2: 'Location unavailable — check GPS signal',
          3: 'Location request timed out',
        };
        setGpsState({ status: 'error', message: messages[err.code] ?? err.message });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };
  const deleteGrave = useDeleteGrave();

  const queryError = cemeteriesQuery.error || sectionsQuery.error || lotsQuery.error || gravesQuery.error;

  // Delete confirmation (shared across all four levels)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const deletePending =
    deleteCemetery.isPending || deleteSection.isPending || deleteLot.isPending || deleteGrave.isPending;

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    const options = { onSuccess: () => setDeleteTarget(null) };
    if (deleteTarget.kind === 'cemetery') deleteCemetery.mutate(deleteTarget.id, options);
    else if (deleteTarget.kind === 'section') deleteSection.mutate(deleteTarget.id, options);
    else if (deleteTarget.kind === 'lot') deleteLot.mutate(deleteTarget.id, options);
    else deleteGrave.mutate(deleteTarget.id, options);
  };

  const graveStatusCounts = useMemo(() => ({
    available: graves.filter(g => g.status === 'available').length,
    reserved: graves.filter(g => g.status === 'reserved').length,
    occupied: graves.filter(g => g.status === 'occupied').length,
    unavailable: graves.filter(g => g.status === 'unavailable').length,
  }), [graves]);

  // Navigate back helpers
  const goToCemeteries = () => { setSelectedCemetery(null); setSelectedSection(null); setSelectedLot(null); };
  const goToSections = () => { setSelectedSection(null); setSelectedLot(null); };
  const goToLots = () => { setSelectedLot(null); };

  // Breadcrumb level
  const level = selectedLot ? 'graves' : selectedSection ? 'lots' : selectedCemetery ? 'sections' : 'cemeteries';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Cemeteries</h1>
          <p className="text-foreground-muted mt-1">Plot and grave inventory — cemetery → section → lot → grave</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCw size={16} className={cemeteriesQuery.isLoading ? 'animate-spin' : ''} />}
            onClick={() => cemeteriesQuery.refetch()}
          >
            Refresh
          </Button>
          {level === 'cemeteries' && (
            <Button variant="primary" icon={<Plus size={20} />} onClick={() => { setCemeteryForm(emptyCemeteryForm); setEditingCemetery(null); setShowCemeteryModal(true); }}>
              New Cemetery
            </Button>
          )}
          {level === 'sections' && (
            <Button variant="primary" icon={<Plus size={20} />} onClick={() => { setSectionForm(emptySectionForm); setEditingSection(null); setShowSectionModal(true); }}>
              New Section
            </Button>
          )}
          {level === 'lots' && (
            <Button variant="primary" icon={<Plus size={20} />} onClick={() => { setLotForm(emptyLotForm); setEditingLot(null); setShowLotModal(true); }}>
              New Lot
            </Button>
          )}
          {level === 'graves' && (
            <Button variant="primary" icon={<Plus size={20} />} onClick={() => { setGraveForm(emptyGraveForm); setEditingGrave(null); setShowGraveModal(true); }}>
              New Grave
            </Button>
          )}
        </div>
      </div>

      {/* Error */}
      <PageError error={queryError} />

      {/* Breadcrumb */}
      {level !== 'cemeteries' && (
        <div className="flex items-center gap-2 text-sm">
          <button onClick={goToCemeteries} className="flex items-center gap-1 text-primary hover:text-primary-hover">
            <Building2 size={14} />
            All cemeteries
          </button>
          {selectedCemetery && (
            <>
              <ChevronRight size={14} className="text-foreground-muted" />
              {selectedSection ? (
                <button onClick={goToSections} className="text-primary hover:text-primary-hover">{selectedCemetery.name}</button>
              ) : (
                <span className="font-medium text-foreground">{selectedCemetery.name}</span>
              )}
            </>
          )}
          {selectedSection && (
            <>
              <ChevronRight size={14} className="text-foreground-muted" />
              {selectedLot ? (
                <button onClick={goToLots} className="text-primary hover:text-primary-hover">Section: {selectedSection.name}</button>
              ) : (
                <span className="font-medium text-foreground">Section: {selectedSection.name}</span>
              )}
            </>
          )}
          {selectedLot && (
            <>
              <ChevronRight size={14} className="text-foreground-muted" />
              <span className="font-medium text-foreground">Lot: {selectedLot.lotNumber}</span>
            </>
          )}
        </div>
      )}

      {/* ── Level content (animates on drill-down / drill-up) ── */}
      <m.div
        key={selectedLot?.id ?? selectedSection?.id ?? selectedCemetery?.id ?? 'root'}
        initial={{ opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2, ease: EASE_LUX }}
        className="space-y-6"
      >
      {/* ── Level: Cemeteries ── */}
      {level === 'cemeteries' && (
        <>
          {cemeteriesQuery.isLoading ? (
            <SkeletonCardGrid />
          ) : cemeteries.length === 0 ? (
            <Card>
              <CardBody>
                <EmptyState
                  icon={<Map size={48} />}
                  title="No cemeteries yet"
                  description="Add your cemetery locations to start managing plots and graves"
                  action={<Button variant="primary" icon={<Plus size={20} />} onClick={() => setShowCemeteryModal(true)}>Add Cemetery</Button>}
                />
              </CardBody>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cemeteries.map(c => (
                <Card key={c.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardBody>
                    <button className="w-full text-left" onClick={() => setSelectedCemetery(c)}>
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-primary-100 dark:bg-primary-950 rounded-lg shrink-0">
                          <Map size={20} className="text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground truncate">{c.name}</p>
                          {c.address && <p className="text-sm text-foreground-muted truncate">{[c.address, c.city, c.state].filter(Boolean).join(', ')}</p>}
                          {c.phone && <p className="text-xs text-foreground-muted mt-1">{c.phone}</p>}
                        </div>
                        <ChevronRight size={16} className="text-foreground-muted shrink-0 mt-0.5" />
                      </div>
                    </button>
                    <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-border">
                      <button onClick={(e) => { e.stopPropagation(); setEditingCemetery(c); setCemeteryForm({ name: c.name, address: c.address ?? '', city: c.city ?? '', state: c.state ?? '', zip: c.zip ?? '', phone: c.phone ?? '', notes: c.notes ?? '' }); setShowCemeteryModal(true); }} className="text-primary hover:text-primary-hover" aria-label="Edit"><Edit size={16} /></button>
                      <button onClick={(e) => { e.stopPropagation(); setDeleteTarget({ kind: 'cemetery', id: c.id, name: c.name }); }} className="text-danger hover:text-danger-hover" aria-label="Delete"><Trash2 size={16} /></button>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Level: Sections ── */}
      {level === 'sections' && (
        <>
          <button onClick={goToCemeteries} className="flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground">
            <ArrowLeft size={14} /> Back to cemeteries
          </button>
          {sectionsQuery.isLoading ? (
            <SkeletonCardGrid />
          ) : sections.length === 0 ? (
            <Card>
              <CardBody>
                <EmptyState
                  icon={<Map size={48} />}
                  title="No sections yet"
                  description="Add sections to organize this cemetery's plots"
                  action={<Button variant="primary" icon={<Plus size={20} />} onClick={() => setShowSectionModal(true)}>Add Section</Button>}
                />
              </CardBody>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sections.map(s => (
                <Card key={s.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardBody>
                    <button className="w-full text-left" onClick={() => setSelectedSection(s)}>
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-info-100 dark:bg-info-950 rounded-lg shrink-0">
                          <Map size={20} className="text-info" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground">{s.name}</p>
                          {s.description && <p className="text-sm text-foreground-muted">{s.description}</p>}
                          {s.capacity != null && (
                            <p className="text-xs text-foreground-muted mt-1">Capacity: {s.capacity} graves</p>
                          )}
                        </div>
                        <ChevronRight size={16} className="text-foreground-muted shrink-0 mt-0.5" />
                      </div>
                    </button>
                    <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-border">
                      <button onClick={(e) => { e.stopPropagation(); setEditingSection(s); setSectionForm({ name: s.name, description: s.description ?? '', capacity: s.capacity != null ? String(s.capacity) : '' }); setShowSectionModal(true); }} className="text-primary hover:text-primary-hover" aria-label="Edit"><Edit size={16} /></button>
                      <button onClick={(e) => { e.stopPropagation(); setDeleteTarget({ kind: 'section', id: s.id, name: s.name }); }} className="text-danger hover:text-danger-hover" aria-label="Delete"><Trash2 size={16} /></button>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Level: Lots ── */}
      {level === 'lots' && (
        <>
          <button onClick={goToSections} className="flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground">
            <ArrowLeft size={14} /> Back to sections
          </button>
          {lotsQuery.isLoading ? (
            <SkeletonTable rows={6} cols={3} />
          ) : lots.length === 0 ? (
            <Card>
              <CardBody>
                <EmptyState
                  icon={<Map size={48} />}
                  title="No lots yet"
                  description="Add lots to this section to start adding individual graves"
                  action={<Button variant="primary" icon={<Plus size={20} />} onClick={() => setShowLotModal(true)}>Add Lot</Button>}
                />
              </CardBody>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-background-subtle border-b border-border">
                    <tr>
                      <th className={TABLE_HEAD_CLASS}>Lot #</th>
                      <th className={TABLE_HEAD_CLASS}>Description</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-foreground-muted uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {lots.map(lot => (
                      <tr key={lot.id} className="hover:bg-accent/40 transition-colors cursor-pointer" onClick={() => setSelectedLot(lot)}>
                        <td className="px-6 py-4 font-mono font-medium text-foreground">{lot.lotNumber}</td>
                        <td className="px-6 py-4 text-foreground-muted">{lot.description || '—'}</td>
                        <td className="px-6 py-4 text-right space-x-2" onClick={e => e.stopPropagation()}>
                          <button onClick={() => { setEditingLot(lot); setLotForm({ lotNumber: lot.lotNumber, description: lot.description ?? '' }); setShowLotModal(true); }} className="text-primary hover:text-primary-hover" aria-label="Edit"><Edit size={16} /></button>
                          <button onClick={() => setDeleteTarget({ kind: 'lot', id: lot.id, name: `Lot ${lot.lotNumber}` })} className="text-danger hover:text-danger-hover" aria-label="Delete"><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ── Level: Graves ── */}
      {level === 'graves' && (
        <>
          <button onClick={goToLots} className="flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground">
            <ArrowLeft size={14} /> Back to lots
          </button>
          {/* Status summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(['available', 'reserved', 'occupied', 'unavailable'] as Grave['status'][]).map(status => (
              <Card key={status}>
                <CardBody className="py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-foreground-muted capitalize">{status}</p>
                    <Badge variant={GRAVE_STATUS_VARIANT[status]} size="sm">{graveStatusCounts[status]}</Badge>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
          {/* Map of placed graves (lazy-loaded — maplibre-gl is ~1MB) */}
          {graves.length > 0 && (
            <Card>
              <CardBody className="p-3">
                <Suspense fallback={<Skeleton className="h-[360px] w-full rounded-lg" />}>
                  <CemeteryMap
                    graves={graves}
                    height={360}
                    onMapPinDrop={(coords) => {
                      setEditingGrave(null);
                      setGraveForm({
                        ...emptyGraveForm,
                        lat: coords.lat.toFixed(7),
                        lng: coords.lng.toFixed(7),
                      });
                      setShowGraveModal(true);
                    }}
                  />
                </Suspense>
              </CardBody>
            </Card>
          )}
          {gravesQuery.isLoading ? (
            <SkeletonTable rows={6} cols={5} />
          ) : graves.length === 0 ? (
            <Card>
              <CardBody>
                <EmptyState
                  icon={<Map size={48} />}
                  title="No graves yet"
                  description="Add individual grave spaces to this lot"
                  action={<Button variant="primary" icon={<Plus size={20} />} onClick={() => setShowGraveModal(true)}>Add Grave</Button>}
                />
              </CardBody>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-background-subtle border-b border-border">
                    <tr>
                      <th className={TABLE_HEAD_CLASS}>Grave #</th>
                      <th className={TABLE_HEAD_CLASS}>Status</th>
                      <th className={TABLE_HEAD_CLASS}>Coordinates</th>
                      <th className={TABLE_HEAD_CLASS}>Notes</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-foreground-muted uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {graves.map(g => (
                      <tr key={g.id} className="hover:bg-accent/40 transition-colors">
                        <td className="px-6 py-4 font-mono font-medium text-foreground">{g.graveNumber}</td>
                        <td className="px-6 py-4">
                          <Badge variant={GRAVE_STATUS_VARIANT[g.status]} size="sm">
                            {g.status.charAt(0).toUpperCase() + g.status.slice(1)}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-foreground-muted text-xs font-mono">
                          {g.lat != null && g.lng != null ? `${g.lat}, ${g.lng}` : '—'}
                        </td>
                        <td className="px-6 py-4 text-foreground-muted">{g.notes || '—'}</td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button onClick={() => { setEditingGrave(g); setGraveForm({ graveNumber: g.graveNumber, status: g.status, lat: g.lat != null ? String(g.lat) : '', lng: g.lng != null ? String(g.lng) : '', notes: g.notes ?? '' }); setShowGraveModal(true); }} className="text-primary hover:text-primary-hover" aria-label="Edit"><Edit size={16} /></button>
                          <button onClick={() => setDeleteTarget({ kind: 'grave', id: g.id, name: `Grave ${g.graveNumber}` })} className="text-danger hover:text-danger-hover" aria-label="Delete"><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
      </m.div>

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title={deleteTarget ? `Delete ${deleteTarget.kind.charAt(0).toUpperCase() + deleteTarget.kind.slice(1)}` : 'Delete'}
        loading={deletePending}
        message={deleteTarget ? (
          <>
            Delete {deleteTarget.kind} <span className="font-medium">{deleteTarget.name}</span>?
            This cannot be undone.
          </>
        ) : null}
      />

      {/* ═══ Modals ═══ */}

      {/* Cemetery Modal */}
      <Modal
        isOpen={showCemeteryModal}
        onClose={() => { setShowCemeteryModal(false); setEditingCemetery(null); }}
        title={editingCemetery ? 'Edit Cemetery' : 'New Cemetery'}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCemeteryModal(false)}>Cancel</Button>
            <Button
              variant="primary"
              loading={createCemetery.isPending || updateCemetery.isPending}
              onClick={() => {
                const data = { name: cemeteryForm.name, address: cemeteryForm.address || undefined, city: cemeteryForm.city || undefined, state: cemeteryForm.state || undefined, zip: cemeteryForm.zip || undefined, phone: cemeteryForm.phone || undefined, notes: cemeteryForm.notes || undefined };
                if (editingCemetery) updateCemetery.mutate({ id: editingCemetery.id, ...data });
                else createCemetery.mutate(data as Omit<Cemetery, 'id' | 'createdAt' | 'updatedAt'>);
              }}
            >
              {editingCemetery ? 'Save' : 'Add Cemetery'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Cemetery Name" value={cemeteryForm.name} onChange={e => setCemeteryForm(p => ({ ...p, name: e.target.value }))} required />
          <Input label="Address" value={cemeteryForm.address} onChange={e => setCemeteryForm(p => ({ ...p, address: e.target.value }))} />
          <div className="grid grid-cols-3 gap-4">
            <Input label="City" value={cemeteryForm.city} onChange={e => setCemeteryForm(p => ({ ...p, city: e.target.value }))} />
            <Input label="State" value={cemeteryForm.state} onChange={e => setCemeteryForm(p => ({ ...p, state: e.target.value }))} />
            <Input label="ZIP" value={cemeteryForm.zip} onChange={e => setCemeteryForm(p => ({ ...p, zip: e.target.value }))} />
          </div>
          <Input label="Phone" type="tel" value={cemeteryForm.phone} onChange={e => setCemeteryForm(p => ({ ...p, phone: e.target.value }))} />
          <Textarea label="Notes" value={cemeteryForm.notes} onChange={e => setCemeteryForm(p => ({ ...p, notes: e.target.value }))} rows={2} />
        </div>
      </Modal>

      {/* Section Modal */}
      <Modal
        isOpen={showSectionModal}
        onClose={() => { setShowSectionModal(false); setEditingSection(null); }}
        title={editingSection ? 'Edit Section' : 'New Section'}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowSectionModal(false)}>Cancel</Button>
            <Button
              variant="primary"
              loading={createSection.isPending || updateSection.isPending}
              onClick={() => {
                if (!selectedCemetery) return;
                const data = { cemeteryId: selectedCemetery.id, name: sectionForm.name, description: sectionForm.description || undefined, capacity: sectionForm.capacity ? parseInt(sectionForm.capacity) : undefined };
                if (editingSection) updateSection.mutate({ id: editingSection.id, ...data });
                else createSection.mutate(data as Omit<Section, 'id' | 'createdAt' | 'updatedAt'>);
              }}
            >
              {editingSection ? 'Save' : 'Add Section'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Section Name" placeholder="e.g. Garden of Peace, Section A" value={sectionForm.name} onChange={e => setSectionForm(p => ({ ...p, name: e.target.value }))} required />
          <Input label="Description" value={sectionForm.description} onChange={e => setSectionForm(p => ({ ...p, description: e.target.value }))} />
          <Input label="Capacity (graves)" type="number" min="0" value={sectionForm.capacity} onChange={e => setSectionForm(p => ({ ...p, capacity: e.target.value }))} />
        </div>
      </Modal>

      {/* Lot Modal */}
      <Modal
        isOpen={showLotModal}
        onClose={() => { setShowLotModal(false); setEditingLot(null); }}
        title={editingLot ? 'Edit Lot' : 'New Lot'}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowLotModal(false)}>Cancel</Button>
            <Button
              variant="primary"
              loading={createLot.isPending || updateLot.isPending}
              onClick={() => {
                if (!selectedSection) return;
                const data = { sectionId: selectedSection.id, lotNumber: lotForm.lotNumber, description: lotForm.description || undefined };
                if (editingLot) updateLot.mutate({ id: editingLot.id, ...data });
                else createLot.mutate(data as Omit<Lot, 'id' | 'createdAt' | 'updatedAt'>);
              }}
            >
              {editingLot ? 'Save' : 'Add Lot'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Lot Number" placeholder="e.g. 14, 14A" value={lotForm.lotNumber} onChange={e => setLotForm(p => ({ ...p, lotNumber: e.target.value }))} required />
          <Input label="Description" value={lotForm.description} onChange={e => setLotForm(p => ({ ...p, description: e.target.value }))} />
        </div>
      </Modal>

      {/* Grave Modal */}
      <Modal
        isOpen={showGraveModal}
        onClose={() => { setShowGraveModal(false); setEditingGrave(null); }}
        title={editingGrave ? 'Edit Grave' : 'New Grave'}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowGraveModal(false)}>Cancel</Button>
            <Button
              variant="primary"
              loading={createGrave.isPending || updateGrave.isPending}
              onClick={() => {
                if (!selectedLot) return;
                const data = { lotId: selectedLot.id, graveNumber: graveForm.graveNumber, status: graveForm.status, lat: graveForm.lat ? parseFloat(graveForm.lat) : undefined, lng: graveForm.lng ? parseFloat(graveForm.lng) : undefined, notes: graveForm.notes || undefined };
                if (editingGrave) updateGrave.mutate({ id: editingGrave.id, ...data });
                else createGrave.mutate(data as Omit<Grave, 'id' | 'createdAt' | 'updatedAt'>);
              }}
            >
              {editingGrave ? 'Save' : 'Add Grave'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Grave Number" placeholder="e.g. 1, 2" value={graveForm.graveNumber} onChange={e => setGraveForm(p => ({ ...p, graveNumber: e.target.value }))} required />
            <Select
              label="Status"
              options={[
                { value: 'available', label: 'Available' },
                { value: 'reserved', label: 'Reserved' },
                { value: 'occupied', label: 'Occupied' },
                { value: 'unavailable', label: 'Unavailable' },
              ]}
              value={graveForm.status}
              onChange={e => setGraveForm(p => ({ ...p, status: e.target.value as Grave['status'] }))}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">Coordinates</label>
              <button
                type="button"
                onClick={captureGps}
                disabled={gpsState.status === 'capturing'}
                className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border border-primary text-primary hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {gpsState.status === 'capturing'
                  ? <><Loader2 size={12} className="animate-spin" /> Getting location…</>
                  : <><MapPin size={12} /> Use my location</>
                }
              </button>
            </div>
            {gpsState.message && (
              <p className={`text-xs ${gpsState.status === 'error' ? 'text-danger' : 'text-success'}`}>
                {gpsState.message}
              </p>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Input label="Latitude" type="number" step="any" placeholder="e.g. 42.3314" value={graveForm.lat} onChange={e => setGraveForm(p => ({ ...p, lat: e.target.value }))} />
              <Input label="Longitude" type="number" step="any" placeholder="e.g. -83.0458" value={graveForm.lng} onChange={e => setGraveForm(p => ({ ...p, lng: e.target.value }))} />
            </div>
          </div>
          <Textarea label="Notes" value={graveForm.notes} onChange={e => setGraveForm(p => ({ ...p, notes: e.target.value }))} rows={2} />
        </div>
      </Modal>
    </div>
  );
}

