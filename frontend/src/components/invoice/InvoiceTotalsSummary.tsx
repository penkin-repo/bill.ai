import { formatMoney } from '../../utils/num2words';

type Props = {
  subtotal: number;
  vatAmount: number;
  total: number;
  totalWords: string;
  vatMode: 'none' | 'included' | 'on_top';
};

export function InvoiceTotalsSummary({ subtotal, vatAmount, total, totalWords, vatMode }: Props) {
  return (
    <>
      <div className="w-72 space-y-2 bg-slate-50 rounded-lg p-4">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Подитог:</span>
          <span className="font-mono">{formatMoney(subtotal)} ₽</span>
        </div>
        {vatMode !== 'none' && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">НДС 22% {vatMode === 'included' ? '(вкл.)' : ''}:</span>
            <span className="font-mono">{formatMoney(vatAmount)} ₽</span>
          </div>
        )}
        <div className="flex justify-between text-lg font-bold border-t border-slate-200 pt-2">
          <span>Итого:</span>
          <span className="font-mono text-green-700">{formatMoney(total)} ₽</span>
        </div>
      </div>

      {total > 0 && (
        <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-100">
          <p className="text-xs text-amber-600 mb-1">Сумма прописью:</p>
          <p className="text-sm font-medium text-slate-700">{totalWords}</p>
        </div>
      )}
    </>
  );
}
