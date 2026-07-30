import { lazy, Suspense, useSyncExternalStore } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { isRecoveryPending, subscribeRecoveryPending } from './lib/recovery';
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
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));

function PageSpinner() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[50vh]">
      <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
    </div>
  );
}

function FullPageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
    </div>
  );
}

/** Reactive view of "a recovery session exists whose password isn't set yet". */
function useRecoveryPending(): boolean {
  return useSyncExternalStore(subscribeRecoveryPending, isRecoveryPending, () => false);
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const recoveryPending = useRecoveryPending();

  // Show loading spinner while checking auth status
  if (isLoading) return <FullPageSpinner />;

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Supabase issues a *fully privileged* session for a recovery link — it is not
  // scoped to "may change password". Without this gate, anyone holding a working
  // reset link could skip the form and browse burial and financial records for
  // the life of that session, turning a one-hour email link into open-ended
  // read access. Confine them to the reset page until the password is set.
  if (recoveryPending) return <Navigate to="/reset-password" replace />;

  return <>{children}</>;
}

/**
 * A route that only makes sense when signed out.
 *
 * Sending an authenticated user to `/login` invites them to sign in as somebody
 * else on top of a live session, which is exactly the confused state the OAuth
 * callback has to defend against.
 */
function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const recoveryPending = useRecoveryPending();

  if (isLoading) return <FullPageSpinner />;

  // A pending recovery is not a normal session — the user still needs to finish
  // at `/reset-password`, so don't bounce them to the dashboard.
  if (isAuthenticated && !recoveryPending) return <Navigate to="/" replace />;

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <Login />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <PublicOnlyRoute>
              <ForgotPassword />
            </PublicOnlyRoute>
          }
        />
        {/*
          `/reset-password` is deliberately NOT wrapped: it must stay reachable
          while a recovery session is live, and it does its own — much stricter —
          check of whether a recovery actually happened.
        */}
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
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

        {/*
          Catch-all. Without it an unknown path matched nothing and rendered a
          blank page — indistinguishable from a crash. Routing through
          `ProtectedRoute` keeps the redirect honest: signed-in users land on the
          dashboard, signed-out users on the login page, and a mistyped URL never
          reveals which pages exist.
        */}
        <Route
          path="*"
          element={
            <ProtectedRoute>
              <Navigate to="/" replace />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
