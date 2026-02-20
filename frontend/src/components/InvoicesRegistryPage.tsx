import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { formatMoney, numberToWords } from '../utils/num2words';
import {
  CountInvoices,
  DeleteInvoice,
  ForceDownloadFromGoogle,
  ForceUploadToGoogle,
  GenerateInvoice,
  GetLastSyncTime,
  GetMyCompanyInvoiceTemplates,
  SearchInvoices,
  UpsertInvoice,
} from '../services/wailsApp';
import { calcTotalsByItems, VAT_RATE } from '../utils/invoiceMath';
import {
  FileText, Eye, Search, Calendar,
  ChevronDown, ChevronUp, Plus, RefreshCw, Upload, Download, ShieldAlert, Edit, Trash2, Loader2,
} from 'lucide-react';
import { models } from '../../wailsjs/go/models';
import { InvoiceEditModal } from './invoiceRegistry/InvoiceEditModal';
import { InvoiceDetailModal } from './invoiceRegistry/InvoiceDetailModal';
import { EditableItem, InvoiceEditDraft, VatMode } from './invoiceRegistry/types';
import { parseDraftItems } from './invoiceRegistry/draftUtils';

const PAGE_SIZE = 50;

type CompanyInvoiceTemplate = {
  id: string;
  name: string;
  file_path: string;
  vat_mode: 'none' | 'included' | 'on_top' | string;
  is_default?: boolean;
  is_active?: boolean;
};

function buildRegistrySearchQuery(text: string, company: string, number: string): string {
  const payload = {
    text: text.trim(),
    company: company.trim(),
    number: number.trim(),
  };
  if (!payload.text && !payload.company && !payload.number) {
    return '';
  }
  return JSON.stringify(payload);
}

function mapInvoiceForUI(inv: models.Invoice) {
  return {
    id: inv.id,
    number: inv.invoice_number || inv.id,
    date: inv.invoice_date,
    my_company_id: inv.my_company_id,
    company_id: inv.my_company_id,
    client_id: inv.client_id,
    vat_mode: inv.vat_mode,
    vat_rate: inv.vat_rate,
    items_json: inv.items_json,
    subtotal: inv.subtotal,
    vat_amount: inv.vat_amount,
    total: inv.total,
    total_words: inv.total_words,
    comment: inv.comment,
    created_at: inv.created_at,
    updated_at: inv.updated_at,
    items: parseDraftItems({ items_json: inv.items_json }).map((it) => ({
      ...it,
      amount: typeof it.sum === 'number' ? it.sum : 0,
    })),
  };
}

export function InvoicesRegistryPage() {
  const { clients, companies, products, refreshData, setActiveTab, syncAll, syncing } = useApp();
  const { pushToast } = useToast();
  const [searchInput, setSearchInput] = useState('');
  const [searchCompanyInput, setSearchCompanyInput] = useState('');
  const [invoiceNumberInput, setInvoiceNumberInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalInvoices, setTotalInvoices] = useState(0);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'date' | 'number' | 'total'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [forceUploading, setForceUploading] = useState(false);
  const [forceDownloading, setForceDownloading] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<InvoiceEditDraft | null>(null);
  const [deletingInvoiceId, setDeletingInvoiceId] = useState<string | null>(null);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);

  const [lastSync, setLastSync] = useState<string>('');

  const loadInvoices = useCallback(async () => {
    const limit = PAGE_SIZE;
    const offset = (page - 1) * PAGE_SIZE;
    setInvoicesLoading(true);
    try {
      const [rows, count] = await Promise.all([
        SearchInvoices(search, limit, offset),
        CountInvoices(search),
      ]);
      const total = typeof count === 'number' ? count : 0;
      const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
      if (page > maxPage) {
        setPage(maxPage);
        return;
      }
      setInvoices((rows ?? []).map(mapInvoiceForUI));
      setTotalInvoices(total);
      setSelectedInvoiceId((prev) => {
        if (!prev) return prev;
        return (rows ?? []).some((r) => r.id === prev) ? prev : null;
      });
    } catch (e) {
      console.error('Error loading invoices:', e);
      setInvoices([]);
      setTotalInvoices(0);
    } finally {
      setInvoicesLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setPage(1);
      setSearch(buildRegistrySearchQuery(searchInput, searchCompanyInput, invoiceNumberInput));
    }, 250);
    return () => window.clearTimeout(t);
  }, [searchInput, searchCompanyInput, invoiceNumberInput]);

  useEffect(() => {
    void loadInvoices();
  }, [loadInvoices]);

  useEffect(() => {
    let cancelled = false;
    async function loadLastSync() {
      try {
        const t = await GetLastSyncTime('invoices');
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

  function getClientName(clientId: string): string {
    const fromCtx = clients.find(cl => cl.id === clientId);
    if (fromCtx) return fromCtx.name;
    return '—';
  }

  function getCompanyName(companyId: string): string {
    const fromCtx = companies.find(co => co.id === companyId);
    if (fromCtx) return fromCtx.short_name || fromCtx.name;
    return '—';
  }

  function toInvoiceModel(inv: any): models.Invoice {
    return {
      id: inv.id,
      invoice_number: inv.number || inv.id,
      invoice_date: inv.date || '',
      my_company_id: inv.my_company_id || inv.company_id || '',
      client_id: inv.client_id || '',
      vat_mode: inv.vat_mode || 'none',
      vat_rate: typeof inv.vat_rate === 'number' ? inv.vat_rate : 0,
      items_json: inv.items_json || JSON.stringify((inv.items || []).map((it: any) => ({
        ...it,
        sum: typeof it?.sum === 'number' ? it.sum : (typeof it?.amount === 'number' ? it.amount : 0),
      }))),
      subtotal: typeof inv.subtotal === 'number' ? inv.subtotal : (typeof inv.total === 'number' ? inv.total : 0),
      vat_amount: typeof inv.vat_amount === 'number' ? inv.vat_amount : 0,
      total: typeof inv.total === 'number' ? inv.total : 0,
      total_words: inv.total_words || '',
      comment: inv.comment || '',
      created_at: inv.created_at || '',
      updated_at: inv.updated_at || '',
    };
  }

  function getVatLabel(mode: string) {
    if (mode === 'included') return 'В т.ч. НДС 22%';
    if (mode === 'on_top') return 'НДС 22% сверху';
    return 'Без НДС';
  }

  const filtered = useMemo(() => {
    const list = [...invoices];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') cmp = (a.date || '').localeCompare(b.date || '');
      else if (sortField === 'number') cmp = (a.number || '').localeCompare(b.number || '');
      else if (sortField === 'total') cmp = (a.total || 0) - (b.total || 0);
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return list;
  }, [invoices, sortField, sortDir]);

  const totalSum = filtered.reduce((s, i) => s + (i.total || 0), 0);
  const selectedInvoice = invoices.find(i => i.id === selectedInvoiceId) || null;
  const totalPages = Math.max(1, Math.ceil(totalInvoices / PAGE_SIZE));

  function toggleSort(field: 'date' | 'number' | 'total') {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  }

  const SortIcon = ({ field }: { field: 'date' | 'number' | 'total' }) => {
    if (sortField !== field) return null;
    return sortDir === 'desc' ? <ChevronDown className="w-3 h-3 inline ml-0.5" /> : <ChevronUp className="w-3 h-3 inline ml-0.5" />;
  };

  function handleSync() {
    void syncAll()
      .then(async () => {
        await loadInvoices();
      })
      .then(() => GetLastSyncTime('invoices'))
      .then((t: any) => {
        if (typeof t === 'string') setLastSync(t);
      })
      .catch((e: any) => pushToast(e?.message ?? String(e), 'error'));
  }

  function handleForceUpload() {
    if (!confirm('ВНИМАНИЕ! Все данные счетов в Google Sheets будут полностью заменены локальными. Продолжить?')) return;
    if (!confirm('Вы уверены? Это действие необратимо.')) return;
    setForceUploading(true);
    ForceUploadToGoogle()
      .then(async () => {
        await refreshData();
        await loadInvoices();
        const t = await GetLastSyncTime('invoices');
        setLastSync(t || '');
      })
      .catch((e: any) => pushToast('Ошибка: ' + (e?.message ?? String(e)), 'error'))
      .finally(() => setForceUploading(false));
  }

  function handleForceDownload() {
    if (!confirm('ВНИМАНИЕ! Все локальные счета будут удалены и заменены данными из Google Sheets. Продолжить?')) return;
    if (!confirm('Вы уверены? Это действие необратимо.')) return;
    setForceDownloading(true);
    ForceDownloadFromGoogle()
      .then(async () => {
        await refreshData();
        await loadInvoices();
        const t = await GetLastSyncTime('invoices');
        setLastSync(t || '');
      })
      .catch((e: any) => pushToast('Ошибка: ' + (e?.message ?? String(e)), 'error'))
      .finally(() => setForceDownloading(false));
  }

  function startEdit(inv: any) {
    const items = parseDraftItems(inv);
    const rawMode = inv.vat_mode;
    const mode: VatMode = rawMode === 'included' || rawMode === 'on_top' ? rawMode : 'none';
    const totals = calcTotalsByItems(items, mode);
    setEditingInvoiceId(inv.id);
    setEditDraft({
      id: inv.id,
      number: inv.number || inv.id,
      date: inv.date || '',
      company_id: inv.my_company_id || inv.company_id || '',
      client_id: inv.client_id || '',
      comment: inv.comment || '',
      vat_mode: mode,
      vat_rate: mode === 'none' ? 0 : VAT_RATE,
      subtotal: totals.subtotal,
      vat_amount: totals.vatAmount,
      total: totals.total,
      total_words: numberToWords(totals.total),
      items_json: inv.items_json || JSON.stringify((inv.items || []).map((it: any) => ({
        ...it,
        sum: typeof it?.sum === 'number' ? it.sum : (typeof it?.amount === 'number' ? it.amount : 0),
      }))),
      items,
      created_at: inv.created_at || '',
      updated_at: inv.updated_at || '',
    });
  }

  function updateEditItem(index: number, patch: Partial<EditableItem>) {
    setEditDraft((prev) => {
      if (!prev) return prev;
      const items = Array.isArray(prev.items) ? [...prev.items] : [];
      const current = items[index] || { product_id: '', name: '', unit: 'шт', quantity: 0, price: 0, sum: 0 };
      const next = { ...current, ...patch } as EditableItem;
      const quantity = Number(next.quantity || 0);
      const price = Number(next.price || 0);
      next.quantity = Number.isFinite(quantity) ? quantity : 0;
      next.price = Number.isFinite(price) ? price : 0;
      next.sum = next.quantity * next.price;
      items[index] = next;
      const totals = calcTotalsByItems(items, prev.vat_mode || 'none');
      return {
        ...prev,
        items,
        items_json: JSON.stringify(items),
        vat_rate: (prev.vat_mode || 'none') === 'none' ? 0 : VAT_RATE,
        subtotal: totals.subtotal,
        vat_amount: totals.vatAmount,
        total: totals.total,
        total_words: numberToWords(totals.total),
      };
    });
  }

  function addEditItem() {
    setEditDraft((prev) => {
      if (!prev) return prev;
      const items = Array.isArray(prev.items) ? [...prev.items] : [];
      items.push({ product_id: '', name: '', unit: 'шт', quantity: 1, price: 0, sum: 0 });
      const totals = calcTotalsByItems(items, prev.vat_mode || 'none');
      return {
        ...prev,
        items,
        items_json: JSON.stringify(items),
        subtotal: totals.subtotal,
        vat_amount: totals.vatAmount,
        total: totals.total,
        total_words: numberToWords(totals.total),
      };
    });
  }

  function removeEditItem(index: number) {
    setEditDraft((prev) => {
      if (!prev) return prev;
      const items = (Array.isArray(prev.items) ? [...prev.items] : []).filter((_, i: number) => i !== index);
      const totals = calcTotalsByItems(items, prev.vat_mode || 'none');
      return {
        ...prev,
        items,
        items_json: JSON.stringify(items),
        subtotal: totals.subtotal,
        vat_amount: totals.vatAmount,
        total: totals.total,
        total_words: numberToWords(totals.total),
      };
    });
  }

  function setEditVatMode(mode: VatMode) {
    setEditDraft((prev) => {
      if (!prev) return prev;
      const items = Array.isArray(prev.items) ? prev.items : [];
      const totals = calcTotalsByItems(items, mode);
      return {
        ...prev,
        vat_mode: mode,
        vat_rate: mode === 'none' ? 0 : VAT_RATE,
        subtotal: totals.subtotal,
        vat_amount: totals.vatAmount,
        total: totals.total,
        total_words: numberToWords(totals.total),
      };
    });
  }

  function cancelEdit() {
    setEditingInvoiceId(null);
    setEditDraft(null);
  }

  async function saveEdit() {
    if (!editingInvoiceId || !editDraft) return;
    const number = (editDraft.number || '').trim();
    if (!number) {
      pushToast('Номер счета обязателен', 'error');
      return;
    }
    if (!editDraft.client_id) {
      pushToast('Выберите покупателя', 'error');
      return;
    }
    if (!editDraft.company_id) {
      pushToast('Выберите компанию', 'error');
      return;
    }
    const items = (Array.isArray(editDraft.items) ? editDraft.items : [])
      .filter((it: EditableItem) => String(it?.name || '').trim() !== '')
      .map((it: EditableItem) => ({
        product_id: String(it.product_id || ''),
        name: String(it.name || ''),
        unit: String(it.unit || 'шт'),
        quantity: Number(it.quantity || 0),
        price: Number(it.price || 0),
        sum: Number(it.sum || 0),
      }));
    const totals = calcTotalsByItems(items, editDraft.vat_mode || 'none');
    const inv: models.Invoice = {
      id: number,
      invoice_number: number,
      invoice_date: editDraft.date || '',
      my_company_id: editDraft.company_id,
      client_id: editDraft.client_id,
      vat_mode: editDraft.vat_mode || 'none',
      vat_rate: (editDraft.vat_mode || 'none') === 'none' ? 0 : VAT_RATE,
      items_json: JSON.stringify(items),
      subtotal: totals.subtotal,
      vat_amount: totals.vatAmount,
      total: totals.total,
      total_words: numberToWords(totals.total),
      comment: editDraft.comment || '',
      created_at: editDraft.created_at || '',
      updated_at: editDraft.updated_at || '',
    };
    try {
      await UpsertInvoice(inv);
      await refreshData();
      await loadInvoices();
      cancelEdit();
    } catch (e: any) {
      pushToast(e?.message ?? String(e), 'error');
    }
  }

  async function handleDelete(inv: any) {
    const id = (inv?.id || '').trim();
    if (!id) return;
    if (!confirm(`Удалить счёт № ${inv.number || id}?`)) return;
    setDeletingInvoiceId(id);
    try {
      await DeleteInvoice(id);
      await refreshData();
      await loadInvoices();
      if (selectedInvoiceId === id) setSelectedInvoiceId(null);
    } catch (e: any) {
      pushToast(e?.message ?? String(e), 'error');
    } finally {
      setDeletingInvoiceId(null);
    }
  }

  async function handleDownloadAgain(inv: any) {
    const id = (inv?.id || '').trim();
    if (!id) return;
    const companyId = inv.my_company_id || inv.company_id;
    const company = companies.find(c => c.id === companyId);
    const client = clients.find(c => c.id === inv.client_id);
    if (!company || !client) {
      pushToast('Для скачивания нужны заполненные компания и покупатель. Сначала обновите данные счета.', 'error');
      return;
    }
    const model = toInvoiceModel(inv);
    setDownloadingInvoiceId(id);
    try {
      const templates: CompanyInvoiceTemplate[] = await GetMyCompanyInvoiceTemplates(companyId);
      const candidates = (templates || []).filter((t) => t?.is_active !== false && t.vat_mode === (model.vat_mode || 'none'));
      const picked = candidates.find((t) => t.is_default) || candidates[0];
      if (!picked?.file_path) {
        pushToast('Для этой компании и режима НДС не назначен шаблон.', 'error');
        return;
      }
      await GenerateInvoice(model, company, client, picked.file_path, false);
    } catch (e: any) {
      pushToast(e?.message ?? String(e), 'error');
    } finally {
      setDownloadingInvoiceId(null);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Реестр счетов</h2>
          <p className="text-sm text-slate-500 mt-1">Всего: {totalInvoices} счетов</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSync} disabled={syncing}
            className="flex items-center gap-2 text-slate-600 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-sm disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Синхронизация...' : 'Синхронизировать'}
          </button>
          <button onClick={() => setActiveTab('invoice')}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" /> Новый счёт
          </button>
        </div>
      </div>

      {/* Sync info */}
      {lastSync && (
        <div className="mb-4 px-3 py-2 bg-green-50 border border-green-100 rounded-lg text-xs text-green-600 flex items-center gap-2">
          <RefreshCw className="w-3 h-3" />
          Последняя синхронизация: {new Date(lastSync).toLocaleString('ru-RU')}
        </div>
      )}

      <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
        <div className="flex items-center gap-1.5 mb-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
          <p className="text-[11px] font-medium text-slate-500">Принудительная синхронизация счетов (полная перезапись)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={forceUploading}
            onClick={handleForceUpload}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg text-xs hover:bg-orange-100 border border-orange-200 disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            {forceUploading ? 'Загрузка...' : 'Локальные → Google'}
          </button>
          <button
            disabled={forceDownloading}
            onClick={handleForceDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs hover:bg-red-100 border border-red-200 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {forceDownloading ? 'Загрузка...' : 'Google → Локальные'}
          </button>
        </div>
      </div>

      {/* Stats */}
      {totalInvoices > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
          <div className="bg-white rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-400 uppercase">Всего счетов</p>
            <p className="text-xl font-bold text-slate-800">{totalInvoices}</p>
            <p className="text-xs text-slate-500 font-mono">На странице: {formatMoney(invoices.reduce((s, i) => s + (i.total || 0), 0))} ₽</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-400 uppercase">Текущая страница</p>
            <p className="text-xl font-bold text-slate-800">{page}/{totalPages}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-400 uppercase">Позиций на странице</p>
            <p className="text-xl font-bold text-slate-800">{invoices.reduce((s, i) => s + (i.items?.length || 0), 0)}</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Общий поиск: клиент, комментарий..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="От кого (моя компания)"
            value={searchCompanyInput}
            onChange={e => setSearchCompanyInput(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Только номер счёта"
            value={invoiceNumberInput}
            onChange={e => setInvoiceNumberInput(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase">
                <th className="px-4 py-3 cursor-pointer hover:text-slate-700" onClick={() => toggleSort('number')}>
                  № Счёта <SortIcon field="number" />
                </th>
                <th className="px-4 py-3 cursor-pointer hover:text-slate-700" onClick={() => toggleSort('date')}>
                  <Calendar className="w-3 h-3 inline mr-1" />Дата <SortIcon field="date" />
                </th>
                <th className="px-4 py-3">От кого</th>
                <th className="px-4 py-3">Покупатель</th>
                <th className="px-4 py-3 text-right cursor-pointer hover:text-slate-700" onClick={() => toggleSort('total')}>
                  Сумма <SortIcon field="total" />
                </th>
                <th className="px-4 py-3 w-24">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoicesLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    <div className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Загрузка счетов...</div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <FileText className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-400 mb-2">{totalInvoices === 0 ? 'Нет счетов' : 'Ничего не найдено'}</p>
                    {totalInvoices === 0 && (
                      <button onClick={() => setActiveTab('invoice')} className="text-blue-600 hover:underline text-sm">
                        Создать первый счёт →
                      </button>
                    )}
                  </td>
                </tr>
              ) : filtered.map(inv => (
                <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3"><span className="font-mono font-medium text-slate-800">{inv.number || '—'}</span></td>
                  <td className="px-4 py-3 text-sm text-slate-600">{inv.date ? new Date(inv.date).toLocaleDateString('ru-RU') : '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 max-w-[120px] truncate">{getCompanyName(inv.company_id)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 font-medium max-w-[180px] truncate">{getClientName(inv.client_id)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono font-semibold text-slate-800">{formatMoney(inv.total || 0)} ₽</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDownloadAgain(inv)}
                        disabled={downloadingInvoiceId === inv.id}
                        className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded disabled:opacity-60"
                        title="Скачать снова"
                      >
                        {downloadingInvoiceId === inv.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => startEdit(inv)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                        title="Редактировать"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(inv)}
                        disabled={deletingInvoiceId === inv.id}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-60"
                        title="Удалить"
                      >
                        {deletingInvoiceId === inv.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => setSelectedInvoiceId(inv.id)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="Просмотр"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filtered.length > 0 && (
        <div className="mt-2 flex justify-between items-center text-sm px-1 gap-3">
          <span className="text-slate-400">Показано: {filtered.length} из {totalInvoices}</span>
          <span className="font-medium text-slate-700">Итого на странице: <span className="font-mono">{formatMoney(totalSum)} ₽</span></span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || invoicesLoading}
              className="px-2 py-1 rounded border border-slate-200 text-slate-600 disabled:opacity-50"
            >Назад</button>
            <span className="text-slate-500">{page}/{totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || invoicesLoading}
              className="px-2 py-1 rounded border border-slate-200 text-slate-600 disabled:opacity-50"
            >Вперёд</button>
          </div>
        </div>
      )}

      {selectedInvoice && (
        <InvoiceDetailModal
          selectedInvoice={selectedInvoice}
          onClose={() => setSelectedInvoiceId(null)}
          getCompanyName={getCompanyName}
          getClientName={getClientName}
          getVatLabel={getVatLabel}
        />
      )}

      {editingInvoiceId && editDraft && (
        <InvoiceEditModal
          editDraft={editDraft}
          companies={companies}
          clients={clients}
          products={products}
          onClose={cancelEdit}
          onSave={() => void saveEdit()}
          onSetEditDraft={setEditDraft}
          onSetVatMode={setEditVatMode}
          onAddItem={addEditItem}
          onUpdateItem={updateEditItem}
          onRemoveItem={removeEditItem}
        />
      )}
    </div>
  );
}
