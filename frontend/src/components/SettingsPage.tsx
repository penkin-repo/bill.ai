import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { Save, Key, Database, AlertCircle, CheckCircle, Cpu, Table2, RefreshCw, Plus, Pencil, Trash2, X } from 'lucide-react';

function api() {
  return (window as any)?.go?.main?.App;
}

interface AIModel {
  id: string;
  name: string;
  desc: string;
}

export function SettingsPage() {
  const { dbReady, syncAll, syncing, settings, refreshSettings } = useApp();
  const { pushToast } = useToast();
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [googleSheetId, setGoogleSheetId] = useState('');
  const [googleServiceKey, setGoogleServiceKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [modelSaved, setModelSaved] = useState(false);
  const [googleSaved, setGoogleSaved] = useState(false);

  // AI Models CRUD
  const [models, setModels] = useState<AIModel[]>([]);
  const [editingModel, setEditingModel] = useState<AIModel | null>(null);
  const [showModelForm, setShowModelForm] = useState(false);
  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');

  function loadModels() {
    const a = api();
    if (!a) return;
    a.GetSetting('ai_models').then((raw: string) => {
      try {
        const parsed = JSON.parse(raw || '[]');
        setModels(Array.isArray(parsed) ? parsed : []);
      } catch {
        setModels([]);
      }
    }).catch(() => setModels([]));
  }

  function saveModels(list: AIModel[]) {
    const a = api();
    if (!a) return;
    a.SetSetting('ai_models', JSON.stringify(list)).then(() => {
      setModels(list);
    }).catch((e: any) => pushToast(e?.message ?? String(e), 'error'));
  }

  function openAddModel() {
    setEditingModel(null);
    setFormId('');
    setFormName('');
    setFormDesc('');
    setShowModelForm(true);
  }

  function openEditModel(m: AIModel) {
    setEditingModel(m);
    setFormId(m.id);
    setFormName(m.name);
    setFormDesc(m.desc);
    setShowModelForm(true);
  }

  function handleSaveModelForm() {
    const id = formId.trim();
    const name = formName.trim();
    if (!id) { pushToast('Укажите ID модели (например: openai/gpt-4o)', 'error'); return; }
    if (!name) { pushToast('Укажите название модели', 'error'); return; }

    let updated: AIModel[];
    if (editingModel) {
      updated = models.map(m => m.id === editingModel.id ? { id, name, desc: formDesc.trim() } : m);
    } else {
      if (models.some(m => m.id === id)) { pushToast('Модель с таким ID уже существует', 'error'); return; }
      updated = [...models, { id, name, desc: formDesc.trim() }];
    }
    saveModels(updated);
    setShowModelForm(false);
  }

  function handleDeleteModel(id: string) {
    if (!confirm('Удалить модель?')) return;
    const updated = models.filter(m => m.id !== id);
    saveModels(updated);
    if (selectedModel === id && updated.length > 0) {
      handleSaveModel(updated[0].id);
    }
  }

  useEffect(() => {
    if (dbReady) {
      setApiKey(settings.openrouterApiKey || '');
      setSelectedModel(settings.aiModel || '');
      setGoogleSheetId(settings.googleSheetId || '');
      setGoogleServiceKey(settings.googleServiceKey || '');
      loadModels();
    }
  }, [dbReady, settings]);

  function handleSaveKey() {
    const a = api();
    if (!a) {
      pushToast('Backend недоступен (нет window.go). Запускайте через wails dev.', 'error');
      return;
    }
    a.SetSetting('openrouter_api_key', apiKey)
      .then(() => {
        void refreshSettings();
        setSaved(true); setTimeout(() => setSaved(false), 2000);
      })
      .catch((e: any) => pushToast(e?.message ?? String(e), 'error'));
  }

  function handleSaveModel(modelId: string) {
    setSelectedModel(modelId);
    const a = api();
    if (!a) {
      pushToast('Backend недоступен (нет window.go). Запускайте через wails dev.', 'error');
      return;
    }
    a.SetSetting('ai_model', modelId)
      .then(() => {
        void refreshSettings();
        setModelSaved(true); setTimeout(() => setModelSaved(false), 2000);
      })
      .catch((e: any) => pushToast(e?.message ?? String(e), 'error'));
  }

  async function handleSaveGoogle() {
    const a = api();
    if (!a) {
      pushToast('Backend недоступен (нет window.go). Запускайте через wails dev.', 'error');
      return;
    }
    try {
      await a.SetSetting('google_sheet_id', googleSheetId);
      await a.SetSetting('google_service_key', googleServiceKey);
      void refreshSettings();
      setGoogleSaved(true); setTimeout(() => setGoogleSaved(false), 2000);
    } catch (e: any) {
      pushToast(e?.message ?? String(e), 'error');
    }
  }

  async function handleSyncAll() {
    try {
      await syncAll();
    } catch (e: any) {
      pushToast(e?.message ?? String(e), 'error');
    }
  }

  function handleClearDb() {
    if (confirm('Удалить ВСЕ данные? Это действие необратимо!')) {
      localStorage.removeItem('invoice_db');
      window.location.reload();
    }
  }

  function handleExportDb() {
    const data = localStorage.getItem('invoice_db');
    if (!data) return;
    const blob = new Blob([data], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice_db_backup_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportDb(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      localStorage.setItem('invoice_db', reader.result as string);
      window.location.reload();
    };
    reader.readAsText(file);
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Настройки</h2>

      {/* Google Sheets */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Table2 className="w-5 h-5 text-green-600" />
          <h3 className="font-semibold text-slate-700">Google Sheets (Мастер-данные)</h3>
        </div>
        <p className="text-sm text-slate-500 mb-3">
          Локальная база — приоритет. Синхронизация: загрузка новых локальных → скачивание новых из Google.
          <br />Листы: <code className="text-xs bg-slate-100 px-1 rounded">Clients</code>, <code className="text-xs bg-slate-100 px-1 rounded">MyCompanies</code>, <code className="text-xs bg-slate-100 px-1 rounded">Invoices</code>
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Sheet ID (из URL таблицы)</label>
            <input type="text" value={googleSheetId} onChange={e => setGoogleSheetId(e.target.value)}
              placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Service Account JSON Key</label>
            <textarea value={googleServiceKey} onChange={e => setGoogleServiceKey(e.target.value)}
              rows={3} placeholder='{"type":"service_account","project_id":"..."}'
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-green-500 resize-y" />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleSaveGoogle}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
              <Save className="w-4 h-4" /> Сохранить
            </button>
            <button
              onClick={handleSyncAll}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200 disabled:opacity-50"
              title="Синхронизировать всё"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              Синхронизировать
            </button>
            {googleSaved && (
              <span className="text-sm text-green-600 flex items-center gap-1 animate-fade-in">
                <CheckCircle className="w-4 h-4" /> Сохранено!
              </span>
            )}
          </div>

        </div>
      </div>

      {/* API Key */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Key className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-slate-700">OpenRouter API Ключ</h3>
        </div>
        <p className="text-sm text-slate-500 mb-3">
          Для AI-распознавания реквизитов и голосовых команд.{' '}
          <a href="https://openrouter.ai" target="_blank" rel="noreferrer" className="text-blue-600 underline">openrouter.ai</a>
        </p>
        <div className="flex gap-2">
          <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
            placeholder="sk-or-..." className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
          <button onClick={handleSaveKey}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            <Save className="w-4 h-4" /> Сохранить
          </button>
        </div>
        {saved && <p className="mt-2 text-sm text-green-600 flex items-center gap-1 animate-fade-in"><CheckCircle className="w-4 h-4" /> Ключ сохранён!</p>}
      </div>

      {/* AI Model */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-purple-600" />
            <h3 className="font-semibold text-slate-700">Модель AI</h3>
          </div>
          <div className="flex items-center gap-2">
            {modelSaved && <span className="text-sm text-green-600 flex items-center gap-1 animate-fade-in"><CheckCircle className="w-4 h-4" /> Сохранено!</span>}
            <button onClick={openAddModel} className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700 font-medium">
              <Plus className="w-4 h-4" /> Добавить
            </button>
          </div>
        </div>

        {/* Add/Edit form */}
        {showModelForm && (
          <div className="mb-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-purple-700">{editingModel ? 'Редактировать модель' : 'Новая модель'}</p>
              <button onClick={() => setShowModelForm(false)} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-2">
              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">ID модели (OpenRouter)</label>
                <input type="text" value={formId} onChange={e => setFormId(e.target.value)}
                  placeholder="openai/gpt-4o" disabled={!!editingModel}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded text-sm font-mono focus:ring-1 focus:ring-purple-500 disabled:bg-slate-100" />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">Название</label>
                <input type="text" value={formName} onChange={e => setFormName(e.target.value)}
                  placeholder="GPT-4o"
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded text-sm focus:ring-1 focus:ring-purple-500" />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">Описание (необязательно)</label>
                <input type="text" value={formDesc} onChange={e => setFormDesc(e.target.value)}
                  placeholder="Самый мощный"
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded text-sm focus:ring-1 focus:ring-purple-500" />
              </div>
              <button onClick={handleSaveModelForm}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded text-sm hover:bg-purple-700">
                <Save className="w-3.5 h-3.5" /> {editingModel ? 'Сохранить' : 'Добавить'}
              </button>
            </div>
          </div>
        )}

        {models.length === 0 && !showModelForm ? (
          <div className="text-center py-6 text-slate-400 text-sm">
            Нет моделей. Нажмите «Добавить» чтобы добавить AI-модель.
          </div>
        ) : (
          <div className="grid gap-2">
            {models.map(model => (
              <div key={model.id}
                className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                  selectedModel === model.id ? 'border-purple-500 bg-purple-50' : 'border-slate-200 hover:border-slate-300'
                }`}>
                <div className="flex items-center justify-between">
                  <button onClick={() => handleSaveModel(model.id)} className="flex-1 text-left min-w-0">
                    <p className={`font-medium text-sm ${selectedModel === model.id ? 'text-purple-700' : 'text-slate-700'}`}>{model.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5 font-mono">{model.id}</p>
                    {model.desc && <p className="text-xs text-slate-400 mt-0.5">{model.desc}</p>}
                  </button>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    {selectedModel === model.id && (
                      <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center mr-1">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                    <button onClick={() => openEditModel(model)} className="p-1 text-slate-300 hover:text-blue-500" title="Редактировать">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDeleteModel(model.id)} className="p-1 text-slate-300 hover:text-red-500" title="Удалить">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Database */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Database className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-slate-700">База данных</h3>
        </div>
        <p className="text-sm text-slate-500 mb-3">SQLite — основное хранилище. Google Sheets — опциональная синхронизация.</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleExportDb} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200">📥 Экспорт</button>
          <label className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200 cursor-pointer">
            📤 Импорт <input type="file" onChange={handleImportDb} className="hidden" accept=".txt" />
          </label>
          <button onClick={handleClearDb} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm hover:bg-red-100">🗑 Очистить</button>
        </div>
      </div>

      {/* Info */}
      <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <h4 className="font-medium text-amber-800 mb-1">Архитектура данных (Local-first)</h4>
            <ul className="text-sm text-amber-700 space-y-1">
              <li>• <strong>SQLite</strong> — основное хранилище, работает офлайн</li>
              <li>• <strong>Google Sheets</strong> — опциональная синхронизация и общий доступ</li>
              <li>• <strong>Синхронизация:</strong> загрузка новых локальных → скачивание новых из Google (по ID)</li>
              <li>• <strong>Принудительная:</strong> полная перезапись в любую сторону (с подтверждением)</li>
              <li>• AI-модель: <span className="font-mono font-medium">{selectedModel || '(не выбрана)'}</span></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
