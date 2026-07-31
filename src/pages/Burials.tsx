import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { z } from 'zod';
import {
  useBurials, useCreateBurial,
  useUpdateBurial, useDeleteBurial,
} from '../hooks/useData';
import { useForm, getFieldError } from '../hooks/useForm';
import { burialFormSchema } from '../lib/schemas';
import { formatDate, formatDateForInput } from '../lib/utils';
import { getErrorMessage } from '../lib/errors';
import { useToast } from '../lib/toast';
import type { Burial } from '../types';
import {
  Card, CardBody, Button, Modal, Input, Textarea,
  EmptyState, PageError, StatCard, AnimatedNumber, SkeletonTable, ConfirmDialog } from '../components/ui';
import { DataTable, type Column } from '../components/DataTable';
import { Plus, Search, BookOpen, Edit, Trash2, RefreshCw, Calendar, QrCode, Globe } from 'lucide-react';
import { isThisMonth } from 'date-fns';
import QRCode from 'react-qr-code';
import { useAuth } from '../lib/auth';

/** Live form state — the input side of `burialFormSchema`, so the two cannot drift. */
type BurialFormData = z.input<typeof burialFormSchema>;

const initialForm: BurialFormData = {
  deceasedFirstName: '', deceasedLastName: '', deceasedMiddleName: '',
  dateOfBirth: '', dateOfDeath: '', burialDate: '',
  section: '', lot: '', grave: '',
  contactName: '', contactPhone: '', contactEmail: '',
  permitNumber: '', notes: '',
  memorialPublished: false,
};

function deceasedName(b: Burial): string {
  const middle = b.deceasedMiddleName ? ` ${b.deceasedMiddleName[0]}.` : '';
  return `${b.deceasedLastName}, ${b.deceasedFirstName}${middle}`;
}

export default function Burials() {
  const { data: burials = [], isLoading, error, refetch } = useBurials();
  const toast = useToast();

  const createMutation = useCreateBurial({
    onSuccess: () => { toast.success('Burial record created successfully'); setShowModal(false); form.reset(initialForm); },
    onError: (err) => toast.error(getErrorMessage(err), 'Failed to create burial record'),
  });
  const updateMutation = useUpdateBurial({
    onSuccess: () => { toast.success('Burial record updated'); setShowModal(false); setEditingBurial(null); form.reset(initialForm); },
    onError: (err) => toast.error(getErrorMessage(err), 'Failed to update burial record'),
  });
  const deleteMutation = useDeleteBurial({
    onSuccess: () => { toast.success('Burial record removed'); setDeleteTarget(null); },
    onError: (err) => toast.error(getErrorMessage(err), 'Failed to delete burial record'),
  });

  const [searchParams] = useSearchParams();
  const [showModal, setShowModal] = useState(false);
  const [editingBurial, setEditingBurial] = useState<Burial | null>(null);
  const [qrBurial, setQrBurial] = useState<Burial | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Burial | null>(null);

  // Write permissions. Postgres RLS is what enforces them (every policy keys off
  // `profiles.role`); hiding the controls only stops the UI offering an action
  // the server would refuse. See `lib/permissions`.
  const { can } = useAuth();
  const canCreate = can('create');
  const canEdit = can('update');
  const canDelete = can('delete');

  // Seeded from ?q= so other screens can deep-link a specific record
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('q') ?? '');
  // Form state + validation. onSubmit only runs once the schema parses.
  const form = useForm({
    schema: burialFormSchema,
    initialValues: initialForm,
    onSubmit: (data) => {
      const payload = {
        deceasedFirstName: data.deceasedFirstName,
        deceasedLastName: data.deceasedLastName,
        deceasedMiddleName: data.deceasedMiddleName || undefined,
        dateOfBirth: data.dateOfBirth || undefined,
        dateOfDeath: data.dateOfDeath || undefined,
        burialDate: data.burialDate,
        plotLocation: `${data.section}-${data.lot}-${data.grave}`,
        section: data.section,
        lot: data.lot,
        grave: data.grave,
        memorialPublished: data.memorialPublished,
        contactName: data.contactName || undefined,
        contactPhone: data.contactPhone || undefined,
        contactEmail: data.contactEmail || undefined,
        permitNumber: data.permitNumber || undefined,
        notes: data.notes || undefined,
      };
      if (editingBurial) {
        updateMutation.mutate({ id: editingBurial.id, ...payload });
      } else {
        createMutation.mutate(payload);
      }
    },
  });

  const stats = useMemo(() => ({
    total: burials.length,
    thisMonth: burials.filter(b => {
      try { return isThisMonth(new Date(b.burialDate as string)); }
      catch { return false; }
    }).length,
  }), [burials]);

  const filteredBurials = useMemo(() => {
    if (!searchTerm) return burials;
    const s = searchTerm.toLowerCase();
    return burials.filter(b =>
      b.deceasedFirstName.toLowerCase().includes(s) ||
      b.deceasedLastName.toLowerCase().includes(s) ||
      b.deceasedMiddleName?.toLowerCase().includes(s) ||
      b.permitNumber?.toLowerCase().includes(s) ||
      b.plotLocation?.toLowerCase().includes(s)
    );
  }, [burials, searchTerm]);

  const combinedError = error || createMutation.error || updateMutation.error || deleteMutation.error;


  const handleEdit = (b: Burial) => {
    setEditingBurial(b);
    // Parse plotLocation back to section/lot/grave if possible
    const parts = (b.plotLocation || '').split('-');
    form.setValues({
      deceasedFirstName: b.deceasedFirstName,
      deceasedLastName: b.deceasedLastName,
      deceasedMiddleName: b.deceasedMiddleName || '',
      dateOfBirth: formatDateForInput(b.dateOfBirth),
      dateOfDeath: formatDateForInput(b.dateOfDeath),
      burialDate: formatDateForInput(b.burialDate),
      section: b.section || parts[0] || '',
      lot: b.lot || parts[1] || '',
      grave: b.grave || parts[2] || '',
      memorialPublished: b.memorialPublished ?? false,
      contactName: b.contactName || '',
      contactPhone: b.contactPhone || '',
      contactEmail: b.contactEmail || '',
      permitNumber: b.permitNumber || '',
      notes: b.notes || '',
    });
    setShowModal(true);
  };

  const isMutating = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Burial Records</h1>
          <p className="text-foreground-muted mt-1">Deceased records, plot locations, and permit tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon={<RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />} onClick={() => refetch()}>
            Refresh
          </Button>
          {canCreate && (
            <Button variant="primary" icon={<Plus size={20} />} onClick={() => { form.reset(initialForm); setEditingBurial(null); setShowModal(true); }}>
              Record Burial
            </Button>
          )}
        </div>
      </div>

      {/* Error */}
      <PageError error={combinedError} />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatCard label="Total Records" value={<AnimatedNumber to={stats.total} />} icon={BookOpen} tone="primary" />
        <StatCard label="This Month" value={<AnimatedNumber to={stats.thisMonth} />} icon={Calendar} tone="info" />
      </div>

      {/* Filter */}
      <Card>
        <CardBody>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by name, permit number, or plot..."
                icon={<Search size={18} />}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <span className="text-sm text-foreground-muted whitespace-nowrap">
              {filteredBurials.length} of {burials.length}
            </span>
          </div>
        </CardBody>
      </Card>

      {/* Table */}
      {isLoading ? (
        <SkeletonTable rows={6} cols={6} />
      ) : (
        <DataTable<Burial>
          rows={filteredBurials}
          rowKey={b => b.id}
          initialSort={{ key: 'burialDate', dir: 'desc' }}
          csv={{
            filename: 'burials',
            header: ['Deceased', 'Plot Location', 'Burial Date', 'Date of Death', 'Contact', 'Contact Phone', 'Permit #'],
            row: b => [deceasedName(b), b.plotLocation || `${b.section}-${b.lot}-${b.grave}`, b.burialDate, b.dateOfDeath, b.contactName, b.contactPhone, b.permitNumber],
          }}
          emptyState={
            <CardBody>
              <EmptyState
                icon={<BookOpen size={48} />}
                title="No burial records found"
                description={searchTerm ? 'Try a different search term' : 'Record your first burial to get started'}
                action={canCreate && !searchTerm ? <Button variant="primary" icon={<Plus size={20} />} onClick={() => setShowModal(true)}>Record Burial</Button> : undefined}
              />
            </CardBody>
          }
          columns={[
            { key: 'deceased', header: 'Deceased', sortValue: b => deceasedName(b), cell: b => (
              <div>
                <div className="font-medium text-foreground">{deceasedName(b)}</div>
                {b.dateOfDeath && (
                  <div className="text-xs text-foreground-muted mt-0.5">d. {formatDate(b.dateOfDeath)}</div>
                )}
              </div>
            ) },
            { key: 'plot', header: 'Plot Location', sortValue: b => b.plotLocation || `${b.section}-${b.lot}-${b.grave}`, cell: b => (
              <span className="font-mono text-xs bg-background-subtle border border-border px-2 py-1 rounded text-foreground">
                {b.plotLocation || `${b.section}-${b.lot}-${b.grave}`}
              </span>
            ) },
            { key: 'burialDate', header: 'Burial Date', sortValue: b => b.burialDate, cell: b => (
              <span className="text-foreground-muted">{b.burialDate ? formatDate(b.burialDate) : '—'}</span>
            ) },
            { key: 'contact', header: 'Contact', cell: b => (
              b.contactName ? (
                <div>
                  <div className="text-foreground">{b.contactName}</div>
                  {b.contactPhone && <div className="text-xs text-foreground-muted">{b.contactPhone}</div>}
                </div>
              ) : <span className="text-foreground-muted">—</span>
            ) },
            { key: 'permit', header: 'Permit #', cell: b => (
              b.permitNumber
                ? <span className="font-mono text-xs text-foreground-muted">#{b.permitNumber}</span>
                : <span className="text-foreground-muted">—</span>
            ) },
            { key: 'actions', header: <span className="sr-only">Actions</span>, align: 'right', cell: b => (
              <span className="space-x-2 whitespace-nowrap">
                {b.memorialPublished && (
                  <button
                    onClick={() => setQrBurial(b)}
                    className="text-info hover:text-info-hover"
                    aria-label="Show QR code"
                    title="Memorial QR code"
                  >
                    <QrCode size={17} />
                  </button>
                )}
                {canEdit && (
                  <button onClick={() => handleEdit(b)} className="text-primary hover:text-primary-hover" aria-label="Edit"><Edit size={17} /></button>
                )}
                {canDelete && (
                  <button onClick={() => setDeleteTarget(b)} className="text-danger hover:text-danger-hover" aria-label="Delete"><Trash2 size={17} /></button>
                )}
              </span>
            ) },
          ] satisfies Column<Burial>[]}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); }}
        title="Delete Burial Record"
        loading={deleteMutation.isPending}
        message={
          <>
            Delete the burial record for{' '}
            <span className="font-medium text-foreground">{deleteTarget ? deceasedName(deleteTarget) : ''}</span>?
            This cannot be undone.
          </>
        }
      />

      {/* QR Code Modal */}
      {qrBurial && (
        <Modal
          isOpen={!!qrBurial}
          onClose={() => setQrBurial(null)}
          title="Memorial QR Code"
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setQrBurial(null)}>Close</Button>
              <Button variant="primary" icon={<Globe size={16} />} onClick={() => window.open(`/memorial/${qrBurial.id}`, '_blank')}>
                Open Memorial
              </Button>
            </>
          }
        >
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="bg-white p-4 rounded-xl border border-border shadow-sm">
              <QRCode
                value={`${window.location.origin}/memorial/${qrBurial.id}`}
                size={180}
              />
            </div>
            <p className="text-sm font-medium text-foreground text-center">{deceasedName(qrBurial)}</p>
            <p className="text-xs text-foreground-muted text-center break-all">
              {window.location.origin}/memorial/{qrBurial.id}
            </p>
            <button
              onClick={() => window.print()}
              className="text-xs text-primary hover:underline"
            >
              Print this QR code
            </button>
          </div>
        </Modal>
      )}

      {/* Burial Record Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingBurial(null); }}
        title={editingBurial ? 'Edit Burial Record' : 'Record New Burial'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
            {(editingBurial ? canEdit : canCreate) && (
              <Button variant="primary" loading={isMutating} onClick={() => form.handleSubmit()}>
                {editingBurial ? 'Save Changes' : 'Record Burial'}
              </Button>
            )}
          </>
        }
      >
        <form onSubmit={form.handleSubmit} className="space-y-4">
          <p className="text-sm font-semibold text-foreground-muted uppercase tracking-wider">Deceased Information</p>
          <div className="grid grid-cols-2 gap-4">
            <Input label="First Name" {...form.getFieldProps('deceasedFirstName')} error={getFieldError('deceasedFirstName', form.errors, form.touched)} required />
            <Input label="Last Name" {...form.getFieldProps('deceasedLastName')} error={getFieldError('deceasedLastName', form.errors, form.touched)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Middle Name" {...form.getFieldProps('deceasedMiddleName')} error={getFieldError('deceasedMiddleName', form.errors, form.touched)} />
            <Input label="Date of Birth" type="date" {...form.getFieldProps('dateOfBirth')} error={getFieldError('dateOfBirth', form.errors, form.touched)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Date of Death" type="date" {...form.getFieldProps('dateOfDeath')} error={getFieldError('dateOfDeath', form.errors, form.touched)} />
            <Input label="Burial Date" type="date" {...form.getFieldProps('burialDate')} error={getFieldError('burialDate', form.errors, form.touched)} required />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Section" {...form.getFieldProps('section')} error={getFieldError('section', form.errors, form.touched)} required placeholder="e.g. A" />
            <Input label="Lot" {...form.getFieldProps('lot')} error={getFieldError('lot', form.errors, form.touched)} required placeholder="e.g. 142" />
            <Input label="Grave" {...form.getFieldProps('grave')} error={getFieldError('grave', form.errors, form.touched)} required placeholder="e.g. 3" />
          </div>
          <p className="text-sm font-semibold text-foreground-muted uppercase tracking-wider pt-2">Contact Information</p>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Contact Name" {...form.getFieldProps('contactName')} error={getFieldError('contactName', form.errors, form.touched)} />
            <Input label="Contact Phone" type="tel" {...form.getFieldProps('contactPhone')} error={getFieldError('contactPhone', form.errors, form.touched)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Contact Email" type="email" {...form.getFieldProps('contactEmail')} error={getFieldError('contactEmail', form.errors, form.touched)} />
            <Input label="Permit Number" {...form.getFieldProps('permitNumber')} error={getFieldError('permitNumber', form.errors, form.touched)} />
          </div>
          <Textarea label="Notes" {...form.getFieldProps('notes')} error={getFieldError('notes', form.errors, form.touched)} rows={3} />
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.values.memorialPublished}
              onChange={(e) => form.setValue('memorialPublished', e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm text-foreground">Publish public memorial page</span>
            <span className="text-xs text-foreground-muted">(family-facing, no login required)</span>
          </label>
        </form>
      </Modal>
    </div>
  );
}
