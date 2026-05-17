import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryProvider } from './lib/query';
import { ThemeProvider } from './lib/theme';
import { AuthProvider, useAuth } from './lib/auth';
import { ToastProvider } from './lib/toast';
import { ConfirmProvider } from './lib/confirm';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import { LoadingSpinner } from './components/ui';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Patients = lazy(() => import('./pages/Patients'));
const Providers = lazy(() => import('./pages/Providers'));
const TestCatalog = lazy(() => import('./pages/TestCatalog'));
const Orders = lazy(() => import('./pages/Orders'));
const Specimens = lazy(() => import('./pages/Specimens'));
const Results = lazy(() => import('./pages/Results'));
const Instruments = lazy(() => import('./pages/Instruments'));
const Reagents = lazy(() => import('./pages/Reagents'));
const Staff = lazy(() => import('./pages/Staff'));
const Billing = lazy(() => import('./pages/Billing'));
const QualityControl = lazy(() => import('./pages/QualityControl'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <LoadingSpinner size="lg" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Suspense fallback={<PageLoader />}><Login /></Suspense>} />

      <Route path="/dashboard" element={
        <ProtectedRoute><Suspense fallback={<PageLoader />}><Dashboard /></Suspense></ProtectedRoute>
      } />
      <Route path="/patients" element={
        <ProtectedRoute><Suspense fallback={<PageLoader />}><Patients /></Suspense></ProtectedRoute>
      } />
      <Route path="/providers" element={
        <ProtectedRoute><Suspense fallback={<PageLoader />}><Providers /></Suspense></ProtectedRoute>
      } />
      <Route path="/test-catalog" element={
        <ProtectedRoute><Suspense fallback={<PageLoader />}><TestCatalog /></Suspense></ProtectedRoute>
      } />
      <Route path="/orders" element={
        <ProtectedRoute><Suspense fallback={<PageLoader />}><Orders /></Suspense></ProtectedRoute>
      } />
      <Route path="/specimens" element={
        <ProtectedRoute><Suspense fallback={<PageLoader />}><Specimens /></Suspense></ProtectedRoute>
      } />
      <Route path="/results" element={
        <ProtectedRoute><Suspense fallback={<PageLoader />}><Results /></Suspense></ProtectedRoute>
      } />
      <Route path="/instruments" element={
        <ProtectedRoute><Suspense fallback={<PageLoader />}><Instruments /></Suspense></ProtectedRoute>
      } />
      <Route path="/reagents" element={
        <ProtectedRoute><Suspense fallback={<PageLoader />}><Reagents /></Suspense></ProtectedRoute>
      } />
      <Route path="/staff" element={
        <ProtectedRoute><Suspense fallback={<PageLoader />}><Staff /></Suspense></ProtectedRoute>
      } />
      <Route path="/billing" element={
        <ProtectedRoute><Suspense fallback={<PageLoader />}><Billing /></Suspense></ProtectedRoute>
      } />
      <Route path="/qc" element={
        <ProtectedRoute><Suspense fallback={<PageLoader />}><QualityControl /></Suspense></ProtectedRoute>
      } />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryProvider>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <ConfirmProvider>
              <ErrorBoundary>
                <BrowserRouter>
                  <AppRoutes />
                </BrowserRouter>
              </ErrorBoundary>
            </ConfirmProvider>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}
