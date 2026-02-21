import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { Plus, Edit, X, Save, Building2, RefreshCw, Upload, Download, ShieldAlert, FileText, Trash2 } from 'lucide-react';
import { models } from '../../wailsjs/go/models';

function api() {
  return (window as any)?.go?.main?.App;
}

const emptyCompany: models.MyCompany = {
  id: '',
  name: '',
  short_name: '',
  inn: '',
  kpp: '',
  ogrn: '',
  address: '',
  bank_name: '',
  bank_bik: '',
  bank_account: '',
  bank_corr_account: '',
  director_name: '',
  director_title: '',
  phone: '',
  email: '',
  comment: '',
};

type CompanyInvoiceTemplate = {
  id: string;
  name: string;
  file_path: string;
  vat_mode: 'none' | 'included' | 'on_top' | string;
  is_default?: boolean;
  is_active?: boolean;
};

const vatModeLabel: Record<string, string> = {
  none: 'Без НДС',
  included: 'НДС включен',
  on_top: 'НДС сверху',
};

const emptyTemplate: CompanyInvoiceTemplate = {
  id: '',
  name: '',
  file_path: '',
  vat_mode: 'included',
};

export function CompaniesPage() {
  const { companies, refreshData } = useApp();
  const { pushToast } = useToast();
  const [editing, setEditing] = useState<models.MyCompany | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingCompanyId, setDeletingCompanyId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [forceUploading, setForceUploading] = useState(false);
  const [forceDownloading, setForceDownloading] = useState(false);
  const [lastSync, setLastSync] = useState('');
  const [allTemplates, setAllTemplates] = useState<CompanyInvoiceTemplate[]>([]);
  const [templatesCompany, setTemplatesCompany] = useState<models.MyCompany | null>(null);
  const [companyTemplates, setCompanyTemplates] = useState<CompanyInvoiceTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesSaving, setTemplatesSaving] = useState(false);
  const [newTemplate, setNewTemplate] = useState<CompanyInvoiceTemplate>(emptyTemplate);

  useEffect(() => {
    let cancelled = false;
    async function loadLastSync() {
      try {
        const a = api();
        if (!a) return;
        const t = await a.GetLastSyncTime('my_companies');
        if (!cancelled) setLastSync(t || '');
      } catch {
        // ignore
      }
    }
    void loadLastSync();
    return () => {
      cancelled = true;
    }
  }, []);

  async function loadTemplatesCatalog() {
    const a = api();
    if (!a) return;
    const templates = await a.GetAllInvoiceTemplates();
    setAllTemplates((templates ?? []).filter((t: CompanyInvoiceTemplate) => t?.is_active !== false));
  }

  async function openCompanyTemplates(company: models.MyCompany) {
    const a = api();
    if (!a) return;
    setTemplatesCompany(company);
    setTemplatesLoading(true);
    try {
      await loadTemplatesCatalog();
      const templates = await a.GetMyCompanyInvoiceTemplates(company.id);
      setCompanyTemplates((templates ?? []).filter((t: CompanyInvoiceTemplate) => t?.is_active !== false));
      setNewTemplate(emptyTemplate);
    } catch (e: any) {
      pushToast('Не удалось загрузить шаблоны компании: ' + (e?.message ?? String(e)), 'error');
      setCompanyTemplates([]);
    } finally {
      setTemplatesLoading(false);
    }
  }

  async function handleDeleteCompany(company: models.MyCompany) {
    const id = (company?.id || '').trim();
    if (!id) return;
    const title = company.short_name || company.name || id;
    if (!confirm(`Удалить компанию "${title}"?`)) return;

    const a = api();
    if (!a) {
      pushToast('Backend недоступен (нет window.go). Запускайте через wails dev.', 'error');
      return;
    }

    setDeletingCompanyId(id);
    try {
      await a.DeleteMyCompany(id);
      await refreshData();
      if (templatesCompany?.id === id) {
        setTemplatesCompany(null);
        setCompanyTemplates([]);
      }
    } catch (e: any) {
      pushToast(e?.message ?? String(e), 'error');
    } finally {
      setDeletingCompanyId(null);
    }
  }

  async function deleteTemplateFromCatalog(templateID: string, templateName: string) {
    const a = api();
    if (!a) return;
    if (!confirm(`Удалить шаблон "${templateName}" из программы? Шаблон будет отвязан от всех компаний.`)) return;
    setTemplatesSaving(true);
    try {
      await a.DeleteInvoiceTemplate(templateID);
      await loadTemplatesCatalog();
      if (templatesCompany) {
        const updated = await a.GetMyCompanyInvoiceTemplates(templatesCompany.id);
        setCompanyTemplates((updated ?? []).filter((t: CompanyInvoiceTemplate) => t?.is_active !== false));
      }
    } catch (e: any) {
      pushToast('Не удалось удалить шаблон: ' + (e?.message ?? String(e)), 'error');
    } finally {
      setTemplatesSaving(false);
    }
  }

  async function assignTemplate(templateID: string) {
    if (!templatesCompany) return;
    const a = api();
    if (!a) return;
    setTemplatesSaving(true);
    try {
      await a.SetMyCompanyInvoiceTemplate(templatesCompany.id, templateID, false);
      const updated = await a.GetMyCompanyInvoiceTemplates(templatesCompany.id);
      setCompanyTemplates((updated ?? []).filter((t: CompanyInvoiceTemplate) => t?.is_active !== false));
    } catch (e: any) {
      pushToast('Не удалось привязать шаблон: ' + (e?.message ?? String(e)), 'error');
    } finally {
      setTemplatesSaving(false);
    }
  }

  async function unbindTemplate(templateID: string) {
    if (!templatesCompany) return;
    const a = api();
    if (!a) return;
    setTemplatesSaving(true);
    try {
      await a.RemoveMyCompanyInvoiceTemplate(templatesCompany.id, templateID);
      const updated = await a.GetMyCompanyInvoiceTemplates(templatesCompany.id);
      setCompanyTemplates((updated ?? []).filter((t: CompanyInvoiceTemplate) => t?.is_active !== false));
    } catch (e: any) {
      pushToast('Не удалось отвязать шаблон: ' + (e?.message ?? String(e)), 'error');
    } finally {
      setTemplatesSaving(false);
    }
  }

  async function addTemplate() {
    const a = api();
    if (!a) return;
    const id = (newTemplate.id || '').trim();
    const name = (newTemplate.name || '').trim();
    const filePath = (newTemplate.file_path || '').trim();
    const vatMode = (newTemplate.vat_mode || '').trim();
    if (!filePath || !vatMode) {
      pushToast('Укажите имя файла шаблона и VAT-режим.', 'error');
      return;
    }
    setTemplatesSaving(true);
    try {
      await a.UpsertInvoiceTemplate({
        id,
        name,
        file_path: filePath,
        vat_mode: vatMode,
        is_active: true,
        is_default: false,
      });
      await loadTemplatesCatalog();
      setNewTemplate(emptyTemplate);
    } catch (e: any) {
      pushToast('Не удалось добавить шаблон: ' + (e?.message ?? String(e)), 'error');
    } finally {
      setTemplatesSaving(false);
    }
  }

  const templatesByVatMode = useMemo(
    () => allTemplates.reduce<Record<string, CompanyInvoiceTemplate[]>>((acc, template) => {
      const key = template.vat_mode || 'none';
      acc[key] = acc[key] ?? [];
      acc[key].push(template);
      return acc;
    }, {}),
    [allTemplates]
  );

  useEffect(() => {
    let cancelled = false;
    async function loadInitialCatalog() {
      try {
        const a = api();
        if (!a) return;
        const templates = await a.GetAllInvoiceTemplates();
        if (!cancelled) {
          setAllTemplates((templates ?? []).filter((t: CompanyInvoiceTemplate) => t?.is_active !== false));
        }
      } catch {
        if (!cancelled) setAllTemplates([]);
      }
    }
    void loadInitialCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave() {
    if (!editing) return;

    const name = (editing.name || '').trim();
    if (!name) {
      pushToast('Название компании обязательно', 'error');
      return;
    }
    const inn = (editing.inn || '').trim();
    if (!inn) {
      pushToast('ИНН обязателен', 'error');
      return;
    }

    const company: models.MyCompany = { ...editing, id: inn, inn, name };
    const a = api();
    if (!a) {
      pushToast('Backend недоступен (нет window.go). Запускайте через wails dev.', 'error');
      return;
    }
    try {
      setSaving(true);
      await a.UpsertCompany(company);
      await refreshData();
      setEditing(null);
      setShowForm(false);
    } catch (e: any) {
      pushToast(e?.message ?? String(e), 'error');
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
      const t = await a.GetLastSyncTime('my_companies');
      setLastSync(t || '');
    } catch (e: any) {
      pushToast('Ошибка синхронизации: ' + (e?.message ?? String(e)), 'error');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Мои компании</h2>
        <div className="flex gap-2">
          <button onClick={handleSync} disabled={syncing}
            className="flex items-center gap-2 text-slate-600 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-sm disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Синхронизация...' : 'Синхронизировать'}
          </button>
          <button
            onClick={() => { setEditing({ ...emptyCompany }); setShowForm(true); }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Добавить компанию
          </button>
        </div>
      </div>

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
                .then(() => { pushToast('Все данные загружены в Google Sheets.', 'success'); refreshData(); })
                .catch((e: any) => pushToast('Ошибка: ' + (e?.message ?? String(e)), 'error'))
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
                .then(() => { pushToast('Локальная база перезаписана данными из Google.', 'success'); refreshData(); })
                .catch((e: any) => pushToast('Ошибка: ' + (e?.message ?? String(e)), 'error'))
                .finally(() => setForceDownloading(false));
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs hover:bg-red-100 border border-red-200 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {forceDownloading ? 'Загрузка...' : 'Google → Локальные'}
          </button>
        </div>
      </div>

      {showForm && editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">
                {editing.id ? 'Редактировать компанию' : 'Новая компания'}
              </h3>
              <button onClick={() => { setShowForm(false); setEditing(null); }}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              {([
                ['name', 'Полное название *'],
                ['short_name', 'Короткое название'],
                ['inn', 'ИНН'],
                ['kpp', 'КПП'],
                ['ogrn', 'ОГРН / ОГРНИП'],
                ['address', 'Юридический адрес'],
                ['bank_name', 'Банк'],
                ['bank_bik', 'БИК'],
                ['bank_corr_account', 'Корр. счёт'],
                ['bank_account', 'Расч. счёт'],
                ['director_name', 'Директор / ИП'],
                ['director_title', 'Должность'],
                ['phone', 'Телефон'],
                ['email', 'Email'],
                ['comment', 'Комментарий'],
              ] as [keyof models.MyCompany, string][]).map(([field, label]) => (
                <div key={field} className={field === 'address' || field === 'name' || field === 'comment' ? 'col-span-2' : ''}>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                  <input
                    type="text"
                    value={(editing[field] as string) || ''}
                    onChange={e => setEditing({ ...editing, [field]: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button
                onClick={() => { setShowForm(false); setEditing(null); }}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Отмена
              </button>
              <button
                onClick={handleSave}
                disabled={!editing.name || !editing.inn || saving}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {companies.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Добавьте свою компанию для выставления счетов</p>
          <p className="text-xs text-slate-400 mt-1">Например: ИП Ковальчук или ООО "Завод плитки"</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {companies.map(company => (
            <div key={company.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">{company.name}</h3>
                  {company.short_name && (
                    <p className="text-sm text-slate-500">{company.short_name}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openCompanyTemplates(company)}
                    className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"
                    title="Шаблоны счета"
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => { setEditing({ ...company }); setShowForm(true); }}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => { void handleDeleteCompany(company); }}
                    disabled={deletingCompanyId === company.id}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                    title="Удалить компанию"
                  >
                    <Trash2 className={`w-4 h-4 ${deletingCompanyId === company.id ? 'animate-pulse' : ''}`} />
                  </button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                <div><span className="text-slate-400">ИНН:</span> <span className="text-slate-700">{company.inn || '—'}</span></div>
                <div><span className="text-slate-400">КПП:</span> <span className="text-slate-700">{company.kpp || '—'}</span></div>
                <div><span className="text-slate-400">БИК:</span> <span className="text-slate-700">{company.bank_bik || '—'}</span></div>
                <div><span className="text-slate-400">Р/с:</span> <span className="text-slate-700 font-mono text-xs">{company.bank_account || '—'}</span></div>
                <div className="col-span-2 md:col-span-4"><span className="text-slate-400">Комментарий:</span> <span className="text-slate-700">{company.comment || '—'}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {templatesCompany && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="text-lg font-semibold">Шаблоны счета для моей компании</h3>
                <p className="text-sm text-slate-500">{templatesCompany.name} · ИНН {templatesCompany.inn || templatesCompany.id}</p>
              </div>
              <button onClick={() => setTemplatesCompany(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                <h4 className="text-sm font-semibold text-slate-800 mb-3">Добавить шаблон в каталог</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input
                    value={newTemplate.id}
                    onChange={e => setNewTemplate(prev => ({ ...prev, id: e.target.value }))}
                    placeholder="ID (необязательно, будет из имени файла)"
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                  <input
                    value={newTemplate.name}
                    onChange={e => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Название (необязательно)"
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                  <input
                    value={newTemplate.file_path}
                    onChange={e => setNewTemplate(prev => ({ ...prev, file_path: e.target.value }))}
                    placeholder="Имя файла рядом с exe (например vat_none.xlsx)"
                    className="md:col-span-2 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                  />
                  <select
                    value={newTemplate.vat_mode}
                    onChange={e => setNewTemplate(prev => ({ ...prev, vat_mode: e.target.value }))}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="none">Без НДС</option>
                    <option value="included">НДС включен</option>
                    <option value="on_top">НДС сверху</option>
                  </select>
                  <button
                    onClick={addTemplate}
                    disabled={templatesSaving}
                    className="px-3 py-2 text-sm rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                  >
                    Добавить шаблон
                  </button>
                </div>
              </div>

              {templatesLoading ? (
                <p className="text-sm text-slate-500">Загрузка шаблонов...</p>
              ) : allTemplates.length === 0 ? (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  В каталоге нет активных шаблонов. Сначала добавьте шаблоны в локальный каталог.
                </p>
              ) : (
                (Object.entries(templatesByVatMode) as Array<[string, CompanyInvoiceTemplate[]]>).map(([mode, templates]) => {
                  const modeTemplates = companyTemplates.filter(t => t.vat_mode === mode);
                  const boundIds = new Set(modeTemplates.map(t => t.id));
                  return (
                    <div key={mode} className="border border-slate-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-slate-800">{vatModeLabel[mode] || mode}</h4>
                        <span className="text-xs text-slate-500">Привязано: {modeTemplates.length}</span>
                      </div>
                      <div className="space-y-2">
                        {templates.map((template) => {
                          const isBound = boundIds.has(template.id);
                          return (
                            <div key={template.id} className="flex items-center justify-between gap-3 p-2 rounded-lg border border-slate-100 bg-slate-50/60">
                              <div>
                                <p className="text-sm font-medium text-slate-800">{template.name}</p>
                                <p className="text-xs text-slate-500 font-mono">{template.file_path}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                {!isBound ? (
                                  <button
                                    onClick={() => assignTemplate(template.id)}
                                    disabled={templatesSaving}
                                    className="px-3 py-1.5 text-xs rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                                  >
                                    Привязать
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => unbindTemplate(template.id)}
                                    disabled={templatesSaving}
                                    className="px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                                  >
                                    Удалить
                                  </button>
                                )}
                                <button
                                  onClick={() => deleteTemplateFromCatalog(template.id, template.name)}
                                  disabled={templatesSaving}
                                  className="p-1.5 rounded border border-slate-200 text-slate-500 hover:text-red-700 hover:border-red-200 hover:bg-red-50 disabled:opacity-50"
                                  title="Удалить из программы"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
