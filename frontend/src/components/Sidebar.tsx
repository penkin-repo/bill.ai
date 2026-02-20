import { useApp } from '../context/AppContext';
import type { ComponentType } from 'react';
import {
  FileText, Users, Package, Building2, Settings,
  Zap, UserPlus, ListOrdered, RefreshCw,
} from 'lucide-react';
import { cn } from '../utils/cn';

interface NavItem {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    title: 'Действия',
    items: [
      { id: 'invoice', label: 'Выставить счёт', icon: Zap },
      { id: 'add-client', label: 'Добавить клиента', icon: UserPlus },
    ],
  },
  {
    title: 'Справочники',
    items: [
      { id: 'registry', label: 'Реестр счетов', icon: ListOrdered },
      { id: 'clients', label: 'Клиенты', icon: Users },
      { id: 'products', label: 'Товары', icon: Package },
      { id: 'companies', label: 'Мои компании', icon: Building2 },
    ],
  },
  {
    title: 'Система',
    items: [
      { id: 'settings', label: 'Настройки', icon: Settings },
    ],
  },
];

export function Sidebar() {
  const { activeTab, setActiveTab, syncing, lastSyncText, syncAll } = useApp();

  return (
    <aside className="w-60 bg-slate-900 text-white flex flex-col min-h-screen shrink-0">
      <div className="p-4 border-b border-slate-700">
        <h1 className="text-lg font-bold flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-400" />
          Bill.ai
        </h1>
        <p className="text-[11px] text-slate-500 mt-0.5">Генератор счетов • v1.0</p>
      </div>

      <nav className="flex-1 py-2 overflow-y-auto">
        {sections.map((section, si) => (
          <div key={section.title}>
            {si > 0 && <div className="border-t border-slate-800 my-1" />}
            <p className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              {section.title}
            </p>
            {section.items.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left',
                  activeTab === tab.id
                    ? 'bg-blue-600/90 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                )}
              >
                <tab.icon className="w-4 h-4 shrink-0" />
                {tab.label}
              </button>
            ))}
          </div>
        ))}
      </nav>

      {/* Sync status at bottom */}
      <div className="p-3 border-t border-slate-800">
        <button
          onClick={() => syncAll()}
          disabled={syncing}
          className="w-full flex items-center gap-2 text-[11px] text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-60"
        >
          <RefreshCw className={cn('w-3 h-3', syncing ? 'animate-spin' : '')} />
          {syncing ? 'Синхронизация...' : 'Google Sheets синхронизация'}
        </button>

        <div className="mt-2 text-[10px] text-slate-600">Последняя синхронизация: {lastSyncText || '-'}</div>

        <button
          onClick={() => setActiveTab('settings')}
          className="mt-2 w-full text-left text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
        >
          Настройки →
        </button>
      </div>
    </aside>
  );
}
