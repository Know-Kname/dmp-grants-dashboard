import { lazy, Suspense, useSyncExternalStore } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { isRecoveryPending, subscribeRecoveryPending } from './lib/recovery';
import { ThemeProvider } from './lib/theme';
import { QueryProvider } from './lib/query';
import { ToastProvider } from './lib/toast';
import { MotionProvider } from './lib/motion';
import Layout from './components/Layout';
import { Button } from './components/ui';
import { ShieldAlert } from 'lucide-react';
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
const Users = lazy(() => import('./pages/Users'));

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

/**
 * Full-page notice for an account that is authenticated but cannot use the app.
 *
 * Deliberately a screen rather than a redirect to `/login`: the user's password
 * is fine and signing in again would just land them here, so telling them what
 * actually happened — and who to ask — is the only useful thing to show.
 */
function AccountNotice({
  title,
  body,
  action,
}: {
  title: string;
  body: React.ReactNode;
  action?: React.ReactNode;
}) {
  const { logout } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full bg-card border border-border rounded-xl shadow-sm p-8 text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-danger-100 dark:bg-danger-950 text-danger flex items-center justify-center">
          <ShieldAlert size={24} />
        </div>
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        <p className="text-sm text-foreground-muted leading-relaxed">{body}</p>
        <div className="flex items-center justify-center gap-2 pt-2">
          {action}
          <Button variant="secondary" onClick={() => logout()}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, profileStatus, refreshProfile } = useAuth();
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

  // Authentication is settled; authorization is not. Every RLS policy keys off
  // `profiles`, so rendering the app before that row is known means rendering it
  // with an unknown role — and a UI that has to take buttons away a moment
  // later. Wait.
  if (profileStatus === 'idle' || profileStatus === 'loading') {
    return <FullPageSpinner />;
  }

  // RLS denies SELECT to a deactivated profile, so this user would otherwise get
  // the whole app with every list empty — indistinguishable from the database
  // having been wiped. Say what actually happened.
  if (profileStatus === 'deactivated') {
    return (
      <AccountNotice
        title="Account deactivated"
        body="Your access to the Detroit Memorial Park CMS has been turned off. Contact an administrator if you think this is a mistake."
      />
    );
  }

  if (profileStatus === 'missing') {
    return (
      <AccountNotice
        title="No profile for this account"
        body="You are signed in, but this account has no profile record, so it has no role assigned. An administrator needs to set one up before you can use the system."
      />
    );
  }

  if (profileStatus === 'error') {
    return (
      <AccountNotice
        title="Could not load your account"
        body="Your role could not be read, so the app cannot tell what you are allowed to do. This is usually a connection problem."
        action={
          <Button variant="primary" onClick={refreshProfile}>
            Try again
          </Button>
        }
      />
    );
  }

  return <>{children}</>;
}

/**
 * A route only an admin may open.
 *
 * Nests inside `ProtectedRoute`, so by the time it runs the profile has loaded
 * and `role` is settled. A non-admin is sent to the dashboard rather than shown
 * a "forbidden" page: the route is not in their nav, so arriving here means a
 * bookmark or a typed URL, and bouncing is less alarming than an error.
 *
 * This hides the page. It does not protect the data — `profiles` is readable
 * beyond your own row, and writable at all, only for admins, in Postgres.
 */
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { can } = useAuth();
  if (!can('manageUsers')) return <Navigate to="/" replace />;
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
          <Route
            path="users"
            element={
              <AdminRoute>
                <Users />
              </AdminRoute>
            }
          />
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
