import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { InvoicePage } from './components/InvoicePage';
import { InvoicesRegistryPage } from './components/InvoicesRegistryPage';
import { AddClientPage } from './components/AddClientPage';
import { ClientsPage } from './components/ClientsPage';
import { ProductsPage } from './components/ProductsPage';
import { CompaniesPage } from './components/CompaniesPage';
import { SettingsPage } from './components/SettingsPage';
import { ToastProvider } from './context/ToastContext';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const { activeTab, loading } = useApp();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen w-full bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-slate-500">Загрузка базы данных...</p>
        </div>
      </div>
    );
  }

  const pages: Record<string, React.ReactNode> = {
    'invoice': <InvoicePage />,
    'add-client': <AddClientPage />,
    'registry': <InvoicesRegistryPage />,
    'clients': <ClientsPage />,
    'products': <ProductsPage />,
    'companies': <CompaniesPage />,
    'settings': <SettingsPage />,
  };

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />
      <main className="flex-1 overflow-y-auto max-h-screen">
        {pages[activeTab] || <InvoicePage />}
      </main>
    </div>
  );
}

export function App() {
  return (
    <ToastProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ToastProvider>
  );
}
