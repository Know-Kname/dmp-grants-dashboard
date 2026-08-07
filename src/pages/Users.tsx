/**
 * `/users` — the admin view of who has an account and what they may do.
 *
 * Reached only through `AdminRoute` (App.tsx) and only listed in the nav for an
 * admin, but neither is what keeps it safe: RLS on `public.profiles` restricts
 * SELECT to your own row and UPDATE to admins. A non-admin who typed the URL
 * would see exactly one row — their own — and be unable to change it.
 *
 * There is deliberately no "invite user" button. Creating an auth user needs the
 * service_role key, which belongs in an edge function and is not configured;
 * putting it in this bundle would hand every visitor full database access. Until
 * that exists, provisioning happens in the Supabase dashboard — the panel at the
 * top of this page says so, and docs/06-supabase.md has the steps.
 */
import { useMemo, useState } from 'react';
import type { z } from 'zod';
import { UserPlus, Users as UsersIcon, ShieldCheck, Pencil } from 'lucide-react';
import { useProfiles, useUpdateProfile } from '../hooks/useData';
import { useForm, getFieldError } from '../hooks/useForm';
import { userAccountFormSchema } from '../lib/schemas';
import { getErrorMessage } from '../lib/errors';
import { formatDate } from '../lib/utils';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { APP_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, type AppRole } from '../lib/permissions';
import type { Profile } from '../lib/profiles';
import {
  Badge, Button, Card, CardBody, ConfirmDialog, EmptyState, Input,
  Modal, PageError, PageHeader, Select, SkeletonTable,
} from '../components/ui';
import { DataTable, type Column } from '../components/DataTable';

/** Live form state — the *input* side of the schema (`isActive` is a string). */
type UserAccountFormValues = z.input<typeof userAccountFormSchema>;

const ROLE_OPTIONS = APP_ROLES.map((role) => ({
  value: role,
  label: ROLE_LABELS[role],
}));

const STATUS_OPTIONS = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Deactivated' },
];

const ROLE_BADGE: Record<AppRole, 'primary' | 'info' | 'secondary'> = {
  admin: 'primary',
  staff: 'info',
  readonly: 'secondary',
};

export default function Users() {
  const { data: profiles = [], isLoading, error } = useProfiles();
  const { currentUser } = useAuth();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Profile | null>(null);
  /** The account whose active flag is about to be flipped, pending confirmation. */
  const [statusTarget, setStatusTarget] = useState<Profile | null>(null);

  const updateMutation = useUpdateProfile({
    onSuccess: () => {
      toast.success('Account updated');
      setEditing(null);
      setStatusTarget(null);
    },
    onError: (err) => toast.error(getErrorMessage(err), 'Could not update account'),
  });

  const form = useForm({
    schema: userAccountFormSchema,
    initialValues: { role: 'readonly', isActive: 'true' } as UserAccountFormValues,
    onSubmit: (data) => {
      if (!editing) return;
      updateMutation.mutate({ id: editing.id, role: data.role, isActive: data.isActive });
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(
      (p) =>
        (p.email ?? '').toLowerCase().includes(q) ||
        (p.fullName ?? '').toLowerCase().includes(q) ||
        p.role.includes(q)
    );
  }, [profiles, search]);

  const adminCount = useMemo(
    () => profiles.filter((p) => p.role === 'admin' && p.isActive).length,
    [profiles]
  );

  /**
   * Is `profile` the person using the page right now?
   *
   * Self-edits are blocked in the UI, for two reasons that both end in someone
   * calling for help: demoting yourself locks you out of this page instantly,
   * and deactivating yourself locks you out of the whole app. Neither is
   * recoverable from inside the product — it needs the Supabase dashboard.
   * (The database allows both; this is a guard rail, not a rule.)
   */
  const isSelf = (profile: Profile) => profile.id === currentUser?.id;

  /**
   * Would this change leave the system with no active administrator?
   *
   * Blocked for the same reason as self-edits: nobody could then reach `/users`
   * to undo it.
   */
  const isLastAdmin = (profile: Profile) =>
    profile.role === 'admin' && profile.isActive && adminCount <= 1;

  const openEdit = (profile: Profile) => {
    setEditing(profile);
    form.reset({ role: profile.role, isActive: profile.isActive ? 'true' : 'false' });
  };

  const confirmStatusChange = () => {
    if (!statusTarget) return;
    updateMutation.mutate({ id: statusTarget.id, isActive: !statusTarget.isActive });
  };

  const columns: Column<Profile>[] = [
    {
      key: 'email',
      header: 'Email',
      sortValue: (p) => p.email ?? '',
      cell: (p) => (
        <div className="min-w-0">
          <div className="font-medium text-foreground truncate">{p.email ?? '—'}</div>
          {isSelf(p) && <div className="text-xs text-foreground-subtle">You</div>}
        </div>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      sortValue: (p) => p.fullName ?? '',
      cell: (p) => <span className="text-foreground-muted">{p.fullName || '—'}</span>,
    },
    {
      key: 'role',
      header: 'Role',
      sortValue: (p) => p.role,
      cell: (p) => <Badge variant={ROLE_BADGE[p.role]}>{ROLE_LABELS[p.role]}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (p) => (p.isActive ? 'active' : 'deactivated'),
      cell: (p) =>
        p.isActive ? (
          <Badge variant="success" dot>Active</Badge>
        ) : (
          <Badge variant="danger" dot>Deactivated</Badge>
        ),
    },
    {
      key: 'created',
      header: 'Created',
      sortValue: (p) => p.createdAt,
      cell: (p) => <span className="text-foreground-muted">{formatDate(p.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (p) => {
        const locked = isSelf(p);
        return (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              icon={<Pencil size={14} />}
              onClick={() => openEdit(p)}
              disabled={locked}
              title={locked ? 'You cannot change your own role' : 'Change role'}
            >
              Role
            </Button>
            <Button
              variant={p.isActive ? 'danger' : 'secondary'}
              size="sm"
              onClick={() => setStatusTarget(p)}
              disabled={locked || (p.isActive && isLastAdmin(p))}
              title={
                locked
                  ? 'You cannot deactivate your own account'
                  : p.isActive && isLastAdmin(p)
                    ? 'This is the only active administrator'
                    : undefined
              }
            >
              {p.isActive ? 'Deactivate' : 'Reactivate'}
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users & Access"
        subtitle="Who can sign in, and what each of them is allowed to do"
        actions={
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
        }
      />

      <PageError error={error || updateMutation.error} />

      {/* Provisioning is a dashboard task until an edge function exists — say so
          here rather than shipping a button that cannot work. */}
      <Card>
        <CardBody>
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-primary-50 dark:bg-primary-950 text-primary shrink-0">
              <UserPlus size={18} />
            </div>
            <div className="text-sm text-foreground-muted leading-relaxed">
              <p className="font-medium text-foreground">Adding a new user</p>
              <p className="mt-1">
                Invite them from the Supabase dashboard — Authentication → Users → Invite user.
                They will appear here as <span className="font-medium">Read only</span> once they
                accept, ready for you to give them a role. Full steps are in{' '}
                <span className="font-mono text-xs">docs/06-supabase.md</span>.
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-background-subtle text-foreground-muted shrink-0">
            <ShieldCheck size={18} />
          </div>
          <dl className="text-sm space-y-1">
            {APP_ROLES.map((role) => (
              <div key={role} className="flex gap-2">
                <dt className="font-medium text-foreground w-28 shrink-0">{ROLE_LABELS[role]}</dt>
                <dd className="text-foreground-muted">{ROLE_DESCRIPTIONS[role]}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>

      {isLoading ? (
        <SkeletonTable rows={5} cols={6} />
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(p) => p.id}
          initialSort={{ key: 'created', dir: 'desc' }}
          csv={{
            filename: 'dmp-users',
            header: ['Email', 'Name', 'Role', 'Status', 'Created'],
            row: (p) => [
              p.email ?? '',
              p.fullName ?? '',
              ROLE_LABELS[p.role],
              p.isActive ? 'Active' : 'Deactivated',
              formatDate(p.createdAt),
            ],
          }}
          emptyState={
            <CardBody>
              <EmptyState
                icon={<UsersIcon size={48} />}
                title="No users found"
                description={
                  search
                    ? 'Try a different search.'
                    : 'Invite someone from the Supabase dashboard to get started.'
                }
              />
            </CardBody>
          }
        />
      )}

      <ConfirmDialog
        isOpen={statusTarget !== null}
        onClose={() => setStatusTarget(null)}
        onConfirm={confirmStatusChange}
        loading={updateMutation.isPending}
        confirmLabel={statusTarget?.isActive ? 'Deactivate' : 'Reactivate'}
        title={statusTarget?.isActive ? 'Deactivate account' : 'Reactivate account'}
        message={
          statusTarget?.isActive ? (
            <>
              <span className="font-medium text-foreground">
                {statusTarget?.email ?? 'This user'}
              </span>{' '}
              will lose access immediately — every record becomes invisible to them and they see an
              &ldquo;account deactivated&rdquo; notice instead of the app. Their sign-in still works;
              you can reactivate them here at any time.
            </>
          ) : (
            <>
              Restore access for{' '}
              <span className="font-medium text-foreground">
                {statusTarget?.email ?? 'this user'}
              </span>
              ? They will return with the{' '}
              <span className="font-medium text-foreground">
                {statusTarget ? ROLE_LABELS[statusTarget.role] : ''}
              </span>{' '}
              role they had before.
            </>
          )
        }
      />

      <Modal
        isOpen={editing !== null}
        onClose={() => setEditing(null)}
        title={`Change role — ${editing?.email ?? ''}`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => form.handleSubmit()}
              loading={updateMutation.isPending}
            >
              Save
            </Button>
          </>
        }
      >
        <form onSubmit={form.handleSubmit} className="space-y-4">
          <Select
            label="Role"
            {...form.getFieldProps('role')}
            error={getFieldError('role', form.errors, form.touched)}
            options={ROLE_OPTIONS}
            hint={ROLE_DESCRIPTIONS[form.values.role as AppRole]}
          />
          <Select
            label="Status"
            {...form.getFieldProps('isActive')}
            error={getFieldError('isActive', form.errors, form.touched)}
            options={STATUS_OPTIONS}
          />
        </form>
      </Modal>
    </div>
  );
}
