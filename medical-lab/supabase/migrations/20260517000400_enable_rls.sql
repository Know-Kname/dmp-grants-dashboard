-- LabCore LIMS — Migration 4: Row-Level Security
-- Enables RLS on all tables and grants full access to authenticated users.
-- For production, replace the permissive policy with role-based policies.

-- Helper: grant authenticated users full access (replace with fine-grained
-- role checks in production, e.g. lab_director can delete, staff can only read).

do $$
declare
  t text;
  tables text[] := array[
    'patients', 'providers', 'staff', 'test_catalog',
    'orders', 'order_items', 'specimens', 'test_results',
    'instruments', 'reagents', 'invoices', 'insurance_claims', 'qc_runs'
  ];
begin
  foreach t in array tables loop
    execute format('alter table %I enable row level security', t);

    -- Allow all operations for authenticated users (permissive demo policy)
    execute format(
      'create policy auth_all on %I
         for all
         to authenticated
         using (true)
         with check (true)',
      t
    );
  end loop;
end;
$$;

-- ─── Indexes for common dashboard queries ─────────────────────────────────────
-- Weekly order volume
create index if not exists orders_ordered_date_week_idx
  on orders (date_trunc('week', ordered_date::timestamptz));

-- Weekly invoice revenue
create index if not exists invoices_issue_date_week_idx
  on invoices (date_trunc('week', issue_date::timestamptz));

-- Weekly QC runs
create index if not exists qc_runs_run_date_week_idx
  on qc_runs (date_trunc('week', run_date::timestamptz));
