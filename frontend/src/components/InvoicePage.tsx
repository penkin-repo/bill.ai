import { useState, useCallback, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { parseVoiceCommand, getCurrentModelName, aiPickProductIdFromList } from '../services/aiService';
import { numberToWords, formatMoney } from '../utils/num2words';
import {
  ConvertXlsxToPDF,
  GenerateInvoice,
  GetAllProducts,
  GetMyCompanyInvoiceTemplates,
  GetNextInvoiceNumber,
  SearchClients,
  SearchProducts,
  UpsertInvoice,
} from '../services/wailsApp';
import { calcTotalsBySubtotal, VAT_RATE } from '../utils/invoiceMath';
import { parseLocaleNumber } from '../utils/number';
import { InvoiceActionBar } from './invoice/InvoiceActionBar';
import { InvoiceTotalsSummary } from './invoice/InvoiceTotalsSummary';
import { models } from '../../wailsjs/go/models';
import {
  Plus, Trash2, FileText, Search, X, Sparkles,
  CheckSquare, Square, ChevronDown, Send, Cpu, Mic, MicOff, Loader2,
} from 'lucide-react';

type InvoiceRow = {
  _id: string;
  product_id?: string;
  name: string;
  unit: string;
  quantity: number;
  price: number;
  amount: number;
};

type CompanyInvoiceTemplate = {
  id: string;
  name: string;
  file_path: string;
  vat_mode: 'none' | 'included' | 'on_top' | string;
  is_default?: boolean;
  is_active?: boolean;
};

export function InvoicePage() {
  const { clients, products, companies, refreshData, setActiveTab } = useApp();
  const { pushToast } = useToast();

  const [modelName, setModelName] = useState<string>('...');

  // AI command input
  const [aiCommand, setAiCommand] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiSuccess, setAiSuccess] = useState('');

  // Voice
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Invoice meta
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceNumberManual, setInvoiceNumberManual] = useState(false);
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [vatMode, setVatMode] = useState<'none' | 'included' | 'on_top'>('none');
  const [companyTemplates, setCompanyTemplates] = useState<CompanyInvoiceTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [alsoDownloadPdf, setAlsoDownloadPdf] = useState(false);
  const [comment, setComment] = useState('');

  const nextRowIdRef = useRef(1);
  const makeRowId = useCallback(() => {
    const id = String(nextRowIdRef.current);
    nextRowIdRef.current += 1;
    return id;
  }, []);

  // Items
  const [rows, setRows] = useState<InvoiceRow[]>([
    { _id: '0', name: '', unit: 'шт', quantity: 1, price: 0, amount: 0 },
  ]);

  // Client search
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<models.Client[]>([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const clientSearchRef = useRef<HTMLDivElement>(null);

  // Product search per row
  const [activeProductRow, setActiveProductRow] = useState<string | null>(null);
  const [productResults, setProductResults] = useState<models.Product[]>([]);

  // Success message
  const [successMsg, setSuccessMsg] = useState('');
  const [savingInvoice, setSavingInvoice] = useState(false);

  useEffect(() => {
    if (invoiceNumberManual) return;
    if (!selectedCompanyId) {
      setInvoiceNumber('');
      return;
    }
    let cancelled = false;
    GetNextInvoiceNumber(selectedCompanyId)
      .then((next: string) => {
        if (!cancelled) setInvoiceNumber((next || '').trim() || '1');
      })
      .catch(() => {
        if (!cancelled && !invoiceNumber.trim()) setInvoiceNumber('1');
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCompanyId, invoiceNumberManual]);

  useEffect(() => {
    if (companies.length > 0 && !selectedCompanyId) {
      setSelectedCompanyId(companies[0].id);
    }
  }, [companies, selectedCompanyId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const name = await getCurrentModelName();
        if (!cancelled) setModelName(name);
      } catch {
        if (!cancelled) setModelName('—');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Client search
  useEffect(() => {
    let cancelled = false;
    const t = window.setTimeout(() => {
      if (cancelled) return;
      if (clientSearch.length >= 1 && !selectedClientId) {
        SearchClients(clientSearch)
          .then((results: models.Client[]) => {
            if (cancelled) return;
            setClientResults(results ?? []);
            setShowClientDropdown((results ?? []).length > 0);
          })
          .catch(() => {
            if (cancelled) return;
            setClientResults([]);
            setShowClientDropdown(false);
          });
      } else {
        setClientResults([]);
        setShowClientDropdown(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [clientSearch, selectedClientId]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedCompanyId) {
      setCompanyTemplates([]);
      setSelectedTemplateId('');
      return;
    }
    GetMyCompanyInvoiceTemplates(selectedCompanyId)
      .then((templates: CompanyInvoiceTemplate[]) => {
        if (cancelled) return;
        const active = (templates ?? []).filter(t => t?.is_active !== false);
        setCompanyTemplates(active);

        const hasCurrentVat = active.some(t => t.vat_mode === vatMode);
        if (!hasCurrentVat && active.length > 0) {
          const nextMode = active[0].vat_mode;
          if (nextMode === 'none' || nextMode === 'included' || nextMode === 'on_top') {
            setVatMode(nextMode);
          }
        }
      })
      .catch(() => {
        if (cancelled) return;
        setCompanyTemplates([]);
        setSelectedTemplateId('');
      });
    return () => { cancelled = true; };
  }, [selectedCompanyId]);

  const templatesForCurrentVat = companyTemplates.filter(t => t.vat_mode === vatMode);
  const availableVatModes = Array.from(new Set(companyTemplates.map(t => t.vat_mode))) as Array<'none' | 'included' | 'on_top'>;

  useEffect(() => {
    if (!selectedCompanyId) {
      setSelectedTemplateId('');
      return;
    }
    const list = templatesForCurrentVat;
    if (list.length === 0) {
      setSelectedTemplateId('');
      return;
    }
    const hasCurrent = list.some(t => t.id === selectedTemplateId);
    if (hasCurrent) return;
    const def = list.find(t => t.is_default) || list[0];
    setSelectedTemplateId(def.id);
  }, [selectedCompanyId, vatMode, companyTemplates, selectedTemplateId]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (clientSearchRef.current && !clientSearchRef.current.contains(e.target as Node)) {
        setShowClientDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Product search — always uses backend for consistent results
  function doProductSearch(term: string) {
    const cleaned = term.trim();
    if (cleaned.length === 0) {
      GetAllProducts()
        .then((res: models.Product[]) => setProductResults((res ?? []).slice(0, 20)))
        .catch(() => setProductResults([]));
      return;
    }

    SearchProducts(cleaned)
      .then((res: models.Product[]) => setProductResults((res ?? []).slice(0, 20)))
      .catch(() => setProductResults([]));
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('.product-dropdown-zone')) {
        setActiveProductRow(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // === AI COMMAND PROCESSING ===
  async function handleAiCommand() {
    if (!aiCommand.trim()) return;
    setAiLoading(true);
    setAiError('');
    setAiSuccess('');

    try {
      const intent = await parseVoiceCommand(aiCommand);

      // Match client
      if (intent.client_search_term) {
        const cls = await SearchClients(intent.client_search_term);
        if (cls.length === 1) {
          setSelectedClientId(cls[0].id);
          setClientSearch(cls[0].name);
          setAiSuccess(prev => prev + `✅ Клиент: ${cls[0].name}\n`);
        } else if (cls.length > 1) {
          setSelectedClientId(cls[0].id);
          setClientSearch(cls[0].name);
          setAiSuccess(prev => prev + `✅ Клиент: ${cls[0].name} (найдено ${cls.length}, выбран первый)\n`);
        } else {
          setAiSuccess(prev => prev + `⚠️ Клиент "${intent.client_search_term}" не найден в базе\n`);
        }
      }

      // Match products
      if (intent.products && intent.products.length > 0) {
        const newRows: InvoiceRow[] = [];
        for (const p of intent.products) {
          let prod: models.Product | null = null;

          try {
            const pickedId = await aiPickProductIdFromList(
              p.name_search_term,
              (products ?? []).map((x) => ({ id: x.id, name: x.name }))
            );
            if (pickedId) {
              prod = (products ?? []).find((x) => x.id === pickedId) || null;
            }
          } catch {
            // ignore
          }

          if (!prod) {
            const prods = await SearchProducts(p.name_search_term);
            prod = (prods && prods.length >= 1) ? prods[0] : null;
          }

          if (prod) {
            const qty = p.quantity || 1;
            newRows.push({
              _id: makeRowId(),
              product_id: prod.id,
              name: prod.name,
              unit: prod.unit,
              quantity: qty,
              price: prod.price,
              amount: qty * prod.price,
            });
            setAiSuccess(prev => prev + `✅ Товар: ${prod.name} × ${qty}\n`);
          } else {
            newRows.push({
              _id: makeRowId(),
              name: p.name_search_term,
              unit: 'шт',
              quantity: p.quantity || 1,
              price: 0,
              amount: 0,
            });
            setAiSuccess(prev => prev + `⚠️ "${p.name_search_term}" не найден, добавлен вручную\n`);
          }
        }
        setRows(newRows.length > 0 ? newRows : rows);
      }
    } catch (err) {
      setAiError((err as Error).message);
    }
    setAiLoading(false);
  }

  // Voice recording
  const releaseMediaResources = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
  }, []);

  async function startRecording() {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        releaseMediaResources();
        setIsRecording(false);
        // For now, just notify user. Full transcription needs API.
        setAiCommand('(Голосовой ввод — транскрипция требует API)');
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      setAiError('Не удалось получить доступ к микрофону');
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      return;
    }
    releaseMediaResources();
    if (isRecording) {
      setIsRecording(false);
    }
  }

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      releaseMediaResources();
    };
  }, [releaseMediaResources]);

  function selectClient(client: models.Client) {
    setSelectedClientId(client.id);
    setClientSearch(client.name);
    setShowClientDropdown(false);
  }

  function updateRow(id: string, field: keyof InvoiceRow, value: string | number) {
    setRows(prev => prev.map(r => {
      if (r._id !== id) return r;
      const updated = { ...r, [field]: value };
      if (field === 'quantity' || field === 'price') {
        updated.amount = (updated.quantity || 0) * (updated.price || 0);
      }
      return updated;
    }));
    if (field === 'name') {
      doProductSearch(value as string);
      setActiveProductRow(id);
    }
  }

  function openProductDropdown(rowId: string) {
    const row = rows.find(r => r._id === rowId);
    doProductSearch(row?.name || '');
    setActiveProductRow(rowId);
  }

  function addRow() {
    setRows(prev => [...prev, { _id: makeRowId(), name: '', unit: 'шт', quantity: 1, price: 0, amount: 0 }]);
  }

  function removeRow(id: string) {
    setRows(prev => prev.length > 1 ? prev.filter(r => r._id !== id) : prev);
  }

  function selectProduct(rowId: string, product: models.Product) {
    setRows(prev => prev.map(r => {
      if (r._id !== rowId) return r;
      const qty = r.quantity || 1;
      return { ...r, product_id: product.id, name: product.name, unit: product.unit, price: product.price, amount: qty * product.price };
    }));
    setActiveProductRow(null);
  }

  // Totals
  const subtotal = rows.reduce((s, r) => s + (r.amount || 0), 0);
  const { vatAmount, total } = calcTotalsBySubtotal(subtotal, vatMode);
  const totalWords = numberToWords(total);

  async function handleFinalize() {
    if (savingInvoice) return;
    if (!selectedClientId || !selectedCompanyId) {
      pushToast('Выберите клиента и компанию', 'error');
      return;
    }
    if (!invoiceNumber.trim()) {
      pushToast('Укажите номер счёта', 'error');
      return;
    }
    if (rows.every(r => !r.name.trim())) {
      pushToast('Добавьте хотя бы один товар', 'error');
      return;
    }

    const selectedClient = clients.find(c => c.id === selectedClientId);
    const selectedCompany = companies.find(c => c.id === selectedCompanyId);
    if (!selectedClient || !selectedCompany) {
      pushToast('Не найден клиент или компания', 'error');
      return;
    }

    const items = rows
      .filter(r => r.name.trim())
      .map(r => ({
        product_id: r.product_id || '',
        name: r.name,
        unit: r.unit,
        quantity: r.quantity,
        price: r.price,
        sum: r.amount,
      }));

    const vatRate = vatMode === 'none' ? 0 : VAT_RATE;

    const inv: models.Invoice = {
      id: invoiceNumber.trim(),
      invoice_number: invoiceNumber.trim(),
      invoice_date: invoiceDate,
      my_company_id: selectedCompanyId,
      client_id: selectedClientId,
      vat_mode: vatMode,
      vat_rate: vatRate,
      items_json: JSON.stringify(items),
      subtotal,
      vat_amount: vatAmount,
      total,
      total_words: numberToWords(total),
      comment: comment || '',
      created_at: '',
      updated_at: '',
    };

    setSavingInvoice(true);
    try {
      await UpsertInvoice(inv);
      await refreshData();

      const selectedTemplate = templatesForCurrentVat.find(t => t.id === selectedTemplateId) || templatesForCurrentVat[0];
      if (!selectedTemplate?.file_path) {
        pushToast('Для выбранной моей компании и режима НДС не назначен шаблон.', 'error');
        return;
      }
      const templatePath = selectedTemplate.file_path;
      const savedXlsxPath = await GenerateInvoice(inv, selectedCompany, selectedClient, templatePath, false);

      if (alsoDownloadPdf && savedXlsxPath) {
        await ConvertXlsxToPDF(savedXlsxPath);
      }

      setSuccessMsg(`Счёт №${invoiceNumber} сохранён!`);
      setTimeout(() => setSuccessMsg(''), 4000);

      const currentNumber = parseInt(invoiceNumber, 10);
      if (!Number.isNaN(currentNumber)) {
        setInvoiceNumber(String(currentNumber + 1));
      }
      setInvoiceNumberManual(false);

      setSelectedClientId('');
      setClientSearch('');
      nextRowIdRef.current = 1;
      setRows([{ _id: '0', name: '', unit: 'шт', quantity: 1, price: 0, amount: 0 }]);
      setComment('');
      setAiCommand('');
      setAiSuccess('');
      setAiError('');
    } catch (e: any) {
      pushToast(e?.message ?? String(e), 'error');
    } finally {
      setSavingInvoice(false);
    }
  }

  const selectedClient = clients.find(c => c.id === selectedClientId);
  const selectedCompany = companies.find(c => c.id === selectedCompanyId);
  const vatModeLabels: Record<'none' | 'included' | 'on_top', string> = {
    none: 'Без НДС',
    included: 'НДС включён (22%)',
    on_top: 'НДС сверху (22%)',
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <InvoiceActionBar
        successMsg={successMsg}
        onDismissSuccess={() => setSuccessMsg('')}
        onOpenRegistry={() => setActiveTab('registry')}
        onSave={handleFinalize}
        savingInvoice={savingInvoice}
      />

      {/* AI Command Center */}
      {/* В разработке */}
      <div className="hidden bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200 p-5 mb-5 min-w-[800px]">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-slate-700">AI Быстрый ввод</h3>
          <div className="flex-1" />
          <div className="flex items-center gap-1.5 px-2 py-1 bg-white/70 rounded border border-blue-100">
            <Cpu className="w-3 h-3 text-purple-500" />
            <span className="text-[10px] font-medium text-purple-600">{modelName}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={aiCommand}
              onChange={e => setAiCommand(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAiCommand(); } }}
              placeholder='Напишите: "ИП Путилов счёт на 100 плиток и 20 бордюров"'
              className="w-full px-4 py-3 border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`p-3 rounded-lg transition-all shrink-0 ${
              isRecording
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-white text-slate-500 border border-blue-200 hover:bg-blue-50'
            }`}
            title={isRecording ? 'Остановить' : 'Голос'}
          >
            {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          <button
            onClick={handleAiCommand}
            disabled={aiLoading || !aiCommand.trim()}
            className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium shrink-0"
          >
            {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Отправить
          </button>
        </div>

        {/* Hint chips */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {[
            'ИП Путилов 100 плиток',
            'Стройинвест 50 бордюров и 10т щебня',
            'Мегастрой 200 м² плитка Волна',
            'Жукова консультация',
          ].map(hint => (
            <button
              key={hint}
              onClick={() => setAiCommand(hint)}
              className="px-2.5 py-1 bg-white/80 border border-blue-100 rounded-full text-xs text-blue-600 hover:bg-blue-100 transition-colors"
            >
              {hint}
            </button>
          ))}
        </div>

        {aiError && <p className="mt-2 text-sm text-red-600">{aiError}</p>}
        {aiSuccess && (
          <div className="mt-2 p-2 bg-white/80 rounded-lg text-sm whitespace-pre-wrap text-slate-700 border border-green-200">
            {aiSuccess}
          </div>
        )}
      </div>

      {/* Invoice Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-4 min-w-[800px]">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">От кого (моя компания)</label>
            <select
              value={selectedCompanyId}
              onChange={e => setSelectedCompanyId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Выберите —</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.short_name || c.name}</option>
              ))}
            </select>
            {selectedCompany && <p className="mt-1 text-xs text-slate-400">ИНН: {selectedCompany.inn}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Номер счёта</label>
            <input type="text" value={invoiceNumber}
              onChange={e => { setInvoiceNumber(e.target.value); setInvoiceNumberManual(true); }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Дата</label>
            <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      </div>

      {/* Client */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-4 min-w-[800px]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">Покупатель</h3>
          <div className="flex gap-2">
            {selectedClient && (
              <button onClick={() => { setSelectedClientId(''); setClientSearch(''); }}
                className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1">
                <X className="w-3 h-3" /> Сбросить
              </button>
            )}
            <button onClick={() => setActiveTab('clients')} className="text-xs text-blue-600 hover:underline">
              Все клиенты →
            </button>
          </div>
        </div>
        <div className="relative" ref={clientSearchRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Поиск клиента..." value={clientSearch}
            onChange={e => { setClientSearch(e.target.value); setSelectedClientId(''); }}
            onFocus={() => { if (clientSearch.length >= 1 && !selectedClientId && clientResults.length > 0) setShowClientDropdown(true); }}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
          {showClientDropdown && clientResults.length > 0 && !selectedClientId && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {clientResults.map(client => (
                <button key={client.id} onMouseDown={(e) => { e.preventDefault(); selectClient(client); }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 flex justify-between border-b border-slate-50 last:border-0">
                  <span className="font-medium text-slate-800">{client.name}</span>
                  <span className="text-slate-400 text-xs">ИНН: {client.inn}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {selectedClient && (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg text-sm grid grid-cols-2 md:grid-cols-4 gap-2">
            <div><span className="text-blue-400 text-xs">ИНН:</span> <span className="text-slate-700">{selectedClient.inn}</span></div>
            <div><span className="text-blue-400 text-xs">КПП:</span> <span className="text-slate-700">{selectedClient.kpp || '—'}</span></div>
            <div className="col-span-2"><span className="text-blue-400 text-xs">Адрес:</span> <span className="text-slate-700">{selectedClient.address || '—'}</span></div>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-4 min-w-[800px]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">Товары / Услуги</h3>
          <button onClick={addRow} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
            <Plus className="w-4 h-4" /> Добавить строку
          </button>
        </div>

        <div className="space-y-3">
          {rows.map((row, idx) => (
            <div key={row._id} className="border border-slate-200 rounded-lg p-3">
              {/* Row 1: Number + Product name */}
              <div className="flex items-start gap-2 mb-2">
                <span className="text-xs font-medium text-slate-400 pt-2 shrink-0 w-6">{idx + 1}.</span>
                <div className="relative product-dropdown-zone flex-1">
                  <div className="flex">
                    <input type="text" value={row.name}
                      onChange={e => updateRow(row._id, 'name', e.target.value)}
                      onFocus={() => openProductDropdown(row._id)}
                      placeholder="Название товара..."
                      className="w-full px-3 py-2 border border-slate-200 rounded-l text-sm focus:ring-1 focus:ring-blue-500 focus:z-10" />
                    <button
                      onMouseDown={(e) => { e.preventDefault(); activeProductRow === row._id ? setActiveProductRow(null) : openProductDropdown(row._id); }}
                      className="px-2.5 border border-l-0 border-slate-200 rounded-r text-slate-400 hover:text-blue-600 hover:bg-blue-50 shrink-0">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {activeProductRow === row._id && productResults.length > 0 && (
                    <div className="absolute z-40 top-full left-0 mt-0.5 bg-white border border-slate-200 rounded-lg shadow-xl max-h-56 overflow-y-auto" style={{minWidth:'100%', width:'max-content', maxWidth:'600px'}}>
                      {productResults.map(p => (
                        <button key={p.id} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); selectProduct(row._id, p); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex justify-between items-center border-b border-slate-50 last:border-0">
                          <div className="min-w-0 flex-1">
                            <span className="font-medium text-slate-800 block" style={{whiteSpace:'normal', wordBreak:'break-word'}}>{p.name}</span>
                            {p.category && <span className="text-[11px] text-slate-400">{p.category}</span>}
                          </div>
                          <span className="text-slate-500 text-xs whitespace-nowrap ml-3 font-mono">
                            {formatMoney(p.price)} ₽/{p.unit}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {activeProductRow === row._id && productResults.length === 0 && row.name.trim() && (
                    <div className="absolute z-40 top-full left-0 right-0 mt-0.5 bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-3 text-sm text-slate-400">
                      Не найдено — введите вручную
                    </div>
                  )}
                </div>
              </div>
              {/* Row 2: Unit, Qty, Price, Amount, Delete */}
              <div className="flex items-center gap-2 pl-8">
                <div className="w-20">
                  <label className="block text-[10px] text-slate-400 mb-0.5">Ед.</label>
                  <select value={row.unit} onChange={e => updateRow(row._id, 'unit', e.target.value)}
                    className="w-full px-1.5 py-1.5 border border-slate-200 rounded text-sm">
                    {['шт','м²','м³','м.п.','кг','т','л','комп.','усл.','час','пал.','рул.','уп.'].map(u =>
                      <option key={u} value={u}>{u}</option>
                    )}
                  </select>
                </div>
                <div className="w-24">
                  <label className="block text-[10px] text-slate-400 mb-0.5">Кол-во</label>
                  <input type="number" step="0.01" min="0" value={row.quantity || ''}
                    onChange={e => updateRow(row._id, 'quantity', parseLocaleNumber(e.target.value))}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm text-right" />
                </div>
                <div className="w-28">
                  <label className="block text-[10px] text-slate-400 mb-0.5">Цена</label>
                  <input type="number" step="0.01" min="0" value={row.price || ''}
                    onChange={e => updateRow(row._id, 'price', parseLocaleNumber(e.target.value))}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm text-right" />
                </div>
                <div className="w-28 text-">
                  <label className="block text-[10px] text-slate-400 mb-0.5">Сумма</label>
                  <div className="py-1.5 font-mono font-medium text-slate-700 text-sm text-right">{formatMoney(row.amount || 0)} ₽</div>
                </div>
                <div className="ml-auto pt-3.5">
                  <button onClick={() => removeRow(row._id)} className="p-1 text-slate-300 hover:text-red-500 cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <button onClick={addRow} className="mt-3 w-full py-2 border border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
          + Добавить строку
        </button>
      </div>

      {/* VAT, Comment & Totals */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-4 min-w-[800px]">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">НДС</label>
              <div className="flex gap-2 flex-wrap">
                {(selectedCompanyId
                  ? availableVatModes
                  : (['none', 'included', 'on_top'] as const)
                ).map((value) => (
                  <button key={value} onClick={() => setVatMode(value)}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      vatMode === value ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}>
                    {vatModeLabels[value]}
                  </button>
                ))}
                {selectedCompanyId && availableVatModes.length === 0 && (
                  <span className="text-xs text-amber-600">Для выбранной моей компании не назначены шаблоны</span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Шаблон счета</label>
              <select
                value={selectedTemplateId}
                onChange={e => setSelectedTemplateId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                disabled={templatesForCurrentVat.length === 0}
              >
                {templatesForCurrentVat.length === 0 ? (
                  <option value="">— Нет шаблона для этого режима НДС —</option>
                ) : (
                  templatesForCurrentVat.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Комментарий</label>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={2}
                placeholder="Примечание к счёту..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => setAlsoDownloadPdf(!alsoDownloadPdf)} className="text-slate-500">
                {alsoDownloadPdf ? <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5" />}
              </button>
              <span className="text-sm text-slate-600">Также скачать в PDF</span>
            </div>
          </div>

          <InvoiceTotalsSummary
            subtotal={subtotal}
            vatAmount={vatAmount}
            total={total}
            totalWords={totalWords}
            vatMode={vatMode}
          />
        </div>
      </div>

      {/* Preview */}
      {selectedCompany && selectedClient && total > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-slate-700">Предпросмотр</h3>
          </div>
          <div className="border border-slate-300 rounded p-6 text-sm">
            <div className="text-center mb-4">
              <h4 className="text-lg font-bold">
                Счёт на оплату № {invoiceNumber} от {new Date(invoiceDate).toLocaleDateString('ru-RU')}
              </h4>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
              <div>
                <p className="font-semibold mb-1">Поставщик:</p>
                <p>{selectedCompany.name}</p>
                <p>ИНН {selectedCompany.inn} {selectedCompany.kpp ? `КПП ${selectedCompany.kpp}` : ''}</p>
              </div>
              <div>
                <p className="font-semibold mb-1">Покупатель:</p>
                <p>{selectedClient.name}</p>
                <p>ИНН {selectedClient.inn} {selectedClient.kpp ? `КПП ${selectedClient.kpp}` : ''}</p>
              </div>
            </div>
            <table className="w-full text-xs border-collapse mb-3">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 px-2 py-1">№</th>
                  <th className="border border-slate-300 px-2 py-1 text-left">Наименование</th>
                  <th className="border border-slate-300 px-2 py-1">Ед.</th>
                  <th className="border border-slate-300 px-2 py-1 text-right">Кол-во</th>
                  <th className="border border-slate-300 px-2 py-1 text-right">Цена</th>
                  <th className="border border-slate-300 px-2 py-1 text-right">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {rows.filter(r => r.name).map((r, i) => (
                  <tr key={r._id}>
                    <td className="border border-slate-300 px-2 py-1 text-center">{i + 1}</td>
                    <td className="border border-slate-300 px-2 py-1">{r.name}</td>
                    <td className="border border-slate-300 px-2 py-1 text-center">{r.unit}</td>
                    <td className="border border-slate-300 px-2 py-1 text-right">{r.quantity}</td>
                    <td className="border border-slate-300 px-2 py-1 text-right">{formatMoney(r.price)}</td>
                    <td className="border border-slate-300 px-2 py-1 text-right">{formatMoney(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-right">
              <p><strong>Итого: {formatMoney(total)} ₽</strong></p>
              {vatMode !== 'none' && <p>В т.ч. НДС 22%: {formatMoney(vatAmount)} ₽</p>}
              {vatMode === 'none' && <p>Без НДС</p>}
            </div>
            <p className="mt-2 text-xs italic">{totalWords}</p>
            {comment && <p className="mt-2 text-xs text-slate-500">Примечание: {comment}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
