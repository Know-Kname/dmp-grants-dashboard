import { useState } from 'react';
import { useTestCatalog, useCreateTestCatalogItem, useUpdateTestCatalogItem, useRemoveTestCatalogItem } from '../hooks/useData';
import { validateForm, testCatalogFormSchema, type TestCatalogFormData } from '../lib/schemas';
import { formatStatus, formatCurrency } from '../lib/utils';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';
import { getErrorMessage } from '../lib/errors';
import {
  Button, Input, Select, Modal, Badge, EmptyState,
  LoadingSpinner, Alert, Card,
} from '../components/ui';
import type { TestCatalogItem, TestCategory, SpecimenType } from '../types';
import { FlaskConical, Plus, Search, Pencil, Trash2 } from 'lucide-react';

const CATEGORY_OPTIONS: { value: TestCategory; label: string }[] = [
  { value: 'chemistry', label: 'Chemistry' },
  { value: 'hematology', label: 'Hematology' },
  { value: 'microbiology', label: 'Microbiology' },
  { value: 'immunology', label: 'Immunology' },
  { value: 'molecular', label: 'Molecular' },
  { value: 'pathology', label: 'Pathology' },
  { value: 'urinalysis', label: 'Urinalysis' },
  { value: 'panel', label: 'Panel' },
];

const SPECIMEN_OPTIONS: { value: SpecimenType; label: string }[] = [
  { value: 'blood', label: 'Blood' },
  { value: 'serum', label: 'Serum' },
  { value: 'plasma', label: 'Plasma' },
  { value: 'urine', label: 'Urine' },
  { value: 'stool', label: 'Stool' },
  { value: 'swab', label: 'Swab' },
  { value: 'csf', label: 'CSF' },
  { value: 'tissue', label: 'Tissue' },
  { value: 'sputum', label: 'Sputum' },
  { value: 'other', label: 'Other' },
];

const INIT: TestCatalogFormData = {
  code: '', name: '', loincCode: '', cptCode: '',
  category: 'chemistry' as TestCategory, specimenType: 'blood' as SpecimenType,
  turnaroundHours: 2, price: 0, unit: '',
  referenceRangeLow: undefined, referenceRangeHigh: undefined,
  referenceRangeText: '', isPanel: false, panelComponentIds: [], active: true,
};

export default function TestCatalog() {
  const { data: allCatalogItems = [], isLoading, error } = useTestCatalog();
  const createMutation = useCreateTestCatalogItem();
  const updateMutation = useUpdateTestCatalogItem();
  const removeMutation = useRemoveTestCatalogItem();
  const toast = useToast();
  const { confirm } = useConfirm();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<TestCategory | ''>('');
  const [activeOnly, setActiveOnly] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<TestCatalogItem | null>(null);
  const [formData, setFormData] = useState<TestCatalogFormData>(INIT);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');

  const f = (field: keyof TestCatalogFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setFormData((p) => ({ ...p, [field]: e.target.value }));
    if (formErrors[field]) setFormErrors((p) => ({ ...p, [field]: '' }));
  };

  const fNum = (field: keyof TestCatalogFormData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const val = e.target.value === '' ? undefined : (parseFloat(e.target.value) || 0);
    setFormData((p) => ({ ...p, [field]: val }));
    if (formErrors[field]) setFormErrors((p) => ({ ...p, [field]: '' }));
  };

  const fNumRequired = (field: keyof TestCatalogFormData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData((p) => ({ ...p, [field]: parseFloat(e.target.value) || 0 }));
    if (formErrors[field]) setFormErrors((p) => ({ ...p, [field]: '' }));
  };

  const openNew = () => {
    setEditing(null); setFormData(INIT); setFormErrors({}); setSubmitError(''); setShowModal(true);
  };

  const openEdit = (item: TestCatalogItem) => {
    setEditing(item);
    setFormData({
      code: item.code,
      name: item.name,
      loincCode: item.loincCode ?? '',
      cptCode: item.cptCode ?? '',
      category: item.category,
      specimenType: item.specimenType,
      turnaroundHours: item.turnaroundHours,
      price: item.price,
      unit: item.unit ?? '',
      referenceRangeLow: item.referenceRangeLow,
      referenceRangeHigh: item.referenceRangeHigh,
      referenceRangeText: item.referenceRangeText ?? '',
      isPanel: item.isPanel,
      panelComponentIds: item.panelComponentIds ?? [],
      active: item.active,
    });
    setFormErrors({}); setSubmitError(''); setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditing(null); };

  const handleSubmit = async () => {
    const v = validateForm(testCatalogFormSchema, formData);
    if (v.success === false) { setFormErrors(v.errors); return; }
    setSubmitError('');
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, data: v.data });
        toast.success('Test updated');
      } else {
        await createMutation.mutateAsync(v.data as any);
        toast.success('Test created');
      }
      closeModal();
    } catch (err) {
      setSubmitError(getErrorMessage(err));
    }
  };

  const handleDelete = async (item: TestCatalogItem) => {
    if (!await confirm({ title: 'Delete test', message: `Delete "${item.name}"? This cannot be undone.`, confirmLabel: 'Delete' })) return;
    try {
      await removeMutation.mutateAsync(item.id);
      toast.success('Test deleted');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const togglePanelComponent = (id: string) => {
    setFormData((p) => {
      const ids = p.panelComponentIds ?? [];
      return {
        ...p,
        panelComponentIds: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
      };
    });
  };

  const filtered = allCatalogItems.filter((item) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || `${item.code} ${item.name} ${item.loincCode ?? ''} ${item.cptCode ?? ''}`.toLowerCase().includes(q);
    const matchesCategory = !categoryFilter || item.category === categoryFilter;
    const matchesActive = !activeOnly || item.active;
    return matchesSearch && matchesCategory && matchesActive;
  });

  // Non-panel items available as panel components
  const componentCandidates = allCatalogItems.filter((item) => !item.isPanel && item.id !== editing?.id);

  const isBusy = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Test Catalog</h1>
          <p className="text-foreground-muted text-sm mt-0.5">{allCatalogItems.length} test{allCatalogItems.length !== 1 ? 's' : ''} in catalog</p>
        </div>
        <Button onClick={openNew} icon={<Plus className="w-4 h-4" />}>New Test</Button>
      </div>

      {error && <div className="mb-4"><Alert message={getErrorMessage(error)} /></div>}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search by code, name, LOINC, or CPT…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-card border border-input rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as TestCategory | '')}
          className="h-10 px-3 bg-card border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-sm"
        >
          <option value="">All categories</option>
          {CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 h-10 px-3 bg-card border border-input rounded-lg cursor-pointer select-none text-sm text-foreground">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
            className="rounded border-input"
          />
          Active only
        </label>
      </div>

      <Card>
        {isLoading ? (
          <LoadingSpinner className="py-20" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<FlaskConical className="w-10 h-10" />}
            title="No tests found"
            description={search || categoryFilter || activeOnly ? 'Try adjusting your filters.' : 'Add your first test to get started.'}
            action={!search && !categoryFilter && !activeOnly ? <Button onClick={openNew} icon={<Plus className="w-4 h-4" />}>New Test</Button> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background-subtle/50">
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted">Code</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden md:table-cell">Category</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden md:table-cell">Specimen</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden lg:table-cell">TAT</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden lg:table-cell">Price</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden sm:table-cell">Active</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} className="border-b border-border hover:bg-card-hover transition-colors last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-foreground-muted">{item.code}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{item.name}</div>
                      {item.isPanel && <div className="text-xs text-foreground-muted">Panel</div>}
                    </td>
                    <td className="px-4 py-3 text-foreground-muted hidden md:table-cell">{formatStatus(item.category)}</td>
                    <td className="px-4 py-3 text-foreground-muted hidden md:table-cell">{formatStatus(item.specimenType)}</td>
                    <td className="px-4 py-3 text-foreground-muted hidden lg:table-cell">{item.turnaroundHours}h</td>
                    <td className="px-4 py-3 text-foreground-muted hidden lg:table-cell">{formatCurrency(item.price)}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <Badge variant={item.active ? 'success' : 'secondary'} size="sm">{item.active ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-accent transition-colors" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(item)} className="p-1.5 rounded-lg text-foreground-muted hover:text-danger transition-colors" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editing ? 'Edit Test' : 'New Test'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSubmit} loading={isBusy}>{editing ? 'Save Changes' : 'Create Test'}</Button>
          </>
        }
      >
        {submitError && <div className="mb-4"><Alert message={submitError} /></div>}
        <div className="space-y-4">
          {/* Row 1: Code, Name, Category, Specimen Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Code" value={formData.code} onChange={f('code')} required placeholder="GLU" error={formErrors.code} />
            <Input label="Name" value={formData.name} onChange={f('name')} required placeholder="Glucose" error={formErrors.name} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Category" value={formData.category} onChange={f('category')} options={CATEGORY_OPTIONS} required error={formErrors.category} />
            <Select label="Specimen Type" value={formData.specimenType} onChange={f('specimenType')} options={SPECIMEN_OPTIONS} required error={formErrors.specimenType} />
          </div>

          {/* Row 2: LOINC, CPT, TAT, Price */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Input label="LOINC Code" value={formData.loincCode ?? ''} onChange={f('loincCode')} placeholder="2345-7" error={formErrors.loincCode} />
            <Input label="CPT Code" value={formData.cptCode ?? ''} onChange={f('cptCode')} placeholder="82947" error={formErrors.cptCode} />
            <Input
              label="TAT Hours"
              type="number"
              value={String(formData.turnaroundHours)}
              onChange={fNumRequired('turnaroundHours')}
              required
              error={formErrors.turnaroundHours}
            />
            <Input
              label="Price ($)"
              type="number"
              value={String(formData.price)}
              onChange={fNumRequired('price')}
              required
              error={formErrors.price}
            />
          </div>

          {/* Row 3: Unit, Ref Range Low, Ref Range High, Ref Range Text */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Input label="Unit" value={formData.unit ?? ''} onChange={f('unit')} placeholder="mg/dL" error={formErrors.unit} />
            <Input
              label="Ref Range Low"
              type="number"
              value={formData.referenceRangeLow !== undefined ? String(formData.referenceRangeLow) : ''}
              onChange={fNum('referenceRangeLow')}
              error={formErrors.referenceRangeLow}
            />
            <Input
              label="Ref Range High"
              type="number"
              value={formData.referenceRangeHigh !== undefined ? String(formData.referenceRangeHigh) : ''}
              onChange={fNum('referenceRangeHigh')}
              error={formErrors.referenceRangeHigh}
            />
            <Input label="Ref Range Text" value={formData.referenceRangeText ?? ''} onChange={f('referenceRangeText')} placeholder="70-99" error={formErrors.referenceRangeText} />
          </div>

          {/* Row 4: Is Panel, Active */}
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formData.isPanel}
                onChange={(e) => {
                  setFormData((p) => ({ ...p, isPanel: e.target.checked, panelComponentIds: e.target.checked ? p.panelComponentIds : [] }));
                  if (formErrors.isPanel) setFormErrors((p) => ({ ...p, isPanel: '' }));
                }}
                className="w-4 h-4 rounded border-input"
              />
              <span className="text-sm font-medium text-foreground">Is Panel</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formData.active}
                onChange={(e) => {
                  setFormData((p) => ({ ...p, active: e.target.checked }));
                  if (formErrors.active) setFormErrors((p) => ({ ...p, active: '' }));
                }}
                className="w-4 h-4 rounded border-input"
              />
              <span className="text-sm font-medium text-foreground">Active</span>
            </label>
          </div>

          {/* Conditional: Panel component multi-select */}
          {formData.isPanel && (
            <div>
              <p className="text-sm font-medium text-foreground mb-2">Panel Components</p>
              {componentCandidates.length === 0 ? (
                <p className="text-sm text-foreground-muted">No non-panel tests available to add as components.</p>
              ) : (
                <div className="border border-border rounded-lg max-h-48 overflow-y-auto divide-y divide-border">
                  {componentCandidates.map((item) => (
                    <label key={item.id} className="flex items-center gap-3 px-3 py-2 hover:bg-card-hover cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={(formData.panelComponentIds ?? []).includes(item.id)}
                        onChange={() => togglePanelComponent(item.id)}
                        className="w-4 h-4 rounded border-input"
                      />
                      <span className="text-sm text-foreground font-medium">{item.code}</span>
                      <span className="text-sm text-foreground-muted">{item.name}</span>
                      <span className="ml-auto text-xs text-foreground-muted">{formatStatus(item.category)}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
