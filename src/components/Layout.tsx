import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  Home, FileText, Package, DollarSign, Users,
  FileSignature, Gift, ClipboardList, User,
  ChevronRight, Menu, X
} from 'lucide-react';
import { useState } from 'react';

// Default user for demo mode (no authentication)
const defaultUser = {
  name: 'DMP Admin',
  role: 'Administrator'
};

export default function Layout() {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { icon: Home, label: 'Dashboard', path: '/' },
    { icon: ClipboardList, label: 'Work Orders', path: '/work-orders' },
    { icon: Package, label: 'Inventory', path: '/inventory' },
    { icon: DollarSign, label: 'Financial', path: '/financial' },
    { icon: Users, label: 'Burials', path: '/burials' },
    { icon: FileSignature, label: 'Contracts', path: '/contracts' },
    { icon: Gift, label: 'Grants', path: '/grants' },
    { icon: FileText, label: 'Customers', path: '/customers' },
  ];

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-secondary-50 flex">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-secondary-900/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50 w-72 bg-white border-r border-secondary-200
          transform transition-transform duration-300 ease-in-out lg:transform-none flex flex-col
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo Area */}
        <div className="h-20 flex items-center px-6 border-b border-secondary-100 bg-white/50 backdrop-blur-sm">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-primary-800 rounded-xl shadow-lg shadow-primary-500/20 flex items-center justify-center transform transition-transform hover:scale-105">
              <span className="text-white font-bold text-lg tracking-wider">DMP</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-secondary-900 leading-tight">Detroit Memorial</h1>
              <p className="text-xs text-secondary-500 font-medium tracking-wide">MANAGEMENT SYSTEM</p>
            </div>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="ml-auto lg:hidden text-secondary-400 hover:text-secondary-600"
          >
            <X size={24} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1 custom-scrollbar">
          <div className="text-xs font-semibold text-secondary-400 uppercase tracking-wider mb-4 px-4">
            Main Menu
          </div>
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`
                  group flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200
                  ${active
                    ? 'bg-primary-50 text-primary-700 shadow-sm'
                    : 'text-secondary-600 hover:bg-secondary-50 hover:text-secondary-900'
                  }
                `}
              >
                <item.icon
                  size={20}
                  className={`transition-colors duration-200 ${active ? 'text-primary-600' : 'text-secondary-400 group-hover:text-secondary-600'}`}
                />
                <span className="font-medium">{item.label}</span>
                {active && (
                  <ChevronRight size={16} className="ml-auto text-primary-400" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-secondary-100 bg-secondary-50/30">
          <div className="flex items-center space-x-3 p-2 rounded-xl bg-white border border-secondary-100 shadow-sm">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-100 to-primary-200 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
              <User size={20} className="text-primary-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-secondary-900 truncate">{defaultUser.name}</div>
              <div className="text-xs text-secondary-500 truncate">{defaultUser.role}</div>
            </div>
          </div>
          <div className="mt-4 flex justify-between items-center px-2 text-xs text-secondary-400">
            <span>v1.0.0</span>
            <span>© 2025 DMP</span>
          </div>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden h-16 bg-white border-b border-secondary-200 flex items-center justify-between px-4 sticky top-0 z-30">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 -ml-2 text-secondary-600 hover:bg-secondary-50 rounded-lg"
            >
              <Menu size={24} />
            </button>
            <span className="font-bold text-secondary-900">DMP System</span>
          </div>
          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold text-sm">
            {defaultUser.name[0]}
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-secondary-50 p-4 lg:p-8 scroll-smooth">
          <div className="max-w-7xl mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
