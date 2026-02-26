import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { ThemeProvider } from './lib/theme';
import { QueryProvider } from './lib/query';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import WorkOrders from './pages/WorkOrders';
import Grants from './pages/Grants';
import ErrorBoundary from './components/ErrorBoundary';

// ProtectedRoute now consumes the stable `isAuthenticated` field
// instead of re-deriving truthiness from `user` at the call site.
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
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
        <Route path="inventory" element={<div className="text-2xl text-foreground">Inventory (Coming Soon)</div>} />
        <Route path="financial" element={<div className="text-2xl text-foreground">Financial (Coming Soon)</div>} />
        <Route path="burials" element={<div className="text-2xl text-foreground">Burials (Coming Soon)</div>} />
        <Route path="contracts" element={<div className="text-2xl text-foreground">Contracts (Coming Soon)</div>} />
        <Route path="grants" element={<Grants />} />
        <Route path="customers" element={<div className="text-2xl text-foreground">Customers (Coming Soon)</div>} />
      </Route>
      {/* Fallback: redirect any unknown path to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <QueryProvider>
        <ThemeProvider>
          <AuthProvider>
            <ErrorBoundary>
              <AppRoutes />
            </ErrorBoundary>
          </AuthProvider>
        </ThemeProvider>
      </QueryProvider>
    </BrowserRouter>
  );
}
