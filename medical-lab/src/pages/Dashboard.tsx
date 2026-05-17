import { useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { usePatients, useOrders, useResults, useSpecimens, useInvoices, useQCRuns, useReagents } from '../hooks/useData';
import { Card, LoadingSpinner } from '../components/ui';
import { formatCurrency } from '../lib/utils';
import {
  Users, ClipboardList, FlaskConical, CheckCircle2,
  DollarSign, AlertTriangle, Activity, TrendingUp,
} from 'lucide-react';

// ─── helpers ──────────────────────────────────────────────────────────────────

function daysAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function isoWeek(dateStr: string): string {
  const d = new Date(dateStr);
  const dayOfWeek = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - dayOfWeek);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function last7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
}

const CHART_COLORS = ['#0f766e', '#0891b2', '#7c3aed', '#c026d3', '#dc2626', '#d97706', '#65a30d'];
const QC_COLORS = { pass: '#16a34a', warning: '#d97706', fail: '#dc2626' };

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  accent?: 'teal' | 'blue' | 'green' | 'amber' | 'red';
}

const ACCENT_BG: Record<NonNullable<KpiCardProps['accent']>, string> = {
  teal: 'bg-primary-500/10 text-primary-500',
  blue: 'bg-blue-500/10 text-blue-500',
  green: 'bg-success/10 text-success',
  amber: 'bg-warning/10 text-warning',
  red: 'bg-danger/10 text-danger',
};

function KpiCard({ label, value, sub, icon, accent = 'teal' }: KpiCardProps) {
  return (
    <Card className="flex items-start gap-4 p-5">
      <div className={`p-3 rounded-xl ${ACCENT_BG[accent]}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-sm text-foreground-muted">{label}</p>
        <p className="text-2xl font-bold text-foreground mt-0.5">{value}</p>
        {sub && <p className="text-xs text-foreground-muted mt-0.5">{sub}</p>}
      </div>
    </Card>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return <h2 className="text-base font-semibold text-foreground mb-3">{title}</h2>;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { data: patients = [], isLoading: loadingPatients } = usePatients();
  const { data: orders = [], isLoading: loadingOrders } = useOrders();
  const { data: results = [], isLoading: loadingResults } = useResults();
  const { data: specimens = [], isLoading: loadingSpecimens } = useSpecimens();
  const { data: invoices = [], isLoading: loadingInvoices } = useInvoices();
  const { data: qcRuns = [], isLoading: loadingQc } = useQCRuns();
  const { data: reagents = [] } = useReagents();

  const isLoading = loadingPatients || loadingOrders || loadingResults || loadingSpecimens || loadingInvoices || loadingQc;

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const activePatients = patients.length;
    const pendingOrders = orders.filter((o) => ['ordered', 'collected', 'received', 'in_progress'].includes(o.status)).length;
    const pendingResults = results.filter((r) => ['preliminary', 'pending_verification'].includes(r.status)).length;
    const criticalResults = results.filter((r) => r.flag === 'critical_low' || r.flag === 'critical_high').length;
    const totalRevenue = invoices.reduce((s, i) => s + i.amountPaid, 0);
    const outstandingBalance = invoices.reduce((s, i) => s + (i.totalAmount - i.amountPaid), 0);
    const lowStockReagents = reagents.filter((r) => r.status === 'low_stock' || r.status === 'expired').length;
    const qcPassRate = qcRuns.length > 0
      ? Math.round((qcRuns.filter((r) => r.result === 'pass').length / qcRuns.length) * 100)
      : 0;
    return { activePatients, pendingOrders, pendingResults, criticalResults, totalRevenue, outstandingBalance, lowStockReagents, qcPassRate };
  }, [patients, orders, results, invoices, reagents, qcRuns]);

  // ── Test volume (last 7 days) ──────────────────────────────────────────────
  const volumeData = useMemo(() => {
    const days = last7Days();
    return days.map((day) => ({
      date: day.slice(5), // MM-DD
      orders: orders.filter((o) => o.orderedDate?.slice(0, 10) === day).length,
      results: results.filter((r) => r.resultDate?.slice(0, 10) === day).length,
    }));
  }, [orders, results]);

  // ── Order status distribution ──────────────────────────────────────────────
  const orderStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach((o) => { counts[o.status] = (counts[o.status] ?? 0) + 1; });
    return Object.entries(counts).map(([status, count]) => ({
      name: status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      value: count,
    }));
  }, [orders]);

  // ── Result flags distribution ──────────────────────────────────────────────
  const flagData = useMemo(() => {
    const counts: Record<string, number> = {};
    results.forEach((r) => { counts[r.flag] = (counts[r.flag] ?? 0) + 1; });
    const labels: Record<string, string> = {
      normal: 'Normal', low: 'Low', high: 'High',
      critical_low: 'Critical Low', critical_high: 'Critical High', abnormal: 'Abnormal',
    };
    const colors: Record<string, string> = {
      normal: '#16a34a', low: '#2563eb', high: '#d97706',
      critical_low: '#7c3aed', critical_high: '#dc2626', abnormal: '#c026d3',
    };
    return Object.entries(counts).map(([flag, count]) => ({
      name: labels[flag] ?? flag, value: count, color: colors[flag] ?? '#6b7280',
    }));
  }, [results]);

  // ── QC results (last 8 weeks) ──────────────────────────────────────────────
  const qcTrendData = useMemo(() => {
    const weeks: Record<string, { week: string; pass: number; warning: number; fail: number }> = {};
    qcRuns.forEach((r) => {
      if (!r.runDate) return;
      const w = isoWeek(r.runDate);
      if (!weeks[w]) weeks[w] = { week: w.slice(5), pass: 0, warning: 0, fail: 0 };
      weeks[w][r.result]++;
    });
    return Object.values(weeks).sort((a, b) => a.week.localeCompare(b.week)).slice(-8);
  }, [qcRuns]);

  // ── Revenue (last 8 weeks) ─────────────────────────────────────────────────
  const revenueData = useMemo(() => {
    const weeks: Record<string, { week: string; billed: number; collected: number }> = {};
    invoices.forEach((inv) => {
      if (!inv.issueDate) return;
      const w = isoWeek(inv.issueDate);
      if (!weeks[w]) weeks[w] = { week: w.slice(5), billed: 0, collected: 0 };
      weeks[w].billed += inv.totalAmount;
      weeks[w].collected += inv.amountPaid;
    });
    return Object.values(weeks).sort((a, b) => a.week.localeCompare(b.week)).slice(-8);
  }, [invoices]);

  // ── Specimen status breakdown ──────────────────────────────────────────────
  const specimenStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    specimens.forEach((s) => { counts[s.status] = (counts[s.status] ?? 0) + 1; });
    return Object.entries(counts).map(([status, count]) => ({
      name: status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      count,
    }));
  }, [specimens]);

  if (isLoading) {
    return (
      <div className="p-4 lg:p-6 max-w-7xl mx-auto">
        <LoadingSpinner className="py-32" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-foreground-muted text-sm mt-0.5">Laboratory operations overview</p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Active Patients"
          value={kpis.activePatients}
          icon={<Users className="w-5 h-5" />}
          accent="teal"
        />
        <KpiCard
          label="Pending Orders"
          value={kpis.pendingOrders}
          sub="in workflow"
          icon={<ClipboardList className="w-5 h-5" />}
          accent="blue"
        />
        <KpiCard
          label="Pending Results"
          value={kpis.pendingResults}
          sub={kpis.criticalResults > 0 ? `${kpis.criticalResults} critical` : 'none critical'}
          icon={<FlaskConical className="w-5 h-5" />}
          accent={kpis.criticalResults > 0 ? 'red' : 'teal'}
        />
        <KpiCard
          label="QC Pass Rate"
          value={`${kpis.qcPassRate}%`}
          sub="all runs"
          icon={<CheckCircle2 className="w-5 h-5" />}
          accent={kpis.qcPassRate >= 90 ? 'green' : kpis.qcPassRate >= 75 ? 'amber' : 'red'}
        />
        <KpiCard
          label="Revenue Collected"
          value={formatCurrency(kpis.totalRevenue)}
          icon={<DollarSign className="w-5 h-5" />}
          accent="green"
        />
        <KpiCard
          label="Outstanding Balance"
          value={formatCurrency(kpis.outstandingBalance)}
          icon={<TrendingUp className="w-5 h-5" />}
          accent={kpis.outstandingBalance > 10000 ? 'amber' : 'teal'}
        />
        <KpiCard
          label="Critical Results"
          value={kpis.criticalResults}
          sub="need attention"
          icon={<Activity className="w-5 h-5" />}
          accent={kpis.criticalResults > 0 ? 'red' : 'green'}
        />
        <KpiCard
          label="Low-Stock Reagents"
          value={kpis.lowStockReagents}
          sub="low or expired"
          icon={<AlertTriangle className="w-5 h-5" />}
          accent={kpis.lowStockReagents > 0 ? 'amber' : 'green'}
        />
      </div>

      {/* Charts row 1: volume + revenue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <SectionHeader title="Test Volume — Last 7 Days" />
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={volumeData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--foreground-muted)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--foreground-muted)' }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: 12 }}
                labelStyle={{ color: 'var(--foreground)' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="orders" name="Orders" stroke="#0f766e" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="results" name="Results" stroke="#0891b2" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <SectionHeader title="Revenue — Last 8 Weeks" />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenueData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'var(--foreground-muted)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--foreground-muted)' }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: 12 }}
                formatter={(v: number) => formatCurrency(v)}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="billed" name="Billed" fill="#0f766e" radius={[3, 3, 0, 0]} />
              <Bar dataKey="collected" name="Collected" fill="#5eead4" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Charts row 2: QC trend + donut charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-5 lg:col-span-1">
          <SectionHeader title="QC Results — Last 8 Weeks" />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={qcTrendData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'var(--foreground-muted)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--foreground-muted)' }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="pass" name="Pass" stackId="a" fill={QC_COLORS.pass} />
              <Bar dataKey="warning" name="Warning" stackId="a" fill={QC_COLORS.warning} />
              <Bar dataKey="fail" name="Fail" stackId="a" fill={QC_COLORS.fail} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <SectionHeader title="Result Flags" />
          {flagData.length === 0 ? (
            <p className="text-center text-foreground-muted text-sm py-16">No results yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={flagData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {flagData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-5">
          <SectionHeader title="Order Status" />
          {orderStatusData.length === 0 ? (
            <p className="text-center text-foreground-muted text-sm py-16">No orders yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={orderStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {orderStatusData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Specimen breakdown table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <SectionHeader title="Specimen Status Breakdown" />
          <div className="space-y-2">
            {specimenStatusData.length === 0 ? (
              <p className="text-foreground-muted text-sm">No specimens yet</p>
            ) : (
              specimenStatusData.map(({ name, count }) => {
                const pct = Math.round((count / specimens.length) * 100);
                return (
                  <div key={name}>
                    <div className="flex justify-between text-sm mb-0.5">
                      <span className="text-foreground-muted">{name}</span>
                      <span className="text-foreground font-medium">{count} <span className="text-foreground-muted font-normal">({pct}%)</span></span>
                    </div>
                    <div className="h-1.5 bg-background-subtle rounded-full overflow-hidden">
                      <div className="h-full bg-primary-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        <Card className="p-5">
          <SectionHeader title="Quick Stats" />
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Completed Orders', value: orders.filter((o) => o.status === 'completed').length },
              { label: 'Verified Results', value: results.filter((r) => r.status === 'verified').length },
              { label: 'Paid Invoices', value: invoices.filter((i) => i.status === 'paid').length },
              { label: 'Overdue Invoices', value: invoices.filter((i) => i.status === 'overdue').length },
              { label: 'Patients (30d)', value: patients.filter((p) => daysAgo(p.createdAt) <= 30).length },
              { label: 'New Orders (7d)', value: orders.filter((o) => o.orderedDate && daysAgo(o.orderedDate) <= 7).length },
            ].map(({ label, value }) => (
              <div key={label} className="bg-background-subtle rounded-lg p-3">
                <p className="text-xs text-foreground-muted">{label}</p>
                <p className="text-xl font-bold text-foreground mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
