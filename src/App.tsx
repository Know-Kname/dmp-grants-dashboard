import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { ThemeProvider } from './lib/theme';
import { QueryProvider } from './lib/query';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import WorkOrders from './pages/WorkOrders';
import Grants from './pages/Grants';
import Inventory from './pages/Inventory';
import Financial from './pages/Financial';
import Burials from './pages/Burials';
import Contracts from './pages/Contracts';
import Customers from './pages/Customers';
import Vendors from './pages/Vendors';
import Cemeteries from './pages/Cemeteries';
import ErrorBoundary from './components/ErrorBoundary';

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
