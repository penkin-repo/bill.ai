import { X } from 'lucide-react';
import { formatMoney } from '../../utils/num2words';
import { parseLocaleNumber } from '../../utils/number';
import { models } from '../../../wailsjs/go/models';
import { EditableItem, InvoiceEditDraft, VatMode } from './types';

type Props = {
  editDraft: InvoiceEditDraft;
  companies: models.MyCompany[];
  clients: models.Client[];
  products: models.Product[];
  onClose: () => void;
  onSave: () => void;
  onSetEditDraft: (next: InvoiceEditDraft) => void;
  onSetVatMode: (mode: VatMode) => void;
  onAddItem: () => void;
  onUpdateItem: (index: number, patch: Partial<EditableItem>) => void;
  onRemoveItem: (index: number) => void;
};

export function InvoiceEditModal({
  editDraft,
  companies,
  clients,
  products,
  onClose,
  onSave,
  onSetEditDraft,
  onSetVatMode,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
}: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Редактировать счёт</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-slate-400 hover:text-slate-700" />
          </button>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Номер счёта</label>
            <input
              type="text"
              value={editDraft.number}
              onChange={(e) => onSetEditDraft({ ...editDraft, number: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Дата</label>
            <input
              type="date"
              value={editDraft.date}
              onChange={(e) => onSetEditDraft({ ...editDraft, date: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Компания</label>
            <select
              value={editDraft.company_id}
              onChange={(e) => onSetEditDraft({ ...editDraft, company_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="">— Выберите —</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.short_name || c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Покупатель</label>
            <select
              value={editDraft.client_id}
              onChange={(e) => onSetEditDraft({ ...editDraft, client_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="">— Выберите —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Режим НДС</label>
            <div className="flex gap-2">
              {([
                { key: 'none', label: 'Без НДС' },
                { key: 'included', label: 'НДС включён (22%)' },
                { key: 'on_top', label: 'НДС сверху (22%)' },
              ] as const).map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => onSetVatMode(m.key)}
                  className={`px-3 py-2 text-xs rounded-lg border ${editDraft.vat_mode === m.key ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div className="md:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-slate-600">Позиции счёта</label>
              <button type="button" onClick={onAddItem} className="text-xs text-blue-600 hover:underline">+ Добавить позицию</button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {(editDraft.items || []).map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    list="registry-products-list"
                    value={item.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      const matched = products.find((p) => p.name === name);
                      onUpdateItem(idx, matched
                        ? { name, product_id: matched.id, unit: matched.unit, price: matched.price }
                        : { name });
                    }}
                    className="col-span-5 px-2 py-1.5 border border-slate-300 rounded text-sm"
                    placeholder="Наименование"
                  />
                  <input
                    value={item.unit}
                    onChange={(e) => onUpdateItem(idx, { unit: e.target.value })}
                    className="col-span-1 px-2 py-1.5 border border-slate-300 rounded text-sm"
                    placeholder="Ед."
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={item.quantity}
                    onChange={(e) => onUpdateItem(idx, { quantity: parseLocaleNumber(e.target.value) })}
                    className="col-span-2 px-2 py-1.5 border border-slate-300 rounded text-sm text-right"
                    placeholder="Кол-во"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={item.price}
                    onChange={(e) => onUpdateItem(idx, { price: parseLocaleNumber(e.target.value) })}
                    className="col-span-2 px-2 py-1.5 border border-slate-300 rounded text-sm text-right"
                    placeholder="Цена"
                  />
                  <button
                    type="button"
                    onClick={() => onRemoveItem(idx)}
                    className="col-span-2 px-2 py-1.5 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50"
                  >
                    Удалить
                  </button>
                </div>
              ))}
              {(editDraft.items || []).length === 0 && (
                <p className="text-xs text-slate-400">Нет позиций. Добавьте хотя бы одну.</p>
              )}
            </div>
            <datalist id="registry-products-list">
              {products.map((p) => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
          </div>
          <div className="md:col-span-2 grid grid-cols-3 gap-2 text-xs">
            <div className="px-2 py-1.5 rounded bg-slate-50 border border-slate-200">Подитог: <span className="font-mono">{formatMoney(editDraft.subtotal || 0)} ₽</span></div>
            <div className="px-2 py-1.5 rounded bg-slate-50 border border-slate-200">НДС: <span className="font-mono">{formatMoney(editDraft.vat_amount || 0)} ₽</span></div>
            <div className="px-2 py-1.5 rounded bg-slate-50 border border-slate-200 font-semibold">Итого: <span className="font-mono">{formatMoney(editDraft.total || 0)} ₽</span></div>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Комментарий</label>
            <textarea
              value={editDraft.comment || ''}
              onChange={(e) => onSetEditDraft({ ...editDraft, comment: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              rows={3}
            />
          </div>
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Отмена</button>
          <button onClick={onSave} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Сохранить</button>
        </div>
      </div>
    </div>
  );
}
