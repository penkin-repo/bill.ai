import { CheckSquare, Download, Loader2, Zap } from 'lucide-react';

type Props = {
  successMsg: string;
  onDismissSuccess: () => void;
  onOpenRegistry: () => void;
  onSave: () => void;
  savingInvoice: boolean;
};

export function InvoiceActionBar({
  successMsg,
  onDismissSuccess,
  onOpenRegistry,
  onSave,
  savingInvoice,
}: Props) {
  return (
    <>
      {successMsg && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-5 py-3 rounded-lg shadow-lg animate-fade-in flex items-center gap-2">
          <CheckSquare className="w-5 h-5" />
          {successMsg}
          <button
            onClick={() => {
              onDismissSuccess();
              onOpenRegistry();
            }}
            className="ml-2 underline text-sm"
          >
            Открыть реестр
          </button>
        </div>
      )}

      <div className="sticky top-0 z-30 -mx-2 px-2 py-3 mb-6 bg-slate-50/95 backdrop-blur border-b border-slate-200 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Zap className="w-6 h-6 text-amber-500" />
            Выставить счёт
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">Введите команду или заполните форму вручную</p>
        </div>
        <button
          onClick={onSave}
          disabled={savingInvoice}
          className="flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {savingInvoice ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {savingInvoice ? 'Сохранение...' : 'Сохранить счёт'}
        </button>
      </div>
    </>
  );
}
