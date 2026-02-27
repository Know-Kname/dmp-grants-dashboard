import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import WorkOrders from './pages/WorkOrders';
import Grants from './pages/Grants';

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mb-4">
        <span className="text-2xl">🚧</span>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
      <p className="text-gray-500">This feature is coming soon!</p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="work-orders" element={<WorkOrders />} />
            <Route path="inventory" element={<ComingSoon title="Inventory Management" />} />
            <Route path="financial" element={<ComingSoon title="Financial Management" />} />
            <Route path="burials" element={<ComingSoon title="Burial Records" />} />
            <Route path="contracts" element={<ComingSoon title="Contracts" />} />
            <Route path="grants" element={<Grants />} />
            <Route path="customers" element={<ComingSoon title="Customer Management" />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}
