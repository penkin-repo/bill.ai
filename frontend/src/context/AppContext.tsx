import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { models } from '../../wailsjs/go/models';

function api() {
  return (window as any)?.go?.main?.App;
}

interface AppState {
  clients: models.Client[];
  products: models.Product[];
  companies: models.MyCompany[];
  settings: {
    openrouterApiKey: string;
    aiModel: string;
    googleSheetId: string;
    googleServiceKey: string;
  };
  loading: boolean;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  refreshData: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  dbReady: boolean;
  syncing: boolean;
  lastSyncText: string;
  syncAll: () => Promise<void>;
}

const AppContext = createContext<AppState>({
  clients: [],
  products: [],
  companies: [],
  settings: {
    openrouterApiKey: '',
    aiModel: 'google/gemini-flash-1.5',
    googleSheetId: '',
    googleServiceKey: '',
  },
  loading: true,
  activeTab: 'invoice',
  setActiveTab: () => {},
  refreshData: async () => {},
  refreshSettings: async () => {},
  dbReady: false,
  syncing: false,
  lastSyncText: '-',
  syncAll: async () => {},
});

function pickLatestSync(times: (string | null | undefined)[]) {
  const cleaned = (times ?? []).map((t) => (t ?? '').trim()).filter(Boolean);
  if (cleaned.length === 0) return '-';
  cleaned.sort();
  return cleaned[cleaned.length - 1];
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [clients, setClients] = useState<models.Client[]>([]);
  const [products, setProducts] = useState<models.Product[]>([]);
  const [companies, setCompanies] = useState<models.MyCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('invoice');
  const [dbReady, setDbReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncText, setLastSyncText] = useState<string>('-');
  const [settings, setSettings] = useState<AppState['settings']>({
    openrouterApiKey: '',
    aiModel: 'google/gemini-flash-1.5',
    googleSheetId: '',
    googleServiceKey: '',
  });

  const refreshSettings = useCallback(async () => {
    try {
      const a = api();
      if (!a) return;
      const [k, m, sid, sk] = await Promise.all([
        a.GetSetting('openrouter_api_key'),
        a.GetSetting('ai_model'),
        a.GetSetting('google_sheet_id'),
        a.GetSetting('google_service_key'),
      ]);
      setSettings({
        openrouterApiKey: k || '',
        aiModel: m || 'google/gemini-flash-1.5',
        googleSheetId: sid || '',
        googleServiceKey: sk || '',
      });
    } catch {
      // ignore
    }
  }, []);

  const refreshLastSync = useCallback(async () => {
    try {
      const a = api();
      if (!a) {
        setLastSyncText('-');
        return;
      }
      const entities = ['clients', 'products', 'my_companies', 'invoices'];
      const res = await Promise.all(entities.map((e) => a.GetLastSyncTime(e)));
      setLastSyncText(pickLatestSync(res));
    } catch {
      setLastSyncText('-');
    }
  }, []);

  const refreshData = useCallback(async () => {
    if (!dbReady) return;
    try {
      const a = api();
      if (!a) return;
      const [cls, prods, comps] = await Promise.all([
        a.GetAllClients(),
        a.GetAllProducts(),
        a.GetAllMyCompanies(),
      ]);
      setClients(cls ?? []);
      setProducts(prods ?? []);
      setCompanies(comps ?? []);
      await refreshLastSync();
    } catch (e) {
      console.error('Error refreshing data:', e);
    }
  }, [dbReady, refreshLastSync]);

  const syncAll = useCallback(async () => {
    setSyncing(true);
    try {
      const a = api();
      if (!a) return;
      await a.SyncAll();
      await refreshData();
    } finally {
      setSyncing(false);
    }
  }, [refreshData]);

  useEffect(() => {
    setDbReady(true);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (dbReady) {
      void refreshSettings();
      void refreshData();
    }
  }, [dbReady, refreshData, refreshSettings]);

  return (
    <AppContext.Provider value={{
      clients, products, companies, settings, loading,
      activeTab, setActiveTab, refreshData, dbReady,
      refreshSettings,
      syncing, lastSyncText, syncAll,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
