import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, Search, Edit, X, Save, RefreshCw, Users, Eye, Upload, Download, ShieldAlert } from 'lucide-react';
import { models } from '../../wailsjs/go/models';

function api() {
  return (window as any)?.go?.main?.App;
}

const emptyClient: models.Client = {
  id: '', name: '', inn: '', kpp: '', address: '',
  bank_name: '', bank_bik: '', bank_corr_account: '', bank_account: '',
  contact_person: '', phone: '', email: '',
  comment: '', created_at: '', updated_at: '',
};

export function ClientsPage() {
  const { clients, refreshData, setActiveTab } = useApp();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<models.Client | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [viewClient, setViewClient] = useState<models.Client | null>(null);
  const [remoteResults, setRemoteResults] = useState<models.Client[] | null>(null);
  const [lastSync, setLastSync] = useState<string>('');
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [forceUploading, setForceUploading] = useState(false);
  const [forceDownloading, setForceDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadLastSync() {
      try {
        const a = api();
        if (!a) return;
        const t = await a.GetLastSyncTime('clients');
        if (!cancelled) setLastSync(t || '');
      } catch {
        // ignore
      }
    }
    void loadLastSync();
    return () => {
      cancelled = true;
    };
  }, []);


  useEffect(() => {
    let cancelled = false;
    const q = search.trim();
    if (!q) {
      setRemoteResults(null);
      return;
    }

    const t = setTimeout(async () => {
      try {
        const a = api();
        if (!a) return;
        const res = (await a.SearchClients(q)) as models.Client[];
        if (!cancelled) setRemoteResults(res ?? []);
      } catch {
        if (!cancelled) setRemoteResults(null);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [search]);

  const filtered = useMemo(() => {
    if (remoteResults) return remoteResults;
    if (!search.trim()) return clients;
    return clients.filter(c =>
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.inn?.includes(search)
    );
  }, [clients, remoteResults, search]);

  async function handleSave() {
    if (!editing) return;

    const name = (editing.name || '').trim();
    if (!name) {
      alert('Название организации обязательно');
      return;
    }
    const inn = (editing.inn || '').trim();
    if (!inn) {
      alert('ИНН обязателен');
      return;
    }
    const client: models.Client = { ...editing, id: inn, inn, name };

    const a = api();
    if (!a) {
      alert('Backend недоступен (нет window.go). Запускайте через wails dev.');
      return;
    }

    try {
      setSaving(true);
      await a.UpsertClient(client);
      await refreshData();
      setEditing(null);
      setShowForm(false);
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleSync() {
    const a = api();
    if (!a) return;
    setSyncing(true);
    try {
      await a.SyncAll();
      await refreshData();
    } catch (e: any) {
      alert('Ошибка синхронизации: ' + (e?.message ?? String(e)));
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Клиенты</h2>
          <p className="text-sm text-slate-500 mt-1">{clients.length} клиентов в базе</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSync} disabled={syncing}
            className="flex items-center gap-2 text-slate-600 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-sm disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Синхронизация...' : 'Синхронизировать'}
          </button>
          <button onClick={() => setActiveTab('add-client')}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" /> Добавить клиента
          </button>
        </div>
      </div>

      {/* Sync status + force sync */}
      <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
        {lastSync && (
          <div className="mb-2 text-xs text-green-600 flex items-center gap-2">
            <RefreshCw className="w-3 h-3" />
            Последняя синхронизация: {lastSync}
          </div>
        )}
        <div className="flex items-center gap-1.5 mb-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
          <p className="text-[11px] font-medium text-slate-500">Принудительная синхронизация (полная перезапись)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={forceUploading}
            onClick={() => {
              if (!confirm('ВНИМАНИЕ! Все данные в Google Sheets будут ПОЛНОСТЬЮ ЗАМЕНЕНЫ локальными данными. Продолжить?')) return;
              if (!confirm('Вы уверены? Это действие НЕОБРАТИМО.')) return;
              setForceUploading(true);
              const a = api();
              if (!a) { setForceUploading(false); return; }
              a.ForceUploadToGoogle()
                .then(() => { alert('Все данные загружены в Google Sheets.'); refreshData(); })
                .catch((e: any) => alert('Ошибка: ' + (e?.message ?? String(e))))
                .finally(() => setForceUploading(false));
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg text-xs hover:bg-orange-100 border border-orange-200 disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            {forceUploading ? 'Загрузка...' : 'Локальные → Google'}
          </button>
          <button
            disabled={forceDownloading}
            onClick={() => {
              if (!confirm('ВНИМАНИЕ! Все ЛОКАЛЬНЫЕ данные будут УДАЛЕНЫ и заменены данными из Google Sheets. Продолжить?')) return;
              if (!confirm('Вы уверены? Это действие НЕОБРАТИМО.')) return;
              setForceDownloading(true);
              const a = api();
              if (!a) { setForceDownloading(false); return; }
              a.ForceDownloadFromGoogle()
                .then(() => { alert('Локальная база перезаписана данными из Google.'); refreshData(); })
                .catch((e: any) => alert('Ошибка: ' + (e?.message ?? String(e))))
                .finally(() => setForceDownloading(false));
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs hover:bg-red-100 border border-red-200 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {forceDownloading ? 'Загрузка...' : 'Google → Локальные'}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" placeholder="Поиск по названию или ИНН..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Edit modal */}
      {showForm && editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">{editing.id ? 'Редактировать' : 'Новый клиент'}</h3>
              <button onClick={() => { setShowForm(false); setEditing(null); }}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              {([
                ['name', 'Название *'], ['inn', 'ИНН'], ['kpp', 'КПП'],
                ['address', 'Адрес'], ['bank_name', 'Банк'], ['bank_bik', 'БИК'],
                ['bank_corr_account', 'Корр. счёт'], ['bank_account', 'Расч. счёт'],
                ['contact_person', 'Контактное лицо'], ['phone', 'Телефон'], ['email', 'Email'],
                ['comment', 'Комментарий'],
              ] as [keyof models.Client, string][]).map(([field, label]) => (
                <div key={field} className={field === 'address' || field === 'comment' ? 'col-span-2' : ''}>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                  <input type="text" value={(editing[field] as string) || ''}
                    onChange={e => setEditing({ ...editing, [field]: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button onClick={() => { setShowForm(false); setEditing(null); }} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Отмена</button>
              <button onClick={handleSave} disabled={!editing.name || !editing.inn || saving}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                <Save className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} /> {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View modal */}
      {viewClient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg animate-fade-in">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-slate-800">{viewClient.name}</h3>
              <button onClick={() => setViewClient(null)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-2 text-sm">
              {([
                ['ИНН', viewClient.inn], ['КПП', viewClient.kpp], ['Адрес', viewClient.address],
                ['Банк', viewClient.bank_name], ['БИК', viewClient.bank_bik],
                ['Корр. счёт', viewClient.bank_corr_account], ['Расч. счёт', viewClient.bank_account],
                ['Контакт', viewClient.contact_person], ['Телефон', viewClient.phone], ['Email', viewClient.email],
                ['Комментарий', viewClient.comment],
              ] as [string, string][]).map(([label, value]) => (
                <div key={label} className="flex">
                  <span className="w-28 text-slate-400 shrink-0">{label}:</span>
                  <span className={`text-slate-700 ${label.includes('счёт') ? 'font-mono text-xs' : ''}`}>{value || '—'}</span>
                </div>
              ))}
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button onClick={() => { setEditing({ ...viewClient }); setShowForm(true); setViewClient(null); }}
                className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg">
                <Edit className="w-4 h-4" /> Редактировать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {clients.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 mb-2">Нет клиентов</p>
          <button onClick={() => setActiveTab('add-client')}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
            <Plus className="w-4 h-4" /> Добавить клиента
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase">
                <th className="px-4 py-3">Название</th>
                <th className="px-4 py-3">ИНН</th>
                <th className="px-4 py-3">КПП</th>
                <th className="px-4 py-3">Контакт</th>
                <th className="px-4 py-3 w-28">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Ничего не найдено</td></tr>
              ) : filtered.map(client => (
                <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800">{client.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 font-mono">{client.inn}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{client.kpp || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{client.contact_person || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setViewClient(client)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Просмотр">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => { setEditing({ ...client }); setShowForm(true); }}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Редактировать">
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-slate-400">Показано: {filtered.length} клиентов</p>
    </div>
  );
}
