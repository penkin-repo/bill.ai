import { useEffect, useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { parseRequisites, parseRequisitesFromImage, getCurrentModelName } from '../services/aiService';
import {
  Upload, FileText, Image, Sparkles, Loader2, CheckCircle,
  X, Save, Eye, Edit, AlertCircle, Cpu,
} from 'lucide-react';
import { models } from '../../wailsjs/go/models';

function api() {
  return (window as any)?.go?.main?.App;
}

type InputMode = 'text' | 'image';

const emptyClient: models.Client = {
  id: '', name: '', inn: '', kpp: '', address: '',
  bank_name: '', bank_bik: '', bank_corr_account: '', bank_account: '',
  contact_person: '', phone: '', email: '',
  comment: '', created_at: '', updated_at: '',
};

const FIELDS: [keyof models.Client, string][] = [
  ['name', 'Название организации *'],
  ['inn', 'ИНН'],
  ['kpp', 'КПП'],
  ['address', 'Юридический адрес'],
  ['bank_name', 'Название банка'],
  ['bank_bik', 'БИК'],
  ['bank_corr_account', 'Корр. счёт'],
  ['bank_account', 'Расчётный счёт'],
  ['contact_person', 'Контактное лицо'],
  ['phone', 'Телефон'],
  ['email', 'Email'],
  ['comment', 'Комментарий'],
];

export function AddClientPage() {
  const { refreshData, setActiveTab } = useApp();

  const [modelName, setModelName] = useState<string>('...');

  const [mode, setMode] = useState<InputMode>('text');
  const [inputText, setInputText] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Parsed preview
  const [parsedClient, setParsedClient] = useState<models.Client | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [editing, setEditing] = useState(false);

  // Success
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result as string);
        setMode('image');
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result as string);
        setMode('image');
      };
      reader.readAsDataURL(file);
    }
  };

  async function handleParse() {
    setLoading(true);
    setError('');
    setParsedClient(null);
    setShowPreview(false);

    try {
      let parsed;
      if (mode === 'image' && imagePreview) {
        parsed = await parseRequisitesFromImage(imagePreview);
      } else if (mode === 'text' && inputText.trim()) {
        parsed = await parseRequisites(inputText);
      } else {
        setError(mode === 'image' ? 'Загрузите изображение' : 'Введите текст реквизитов');
        setLoading(false);
        return;
      }

      const client: models.Client = {
        id: (parsed.inn || '').trim(),
        name: (parsed.name || '').trim(),
        inn: parsed.inn || '',
        kpp: parsed.kpp || '',
        address: parsed.address || '',
        bank_name: parsed.bank_name || '',
        bank_bik: parsed.bik || '',
        bank_corr_account: parsed.corr_account || '',
        bank_account: parsed.pay_account || '',
        contact_person: parsed.contact_person || '',
        phone: parsed.phone || '',
        email: parsed.email || '',
        comment: '',
        created_at: '',
        updated_at: '',
      };

      setParsedClient(client);
      setShowPreview(true);
      setEditing(false);
    } catch (err) {
      setError((err as Error).message);
    }
    setLoading(false);
  }

  function handleConfirm() {
    if (!parsedClient || !parsedClient.name.trim()) {
      setError('Название организации обязательно');
      return;
    }
    const inn = (parsedClient.inn || '').trim();
    if (!inn) {
      setError('ИНН обязателен');
      return;
    }

    const a = api();
    if (!a) {
      setError('Backend недоступен (нет window.go). Запускайте через wails dev.');
      return;
    }

    const name = parsedClient.name.trim();
    const client: models.Client = { ...parsedClient, id: inn, inn, name };

    setSaving(true);
    a.UpsertClient(client)
      .then(() => refreshData())
      .then(() => {
        setSuccess(`Клиент "${client.name}" добавлен в базу!`);
        // Reset
        setParsedClient(null);
        setShowPreview(false);
        setInputText('');
        setImagePreview(null);
        setTimeout(() => setSuccess(''), 4000);
      })
      .catch((e: any) => setError(e?.message ?? String(e)))
      .finally(() => setSaving(false));

  }

  function handleManualAdd() {
    setParsedClient({ ...emptyClient, id: '' });
    setShowPreview(true);
    setEditing(true);
  }

  const canParse = mode === 'text' ? inputText.trim().length > 10 : !!imagePreview;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Success banner */}
      {success && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-5 py-3 rounded-lg shadow-lg animate-fade-in flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          <span>{success}</span>
          <button onClick={() => setActiveTab('clients')} className="ml-2 underline text-sm">
            Открыть клиентов
          </button>
        </div>
      )}

      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-bold text-slate-800">Добавить клиента</h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 rounded-lg border border-purple-200">
            <Cpu className="w-3.5 h-3.5 text-purple-500" />
            <span className="text-xs font-medium text-purple-700">{modelName}</span>
          </div>
        </div>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Вставьте реквизиты текстом или загрузите скан — AI распознает и заполнит карточку клиента.
      </p>

      {/* Mode toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setMode('text')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            mode === 'text'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-300'
          }`}
        >
          <FileText className="w-4 h-4" />
          Текст реквизитов
        </button>
        <button
          onClick={() => setMode('image')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            mode === 'image'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-300'
          }`}
        >
          <Image className="w-4 h-4" />
          Скан / Картинка
        </button>
        <div className="flex-1" />
        <button
          onClick={handleManualAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm text-slate-500 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all"
        >
          <Edit className="w-4 h-4" />
          Заполнить вручную
        </button>
      </div>

      {/* Input area */}
      {!showPreview && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-4">
          {mode === 'text' ? (
            <>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Вставьте текст с реквизитами клиента:
              </label>
              <textarea
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                rows={8}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 font-mono resize-y"
                placeholder={`Пример:\n\nООО "Стройинвест"\nИНН 7701234567 КПП 770101001\nАдрес: 101000, г. Москва, ул. Мясницкая, д. 22\n\nБанковские реквизиты:\nр/с 40702810700000054321\nПАО "ВТБ"\nБИК 044525187\nк/с 30101810700000000187`}
              />
            </>
          ) : (
            <div
              onDragOver={e => { e.preventDefault(); }}
              onDrop={handleDrop}
              className="text-center"
            >
              {imagePreview ? (
                <div className="relative inline-block">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="max-h-64 rounded-lg border border-slate-200 mx-auto"
                  />
                  <button
                    onClick={() => setImagePreview(null)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 hover:border-blue-400 transition-colors">
                  <Upload className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500 mb-2">
                    Перетащите изображение сюда или
                  </p>
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg cursor-pointer hover:bg-blue-100 text-sm font-medium">
                    <Image className="w-4 h-4" />
                    Выберите файл
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-slate-400 mt-2">
                    JPG, PNG, WEBP — скан реквизитов, карточка предприятия и т.д.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Parse button */}
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleParse}
              disabled={!canParse || loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {loading ? 'AI распознаёт...' : 'Распознать реквизиты'}
            </button>
            {error && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {error}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Preview / Edit parsed result */}
      {showPreview && parsedClient && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
          <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-blue-600" />
              <h3 className="font-semibold text-slate-700">
                {editing ? 'Заполните данные клиента' : 'Результат распознавания'}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 px-2 py-1 rounded hover:bg-blue-50"
                >
                  <Edit className="w-3 h-3" />
                  Редактировать
                </button>
              )}
              <button
                onClick={() => { setShowPreview(false); setParsedClient(null); }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-5">
            {editing ? (
              /* Editable form */
              <div className="grid grid-cols-2 gap-3">
                {FIELDS.map(([field, label]) => (
                  <div key={field} className={field === 'address' || field === 'name' ? 'col-span-2' : ''}>
                    <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
                    <input
                      type="text"
                      value={(parsedClient[field] as string) || ''}
                      onChange={e => setParsedClient({ ...parsedClient, [field]: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>
            ) : (
              /* Read-only preview */
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <p className="text-xs text-blue-400 font-medium">Название</p>
                  <p className="text-lg font-semibold text-slate-800">{parsedClient.name || '—'}</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {FIELDS.filter(([f]) => f !== 'name').map(([field, label]) => {
                    const val = (parsedClient[field] as string) || '';
                    return (
                      <div key={field} className={`p-2.5 rounded-lg ${val ? 'bg-green-50 border border-green-100' : 'bg-slate-50 border border-slate-100'} ${field === 'address' ? 'col-span-2 md:col-span-3' : ''}`}>
                        <p className="text-[10px] text-slate-400 font-medium uppercase">{label}</p>
                        <p className={`text-sm ${val ? 'text-slate-800' : 'text-slate-300 italic'} ${field === 'bank_account' || field === 'bank_corr_account' ? 'font-mono text-xs' : ''}`}>
                          {val || 'не распознано'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="mt-5 flex items-center gap-3 pt-4 border-t">
              <button
                onClick={handleConfirm}
                disabled={!parsedClient.name?.trim() || !(parsedClient.inn || '').trim() || saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Сохранение...' : 'Добавить в базу'}
              </button>
              <button
                onClick={() => { setShowPreview(false); setParsedClient(null); }}
                className="px-4 py-2.5 text-sm text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Отмена
              </button>
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="px-4 py-2.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  Исправить вручную
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tips */}
      {!showPreview && (
        <div className="mt-6 bg-slate-50 rounded-xl p-5">
          <h4 className="font-medium text-slate-700 mb-3">💡 Подсказки</h4>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-slate-500">
            <div>
              <p className="font-medium text-slate-600 mb-1">Текстовый ввод:</p>
              <ul className="space-y-0.5 text-xs">
                <li>• Скопируйте реквизиты с сайта или из документа</li>
                <li>• AI найдёт ИНН, КПП, адрес, банковские данные</li>
                <li>• Формат не важен — AI разберётся</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-slate-600 mb-1">Скан / Картинка:</p>
              <ul className="space-y-0.5 text-xs">
                <li>• Перетащите фото карточки предприятия</li>
                <li>• Скриншот из PDF или сайта</li>
                <li>• Фото визитки с реквизитами</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
