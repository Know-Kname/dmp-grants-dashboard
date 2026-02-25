import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { AuthProvider, useAuth } from './lib/auth';
import { ThemeProvider } from './lib/theme';
import { QueryProvider } from './lib/query';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import WorkOrders from './pages/WorkOrders';
import Grants from './pages/Grants';
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
        <Route path="inventory" element={<div className="text-2xl text-foreground">Inventory (Coming Soon)</div>} />
        <Route path="financial" element={<div className="text-2xl text-foreground">Financial (Coming Soon)</div>} />
        <Route path="burials" element={<div className="text-2xl text-foreground">Burials (Coming Soon)</div>} />
        <Route path="contracts" element={<div className="text-2xl text-foreground">Contracts (Coming Soon)</div>} />
        <Route path="grants" element={<Grants />} />
        <Route path="customers" element={<div className="text-2xl text-foreground">Customers (Coming Soon)</div>} />
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
              <SpeedInsights />
            </ErrorBoundary>
          </AuthProvider>
        </ThemeProvider>
      </QueryProvider>
    </BrowserRouter>
  );
}
