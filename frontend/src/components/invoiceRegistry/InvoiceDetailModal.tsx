import { X } from 'lucide-react';
import { formatMoney, numberToWords } from '../../utils/num2words';

type InvoiceItem = {
  name?: string;
  unit?: string;
  quantity?: number;
  price?: number;
  amount?: number;
  sum?: number;
};

type InvoiceViewModel = {
  id: string;
  number?: string;
  date?: string;
  company_id: string;
  client_id: string;
  vat_mode?: string;
  total?: number;
  created_at?: string;
  items?: InvoiceItem[];
};

type Props = {
  selectedInvoice: InvoiceViewModel;
  onClose: () => void;
  getCompanyName: (companyId: string) => string;
  getClientName: (clientId: string) => string;
  getVatLabel: (mode: string) => string;
};

export function InvoiceDetailModal({
  selectedInvoice,
  onClose,
  getCompanyName,
  getClientName,
  getVatLabel,
}: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h3 className="text-lg font-semibold">
            Счёт № {selectedInvoice.number} от {selectedInvoice.date ? new Date(selectedInvoice.date).toLocaleDateString('ru-RU') : '—'}
          </h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
          </button>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 gap-4 mb-5 text-sm">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-400 mb-1 font-medium uppercase">Поставщик</p>
              <p className="font-semibold text-slate-800">{getCompanyName(selectedInvoice.company_id)}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-400 mb-1 font-medium uppercase">Покупатель</p>
              <p className="font-semibold text-slate-800">{getClientName(selectedInvoice.client_id)}</p>
            </div>
          </div>

          <table className="w-full text-sm border-collapse mb-4">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-200 px-3 py-2 text-left w-10">№</th>
                <th className="border border-slate-200 px-3 py-2 text-left">Наименование</th>
                <th className="border border-slate-200 px-3 py-2 w-16">Ед.</th>
                <th className="border border-slate-200 px-3 py-2 text-right w-20">Кол-во</th>
                <th className="border border-slate-200 px-3 py-2 text-right w-24">Цена</th>
                <th className="border border-slate-200 px-3 py-2 text-right w-28">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {(selectedInvoice.items || []).map((item, i) => {
                const amount = typeof item.amount === 'number'
                  ? item.amount
                  : (typeof item.sum === 'number' ? item.sum : Number(item.quantity || 0) * Number(item.price || 0));

                return (
                  <tr key={i}>
                    <td className="border border-slate-200 px-3 py-2 text-center">{i + 1}</td>
                    <td className="border border-slate-200 px-3 py-2">{item.name}</td>
                    <td className="border border-slate-200 px-3 py-2 text-center">{item.unit}</td>
                    <td className="border border-slate-200 px-3 py-2 text-right">{item.quantity}</td>
                    <td className="border border-slate-200 px-3 py-2 text-right font-mono">{formatMoney(item.price || 0)}</td>
                    <td className="border border-slate-200 px-3 py-2 text-right font-mono font-medium">{formatMoney(amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="w-72 space-y-1 text-sm bg-slate-50 rounded-lg p-3">
              <div className="flex justify-between font-bold text-base border-t border-slate-200 pt-2">
                <span>Итого:</span>
                <span className="font-mono text-green-700">{formatMoney(selectedInvoice.total || 0)} ₽</span>
              </div>
              <div className="text-xs text-slate-500">{getVatLabel(selectedInvoice.vat_mode || 'none')}</div>
            </div>
          </div>

          {(selectedInvoice.total || 0) > 0 && (
            <div className="mt-3 p-2 bg-amber-50 rounded-lg border border-amber-100">
              <p className="text-xs text-slate-600 italic">{numberToWords(selectedInvoice.total || 0)}</p>
            </div>
          )}

          <div className="mt-4 pt-4 border-t text-xs text-slate-400">
            Создан: {selectedInvoice.created_at ? new Date(selectedInvoice.created_at).toLocaleString('ru-RU') : '—'}
          </div>
        </div>
      </div>
    </div>
  );
}
