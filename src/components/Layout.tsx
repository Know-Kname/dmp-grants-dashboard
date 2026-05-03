import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import {
  Home, FileText, Package, DollarSign, Users,
  FileSignature, Gift, ClipboardList, LogOut,
  Sun, Moon, Monitor, ChevronDown, Phone, ExternalLink, Eye, X,
  MoreHorizontal, Building2, Map,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { Avatar } from './ui';
import { COMPANY } from '../config/company';
import AIAssistant from './AIAssistant';

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

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
        setThemeMenuOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close More sheet on navigation
  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { icon: Home, label: 'Dashboard', path: '/', description: 'Overview & metrics' },
    { icon: ClipboardList, label: 'Work Orders', path: '/work-orders', description: 'Tasks & maintenance' },
    { icon: Package, label: 'Inventory', path: '/inventory', description: 'Stock management' },
    { icon: DollarSign, label: 'Financial', path: '/financial', description: 'Payments & reports' },
    { icon: Users, label: 'Burials', path: '/burials', description: 'Records & locations' },
    { icon: FileSignature, label: 'Contracts', path: '/contracts', description: 'Agreements & docs' },
    { icon: Gift, label: 'Grants', path: '/grants', description: 'Funding & benefits' },
    { icon: FileText, label: 'Customers', path: '/customers', description: 'Contact information' },
    { icon: Building2, label: 'Vendors', path: '/vendors', description: 'Supplier management' },
    { icon: Map, label: 'Cemeteries', path: '/cemeteries', description: 'Plot & grave inventory' },
  ];

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const ThemeIcon = theme === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun;

  return (
    <div className="min-h-screen bg-background transition-colors duration-200">
      {/* Top Navigation */}
      <nav className="bg-card border-b border-border sticky top-0 z-20 shadow-sm">
        <div className="px-4 lg:px-6">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary-800 rounded-xl flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-lg">{COMPANY.abbreviation}</span>
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-foreground">{COMPANY.shortName}</h1>
                <p className="text-xs text-foreground-muted">{COMPANY.system.name}</p>
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2">
              {/* Theme Toggle */}
              <div className="relative" ref={themeMenuRef}>
                <button
                  onClick={() => setThemeMenuOpen(!themeMenuOpen)}
                  className="p-2 rounded-lg text-foreground-muted hover:text-foreground hover:bg-accent transition-colors"
                  aria-label="Toggle theme"
                >
                  <ThemeIcon size={20} />
                </button>

                {themeMenuOpen && (
                  <div className="absolute right-0 mt-2 w-36 bg-card rounded-lg shadow-lg border border-border py-1 animate-scale-in origin-top-right">
                    <button
                      onClick={() => { setTheme('light'); setThemeMenuOpen(false); }}
                      className={`w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-accent transition-colors ${theme === 'light' ? 'text-primary font-medium' : 'text-foreground'}`}
                    >
                      <Sun size={16} /> Light
                    </button>
                    <button
                      onClick={() => { setTheme('dark'); setThemeMenuOpen(false); }}
                      className={`w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-accent transition-colors ${theme === 'dark' ? 'text-primary font-medium' : 'text-foreground'}`}
                    >
                      <Moon size={16} /> Dark
                    </button>
                    <button
                      onClick={() => { setTheme('system'); setThemeMenuOpen(false); }}
                      className={`w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-accent transition-colors ${theme === 'system' ? 'text-primary font-medium' : 'text-foreground'}`}
                    >
                      <Monitor size={16} /> System
                    </button>
                  </div>
                )}
              </div>

              {/* User Menu */}
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent transition-colors"
                >
                  <Avatar
                    fallback={user?.name?.charAt(0)?.toUpperCase() || 'U'}
                    size="sm"
                  />
                  <div className="hidden md:block text-left">
                    <div className="text-sm font-medium text-foreground">{user?.name}</div>
                    <div className="text-xs text-foreground-muted capitalize">{user?.role}</div>
                  </div>
                  <ChevronDown size={16} className="text-foreground-muted hidden md:block" />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-card rounded-lg shadow-lg border border-border py-1 animate-scale-in origin-top-right">
                    <div className="px-3 py-2 border-b border-border md:hidden">
                      <div className="text-sm font-medium text-foreground">{user?.name}</div>
                      <div className="text-xs text-foreground-muted capitalize">{user?.role}</div>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full px-3 py-2 text-sm text-left flex items-center gap-2 text-danger hover:bg-danger-50 dark:hover:bg-danger-950 transition-colors"
                    >
                      <LogOut size={16} /> Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-sidebar border-r border-border min-h-[calc(100vh-4rem)] sticky top-16 hidden lg:block">
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150
                    ${active
                      ? 'bg-sidebar-active text-sidebar-active-foreground font-medium shadow-sm'
                      : 'text-sidebar-foreground hover:bg-sidebar-hover hover:text-foreground'
                    }
                  `}
                >
                  <item.icon size={20} className={active ? 'text-primary' : ''} />
                  <div className="flex-1 min-w-0">
                    <span className="block">{item.label}</span>
                  </div>
                  {active && (
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="absolute bottom-4 left-3 right-3 p-3 bg-background-subtle rounded-lg border border-border">
            <div className="text-xs text-foreground-muted space-y-2">
              <div className="flex items-center gap-2">
                <Phone size={12} />
                <a
                  href={`tel:${COMPANY.phone.main.replace(/[^\d]/g, '')}`}
                  className="hover:text-foreground transition-colors"
                >
                  {COMPANY.phone.main}
                </a>
              </div>
              <a
                href={COMPANY.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-foreground transition-colors"
              >
                <ExternalLink size={12} />
                <span>detroitmemorialpark.org</span>
              </a>
              <div className="pt-2 border-t border-border">
                <div className="font-medium">v{COMPANY.system.version}</div>
                <div>{COMPANY.legal.copyright}</div>
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile Bottom Navigation */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border z-20 pb-safe">
          <div className="flex justify-around items-center px-1 py-1">
            {navItems.slice(0, 4).map((item) => {
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="flex flex-col items-center gap-0.5 py-1.5 px-3 min-w-[56px] group"
                >
                  <div className={`p-1.5 rounded-xl transition-all duration-150 ${
                    active ? 'bg-primary/10' : 'group-active:bg-accent'
                  }`}>
                    <item.icon
                      size={22}
                      className={active ? 'text-primary' : 'text-foreground-muted'}
                      strokeWidth={active ? 2.5 : 2}
                    />
                  </div>
                  <span className={`text-[10px] font-medium leading-none ${
                    active ? 'text-primary' : 'text-foreground-muted'
                  }`}>
                    {item.label === 'Work Orders' ? 'Orders' : item.label}
                  </span>
                </Link>
              );
            })}

            {/* More button */}
            <button
              onClick={() => setMoreOpen(true)}
              className="flex flex-col items-center gap-0.5 py-1.5 px-3 min-w-[56px] group"
            >
              <div className={`p-1.5 rounded-xl transition-all duration-150 ${
                navItems.slice(4).some(i => isActive(i.path)) ? 'bg-primary/10' : 'group-active:bg-accent'
              }`}>
                <MoreHorizontal
                  size={22}
                  className={navItems.slice(4).some(i => isActive(i.path)) ? 'text-primary' : 'text-foreground-muted'}
                />
              </div>
              <span className={`text-[10px] font-medium leading-none ${
                navItems.slice(4).some(i => isActive(i.path)) ? 'text-primary' : 'text-foreground-muted'
              }`}>
                More
              </span>
            </button>
          </div>
        </nav>

        {/* More Sheet — slide-up drawer for remaining nav items */}
        {moreOpen && (
          <>
            {/* Scrim */}
            <div
              className="lg:hidden fixed inset-0 bg-black/40 z-30 animate-fade-in"
              onClick={() => setMoreOpen(false)}
            />
            {/* Sheet */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-card rounded-t-2xl z-40 shadow-2xl border-t border-border pb-safe animate-slide-up">
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 bg-border rounded-full" />
              </div>
              <div className="px-4 pb-6 space-y-1">
                <p className="text-xs font-semibold text-foreground-muted uppercase tracking-widest px-3 py-2">
                  More
                </p>
                {navItems.slice(4).map((item) => {
                  const active = isActive(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-4 px-3 py-3 rounded-xl transition-colors ${
                        active
                          ? 'bg-primary/10 text-primary'
                          : 'text-foreground hover:bg-accent'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${
                        active ? 'bg-primary/20' : 'bg-background-subtle'
                      }`}>
                        <item.icon size={20} strokeWidth={active ? 2.5 : 2} />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.label}</p>
                        <p className="text-xs text-foreground-muted">{item.description}</p>
                      </div>
                      {active && (
                        <div className="w-2 h-2 bg-primary rounded-full" />
                      )}
                    </Link>
                  );
                })}
                {/* Sign out shortcut */}
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-4 px-3 py-3 rounded-xl text-danger hover:bg-danger-50 dark:hover:bg-danger-950 transition-colors mt-2 border-t border-border pt-4"
                >
                  <div className="p-2 rounded-lg bg-danger-50 dark:bg-danger-950">
                    <LogOut size={20} />
                  </div>
                  <span className="font-medium text-sm">Sign out</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-8 pb-20 lg:pb-8 min-h-[calc(100vh-4rem)]">
          {/* Demo Mode Banner */}
          {isDemo && (
            <div className="max-w-7xl mx-auto mb-4 animate-slide-up">
              <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-amber-500/20 rounded-full flex items-center justify-center">
                    <Eye size={16} className="text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      Preview Mode
                    </p>
                    <p className="text-xs text-amber-700/70 dark:text-amber-300/70">
                      You're viewing demo data. Sign in to access real features.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 rounded-md transition-colors"
                >
                  Exit Preview
                  <X size={14} />
                </button>
              </div>
            </div>
          )}
          
          <div className="max-w-7xl mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
      <AIAssistant />
    </div>
  );
}
