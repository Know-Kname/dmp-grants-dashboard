import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import {
  Home, FileText, Package, DollarSign, Users,
  FileSignature, Gift, ClipboardList, LogOut,
  Sun, Moon, Monitor, ChevronDown, Eye, X,
  MoreHorizontal, Star,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { Avatar } from './ui';
import { COMPANY } from '../config/company';
import AIAssistant from './AIAssistant';

// DMP brand constants — fixed regardless of light/dark theme
const DMP_GREEN = '#1a3d2b';
const DMP_GOLD = '#c49a2c';

export default function Layout() {
  const { currentUser: user, logout, isDemo } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) setThemeMenuOpen(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { setMoreOpen(false); }, [location.pathname]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const navItems = [
    { icon: Home, label: 'Dashboard', path: '/', description: 'Overview & metrics' },
    { icon: ClipboardList, label: 'Work Orders', path: '/work-orders', description: 'Tasks & maintenance' },
    { icon: Package, label: 'Inventory', path: '/inventory', description: 'Stock management' },
    { icon: DollarSign, label: 'Financial', path: '/financial', description: 'Payments & reports' },
    { icon: Users, label: 'Burials', path: '/burials', description: 'Records & locations' },
    { icon: FileSignature, label: 'Contracts', path: '/contracts', description: 'Agreements & docs' },
    { icon: Gift, label: 'Grants', path: '/grants', description: 'Funding & benefits' },
    { icon: FileText, label: 'Customers', path: '/customers', description: 'Contact information' },
  ];

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const ThemeIcon = theme === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun;

  const currentPage = navItems.find(i => isActive(i.path));

  return (
    <div className="min-h-screen bg-background flex">

      {/* ══════════════════════════════════════════
          DESKTOP SIDEBAR — dark DMP forest green
          ══════════════════════════════════════════ */}
      <aside
        className="hidden lg:flex flex-col w-64 min-h-screen sticky top-0 shrink-0 overflow-hidden"
        style={{ backgroundColor: DMP_GREEN }}
      >
        {/* Brand header */}
        <div className="px-5 pt-6 pb-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-3 mb-1">
            {/* Gold monogram badge */}
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shrink-0"
              style={{ backgroundColor: DMP_GOLD }}
            >
              <span className="font-bold text-base" style={{ color: DMP_GREEN }}>
                {COMPANY.abbreviation}
              </span>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-white text-[13px] leading-tight truncate">
                {COMPANY.shortName}
              </p>
              <p className="text-[11px] truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {COMPANY.system.name}
              </p>
            </div>
          </div>

          {/* DMP logo image — white filtered */}
          <div className="mt-4">
            <img
              src="/dmp-logo.png"
              alt="Detroit Memorial Park"
              className="h-7 object-contain object-left"
              style={{ filter: 'brightness(0) invert(1)', opacity: 0.7 }}
            />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <p
            className="text-[10px] font-semibold uppercase tracking-widest px-3 pb-3"
            style={{ color: 'rgba(255,255,255,0.28)' }}
          >
            Navigation
          </p>
          <div className="space-y-0.5">
            {navItems.map((item) => {
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 relative group"
                  style={{
                    backgroundColor: active ? 'rgba(196,154,44,0.14)' : 'transparent',
                    color: active ? DMP_GOLD : 'rgba(255,255,255,0.6)',
                  }}
                  onMouseEnter={e => {
                    if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.06)';
                  }}
                  onMouseLeave={e => {
                    if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                  }}
                >
                  {/* Left gold accent bar */}
                  {active && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full"
                      style={{ backgroundColor: DMP_GOLD }}
                    />
                  )}
                  <item.icon
                    size={17}
                    strokeWidth={active ? 2.5 : 1.8}
                    style={{ color: active ? DMP_GOLD : 'rgba(255,255,255,0.5)', flexShrink: 0 }}
                  />
                  <span className="text-sm font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Sidebar footer */}
        <div className="px-3 pb-5 space-y-2">
          {/* 100-year anniversary card */}
          <div
            className="rounded-xl px-4 py-3"
            style={{
              background: 'linear-gradient(135deg, rgba(196,154,44,0.18) 0%, rgba(196,154,44,0.06) 100%)',
              border: '1px solid rgba(196,154,44,0.22)',
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Star size={12} style={{ color: DMP_GOLD }} strokeWidth={2.5} />
              <p className="text-[11px] font-bold tracking-wide" style={{ color: DMP_GOLD }}>
                100 Years of Service
              </p>
            </div>
            <p className="text-[10px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Est. {COMPANY.established} · Serving Michigan families across three locations.
            </p>
          </div>

          {/* Sign out */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150"
            style={{ color: 'rgba(255,255,255,0.42)' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(239,68,68,0.14)';
              (e.currentTarget as HTMLElement).style.color = '#fca5a5';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.42)';
            }}
          >
            <LogOut size={16} strokeWidth={1.8} />
            <span className="text-sm font-medium">Sign out</span>
          </button>
        </div>
      </aside>

      {/* ══════════════════════════════════════════
          RIGHT SIDE: TOPBAR + CONTENT
          ══════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">

        {/* Topbar */}
        <header className="bg-card border-b border-border sticky top-0 z-20 h-14 flex items-center px-4 lg:px-6 gap-4 shadow-sm">

          {/* Mobile: DMP badge */}
          <div className="lg:hidden flex items-center gap-2 flex-1 min-w-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow"
              style={{ backgroundColor: DMP_GREEN }}
            >
              <span className="font-bold text-xs" style={{ color: DMP_GOLD }}>
                {COMPANY.abbreviation}
              </span>
            </div>
            <span className="font-semibold text-foreground text-sm truncate">{COMPANY.shortName}</span>
          </div>

          {/* Desktop: current page breadcrumb */}
          <div className="hidden lg:flex flex-1 items-center gap-2">
            {currentPage && (
              <>
                <span className="text-foreground-muted text-sm">{COMPANY.abbreviation}</span>
                <span className="text-foreground-muted text-sm">/</span>
                <span className="text-foreground text-sm font-medium">{currentPage.label}</span>
              </>
            )}
          </div>

          {/* Right: theme + user */}
          <div className="flex items-center gap-1 shrink-0">

            {/* Theme picker */}
            <div className="relative" ref={themeMenuRef}>
              <button
                onClick={() => setThemeMenuOpen(v => !v)}
                className="p-2 rounded-lg text-foreground-muted hover:text-foreground hover:bg-accent transition-colors"
                aria-label="Theme"
              >
                <ThemeIcon size={17} />
              </button>
              {themeMenuOpen && (
                <div className="absolute right-0 mt-2 w-36 bg-card rounded-lg shadow-xl border border-border py-1 z-50 animate-scale-in origin-top-right">
                  {([
                    { value: 'light' as const, Icon: Sun, label: 'Light' },
                    { value: 'dark' as const, Icon: Moon, label: 'Dark' },
                    { value: 'system' as const, Icon: Monitor, label: 'System' },
                  ]).map(({ value, Icon, label }) => (
                    <button
                      key={value}
                      onClick={() => { setTheme(value); setThemeMenuOpen(false); }}
                      className={`w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-accent transition-colors ${
                        theme === value ? 'text-primary font-medium' : 'text-foreground'
                      }`}
                    >
                      <Icon size={14} /> {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* User menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(v => !v)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent transition-colors"
              >
                <Avatar fallback={user?.name?.charAt(0)?.toUpperCase() || 'U'} size="sm" />
                <div className="hidden md:block text-left">
                  <div className="text-sm font-medium text-foreground leading-tight">{user?.name}</div>
                  <div className="text-xs text-foreground-muted capitalize leading-tight">{user?.role}</div>
                </div>
                <ChevronDown size={13} className="text-foreground-muted hidden md:block" />
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-card rounded-lg shadow-xl border border-border py-1 z-50 animate-scale-in origin-top-right">
                  <div className="px-3 py-2.5 border-b border-border">
                    <div className="text-sm font-semibold text-foreground">{user?.name}</div>
                    <div className="text-xs text-foreground-muted capitalize mt-0.5">{user?.role}</div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full px-3 py-2.5 text-sm text-left flex items-center gap-2 text-danger hover:bg-danger-50 dark:hover:bg-danger-950 transition-colors"
                  >
                    <LogOut size={14} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main content area */}
        <main className="flex-1 p-4 lg:p-8 pb-24 lg:pb-8">

          {/* Demo banner */}
          {isDemo && (
            <div className="max-w-7xl mx-auto mb-6 animate-slide-up">
              <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-amber-500/20 rounded-full flex items-center justify-center shrink-0">
                    <Eye size={14} className="text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Preview Mode</p>
                    <p className="text-xs text-amber-700/70 dark:text-amber-300/70">
                      You're viewing demo data. Sign in to access real features.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 rounded-lg transition-colors shrink-0"
                >
                  Exit <X size={12} />
                </button>
              </div>
            </div>
          )}

          <div className="max-w-7xl mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>

      {/* ══════════════════════════════════════════
          MOBILE BOTTOM NAV — dark green
          ══════════════════════════════════════════ */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-20"
        style={{ backgroundColor: DMP_GREEN, borderTop: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex justify-around items-center px-1 py-1 pb-safe">
          {navItems.slice(0, 4).map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className="flex flex-col items-center gap-0.5 py-2 px-3 min-w-[52px]"
              >
                <item.icon
                  size={21}
                  strokeWidth={active ? 2.5 : 1.6}
                  style={{ color: active ? DMP_GOLD : 'rgba(255,255,255,0.4)' }}
                />
                <span
                  className="text-[9px] font-semibold leading-none mt-0.5 tracking-wide"
                  style={{ color: active ? DMP_GOLD : 'rgba(255,255,255,0.4)' }}
                >
                  {item.label === 'Work Orders' ? 'Orders' : item.label}
                </span>
              </Link>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center gap-0.5 py-2 px-3 min-w-[52px]"
          >
            <MoreHorizontal
              size={21}
              strokeWidth={1.6}
              style={{
                color: navItems.slice(4).some(i => isActive(i.path)) ? DMP_GOLD : 'rgba(255,255,255,0.4)',
              }}
            />
            <span
              className="text-[9px] font-semibold leading-none mt-0.5 tracking-wide"
              style={{
                color: navItems.slice(4).some(i => isActive(i.path)) ? DMP_GOLD : 'rgba(255,255,255,0.4)',
              }}
            >
              More
            </span>
          </button>
        </div>
      </nav>

      {/* AI Assistant — floating panel */}
      <AIAssistant />

      {/* More drawer */}
      {moreOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-30 animate-fade-in"
            onClick={() => setMoreOpen(false)}
          />
          <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-card rounded-t-2xl z-40 shadow-2xl border-t border-border pb-safe animate-slide-up">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-border rounded-full" />
            </div>
            <div className="px-4 pb-6 space-y-0.5">
              <p className="text-[10px] font-semibold text-foreground-muted uppercase tracking-widest px-3 py-2.5">
                More
              </p>
              {navItems.slice(4).map((item) => {
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className="flex items-center gap-4 px-3 py-3 rounded-xl transition-colors"
                    style={active
                      ? { backgroundColor: 'rgba(196,154,44,0.1)', color: DMP_GOLD }
                      : { color: 'inherit' }
                    }
                    onMouseEnter={e => {
                      if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'hsl(var(--accent))';
                    }}
                    onMouseLeave={e => {
                      if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                    }}
                  >
                    <div className="p-2 rounded-lg bg-background-subtle shrink-0">
                      <item.icon size={19} strokeWidth={active ? 2.5 : 2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{item.label}</p>
                      <p className="text-xs text-foreground-muted">{item.description}</p>
                    </div>
                    {active && (
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: DMP_GOLD }} />
                    )}
                  </Link>
                );
              })}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-4 px-3 py-3 rounded-xl text-danger hover:bg-danger-50 dark:hover:bg-danger-950 transition-colors border-t border-border mt-1 pt-3"
              >
                <div className="p-2 rounded-lg bg-danger-50 dark:bg-danger-950 shrink-0">
                  <LogOut size={19} />
                </div>
                <span className="font-medium text-sm">Sign out</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
