import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { resetDemo, useMock } from '../lib/dataClient';
import { useConfirm } from '../lib/confirm';
import { brand } from '../config/brand';
import {
  LayoutDashboard, Users, Stethoscope, FlaskConical, ClipboardList,
  Beaker, TestTube, Microscope, Cpu, PackageOpen, UserCog,
  CreditCard, CheckSquare, LogOut, Sun, Moon, Monitor, Menu, X,
  RotateCcw,
} from 'lucide-react';

const navItems = [
  { to: '/dashboard',     label: 'Dashboard',       icon: LayoutDashboard },
  { to: '/patients',      label: 'Patients',         icon: Users },
  { to: '/providers',     label: 'Providers',        icon: Stethoscope },
  { to: '/test-catalog',  label: 'Test Catalog',     icon: FlaskConical },
  { to: '/orders',        label: 'Test Orders',      icon: ClipboardList },
  { to: '/specimens',     label: 'Specimens',        icon: Beaker },
  { to: '/results',       label: 'Results',          icon: TestTube },
  { to: '/instruments',   label: 'Instruments',      icon: Cpu },
  { to: '/reagents',      label: 'Reagents',         icon: PackageOpen },
  { to: '/staff',         label: 'Staff',            icon: UserCog },
  { to: '/billing',       label: 'Billing',          icon: CreditCard },
  { to: '/qc',            label: 'Quality Control',  icon: CheckSquare },
];

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const options: { val: typeof theme; Icon: typeof Sun; label: string }[] = [
    { val: 'light',  Icon: Sun,     label: 'Light' },
    { val: 'dark',   Icon: Moon,    label: 'Dark' },
    { val: 'system', Icon: Monitor, label: 'System' },
  ];
  const current = options.find((o) => o.val === theme) ?? options[2];
  const next = options[(options.indexOf(current) + 1) % 3];
  return (
    <button
      onClick={() => setTheme(next.val)}
      className="p-2 rounded-lg text-foreground-muted hover:text-foreground hover:bg-accent transition-colors"
      title={`Switch to ${next.label} mode`}
    >
      <current.Icon className="w-5 h-5" />
    </button>
  );
}

interface LayoutProps { children: React.ReactNode }

export default function Layout({ children }: LayoutProps) {
  const { user, logout, isDemoActive } = useAuth();
  const { confirm } = useConfirm();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    if (await confirm({ title: 'Sign out', message: 'Are you sure you want to sign out?', confirmLabel: 'Sign out', danger: false })) {
      logout();
      navigate('/login');
    }
  };

  const handleReset = async () => {
    if (await confirm({ title: 'Reset demo data', message: 'This will restore all demo data to the original seed. Any changes you made will be lost.', confirmLabel: 'Reset', danger: true })) {
      resetDemo();
      window.location.reload();
    }
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.15)' }}>
          <Microscope className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <div className="text-white font-bold text-sm leading-tight truncate">{brand.name}</div>
          <div className="text-white/50 text-xs truncate">{brand.tagline}</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium mb-0.5 transition-colors ${
                isActive
                  ? 'bg-white/20 text-white'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 truncate">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-white/10 space-y-1">
        {isDemoActive && useMock && (
          <button
            onClick={handleReset}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset demo data
          </button>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
        <div className="px-3 py-1.5">
          <p className="text-white/40 text-xs truncate">{user?.name ?? 'User'}</p>
          <p className="text-white/30 text-xs truncate">{user?.email ?? ''}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col w-64 flex-shrink-0"
        style={{ backgroundColor: brand.teal }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-slate-950/60" onClick={() => setSidebarOpen(false)} />
          <aside
            className="fixed left-0 top-0 h-full w-64 flex flex-col z-50"
            style={{ backgroundColor: brand.teal }}
          >
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 p-1 text-white/60 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 flex items-center justify-between px-4 border-b border-border bg-card flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-foreground-muted hover:text-foreground hover:bg-accent"
            >
              <Menu className="w-5 h-5" />
            </button>
            {/* Breadcrumb area — pages can place content here via portal or just use title */}
          </div>
          <div className="flex items-center gap-2">
            {isDemoActive && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-warning-100 text-warning-700 dark:bg-warning-950 dark:text-warning-400">
                Demo Mode
              </span>
            )}
            <ThemeToggle />
            <Link
              to="/dashboard"
              className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-foreground-muted hover:text-foreground hover:bg-accent transition-colors"
            >
              <span className="font-medium">{user?.name ?? 'User'}</span>
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden flex border-t border-border bg-card flex-shrink-0 overflow-x-auto">
          {navItems.slice(0, 6).map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 px-3 py-2 text-xs font-medium flex-shrink-0 transition-colors ${
                  isActive ? 'text-primary' : 'text-foreground-muted hover:text-foreground'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] leading-none">{label.split(' ')[0]}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
