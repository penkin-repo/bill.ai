import { useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { Package, Plus, Pencil, Trash2, Search, X, Upload, Circle } from 'lucide-react';
import { formatMoney } from '../utils/num2words';

function api() {
  return (window as any)?.go?.main?.App;
}

interface EditForm {
  id: string;
  name: string;
  category: string;
  unit: string;
  price: string;
}

const emptyForm: EditForm = { id: '', name: '', category: '', unit: 'м²', price: '' };

export function ProductsPage() {
  const { products, refreshData } = useApp();
  const { pushToast } = useToast();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [search, setSearch] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<EditForm>(emptyForm);
  const [isNew, setIsNew] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const filtered = useMemo(() => {
    const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return products;
    return products.filter(p => {
      const hay = (p.name + ' ' + (p.category || '') + ' ' + (p.unit || '')).toLowerCase();
      return words.every(w => hay.includes(w));
    });
  }, [products, search]);

  function openAdd() {
    setForm(emptyForm);
    setIsNew(true);
    setError('');
    setEditOpen(true);
  }

  function openEdit(p: typeof products[0]) {
    setForm({
      id: p.id,
      name: p.name,
      category: p.category || '',
      unit: p.unit,
      price: String(p.price),
    });
    setIsNew(false);
    setError('');
    setEditOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Укажите название'); return; }
    const price = parseFloat(form.price);
    if (isNaN(price) || price < 0) { setError('Укажите корректную цену'); return; }
    setBusy(true);
    setError('');
    try {
      const a = api();
      if (!a) throw new Error('API not ready');
      await a.UpsertProduct({
        id: form.id || form.name,
        name: form.name.trim(),
        category: form.category.trim(),
        unit: form.unit.trim() || 'шт',
        price,
        description: '',
        created_at: '',
        updated_at: '',
      });
      setEditOpen(false);
      await refreshData();
    } catch (e: any) {
      setError(e?.message || 'Ошибка сохранения');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Удалить "${name}"?`)) return;
    try {
      const a = api();
      if (!a) return;
      await a.DeleteProduct(id);
      await refreshData();
    } catch (e: any) {
      pushToast('Ошибка удаления: ' + (e?.message || ''), 'error');
    }
  }

  function parseDisplayMeta(p: (typeof products)[number]) {
    const mainName = p.name.split(', коллекция:')[0] || p.name;
    const collection = (p.category || '').trim();
    const color = (p.description || '').trim();
    return {
      mainName: mainName.trim(),
      collection: collection || '—',
      color: color || '—',
    };
  }

  function pickColorDotClass(color: string) {
    const c = color.toLowerCase();
    if (c.includes('красн')) return 'text-red-500';
    if (c.includes('бел')) return 'text-slate-300';
    if (c.includes('чер') || c.includes('антрацит')) return 'text-slate-700';
    if (c.includes('сер')) return 'text-slate-400';
    if (c.includes('янтар') || c.includes('песч') || c.includes('клинк')) return 'text-amber-500';
    if (c.includes('корич')) return 'text-amber-800';
    return 'text-slate-300';
  }

  async function handleImportBase(file: File) {
    if (!confirm('Загрузить базу товаров из CSV? Текущий справочник будет полностью заменен.')) return;
    setBusy(true);
    try {
      const a = api();
      if (!a) return;
      const csvText = await file.text();
      await a.ImportProductsFromCSV(csvText);
      await refreshData();
      pushToast('База товаров загружена из CSV.', 'success');
    } catch (e: any) {
      pushToast('Ошибка загрузки базы: ' + (e?.message || ''), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Товары и услуги</h2>
          <p className="text-sm text-slate-500 mt-1">{products.length} товаров в справочнике</p>
        </div>
        <div className="flex gap-2">
          <input
            ref={importInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                void handleImportBase(file);
              }
              e.target.value = '';
            }}
          />
          <button onClick={() => importInputRef.current?.click()} disabled={busy}
            className="flex items-center gap-2 text-slate-600 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-sm disabled:opacity-50">
            <Upload className="w-4 h-4" /> {busy ? 'Загрузка...' : 'Загрузить базу'}
          </button>
          <button onClick={openAdd}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
            <Plus className="w-4 h-4" /> Добавить
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Поиск по названию, категории..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Table */}
      {products.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 mb-2">Нет товаров</p>
          <p className="text-xs text-slate-400 mb-4">Добавьте товар вручную или загрузите каталог из CSV</p>
          <button onClick={() => importInputRef.current?.click()} disabled={busy} className="inline-flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-200 text-sm">
            <Upload className="w-4 h-4" /> Загрузить базу
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase">
                <th className="px-4 py-3">Название</th>
                <th className="px-4 py-3">Коллекция</th>
                <th className="px-4 py-3">Цвет</th>
                <th className="px-4 py-3 w-24">Ед. изм.</th>
                <th className="px-4 py-3 text-right w-32">Цена</th>
                <th className="px-4 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Ничего не найдено</td></tr>
              ) : filtered.map(product => (
                <tr key={product.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-4 py-3 text-sm">
                    <p className="font-semibold text-slate-800">{parseDisplayMeta(product).mainName}</p>
                    <p className="text-slate-500">коллекция: {parseDisplayMeta(product).collection}, цвет: {parseDisplayMeta(product).color}</p>
                    <p className="text-xs italic text-slate-400">(производство «Выбор»)</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-medium text-xs">
                      {parseDisplayMeta(product).collection}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    <span className="inline-flex items-center gap-2">
                      <Circle className={`w-2.5 h-2.5 fill-current ${pickColorDotClass(parseDisplayMeta(product).color)}`} />
                      {parseDisplayMeta(product).color}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 uppercase">{product.unit}</td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-3xl font-semibold leading-none text-slate-900">{Math.round(product.price)}</p>
                    <p className="text-xs text-slate-400 mt-1">за {product.unit}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(product)} title="Редактировать"
                        className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(product.id, product.name)} title="Удалить"
                        className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-slate-400">Показано: {filtered.length} из {products.length} товаров</p>

      {/* Edit/Add Modal */}
      {editOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setEditOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-800 mb-4">{isNew ? 'Добавить товар' : 'Редактировать товар'}</h3>
            {error && <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Название</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Категория</label>
                  <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Ед. изм.</label>
                  <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="м²">м²</option>
                    <option value="шт">шт</option>
                    <option value="м³">м³</option>
                    <option value="п.м.">п.м.</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Цена, ₽</label>
                  <input type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setEditOpen(false)}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Отмена</button>
              <button onClick={handleSave} disabled={busy}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
                {busy ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
