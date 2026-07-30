import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { ThemeProvider } from './lib/theme';
import { QueryProvider } from './lib/query';
import { ToastProvider } from './lib/toast';
import { MotionProvider } from './lib/motion';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ErrorBoundary from './components/ErrorBoundary';

// Lazy-loaded pages — each chunk only downloads when first visited
const WorkOrders  = lazy(() => import('./pages/WorkOrders'));
const Grants      = lazy(() => import('./pages/Grants'));
const Inventory   = lazy(() => import('./pages/Inventory'));
const Financial   = lazy(() => import('./pages/Financial'));
const Burials     = lazy(() => import('./pages/Burials'));
const Contracts   = lazy(() => import('./pages/Contracts'));
const Customers   = lazy(() => import('./pages/Customers'));
const Vendors     = lazy(() => import('./pages/Vendors'));
const Cemeteries  = lazy(() => import('./pages/Cemeteries'));
const MemorialPage = lazy(() => import('./pages/MemorialPage'));

function PageSpinner() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[50vh]">
      <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading spinner while checking auth status
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/memorial/:id" element={<MemorialPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="work-orders" element={<WorkOrders />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="financial" element={<Financial />} />
          <Route path="burials" element={<Burials />} />
          <Route path="contracts" element={<Contracts />} />
          <Route path="grants" element={<Grants />} />
          <Route path="customers" element={<Customers />} />
          <Route path="vendors" element={<Vendors />} />
          <Route path="cemeteries" element={<Cemeteries />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default function App() {
  // The v7_startTransition / v7_relativeSplatPath future flags were removed
  // when this app moved to react-router-dom 7 — both behaviours are the
  // default in v7, and the `future` prop no longer accepts them. Opting in
  // on v6 was exactly what made this a no-behaviour-change upgrade.
  return (
    <BrowserRouter>
      <QueryProvider>
        <ThemeProvider>
          <AuthProvider>
            <MotionProvider>
              <ToastProvider>
                <ErrorBoundary>
                  <AppRoutes />
                </ErrorBoundary>
              </ToastProvider>
            </MotionProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryProvider>
    </BrowserRouter>
  );
}
