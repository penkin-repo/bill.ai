function api() {
  return (window as any)?.go?.main?.App;
}

interface ParsedRequisites {
  name?: string;
  inn?: string;
  kpp?: string;
  address?: string;
  bank_name?: string;
  bik?: string;
  corr_account?: string;
  pay_account?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
}

interface ParsedIntent {
  client_search_term?: string;
  products?: Array<{
    name_search_term: string;
    quantity: number;
  }>;
}

export async function aiPickProductIdFromList(query: string, products: Array<{ id: string; name: string }>): Promise<string> {
  const list = (products ?? []).slice(0, 80).map((p) => `- ${p.id} | ${p.name}`).join('\n');

  const systemPrompt = `Ты помощник по подбору товара.
Нужно найти наиболее подходящий товар из списка и вернуть ТОЛЬКО JSON без markdown.
Формат: { "id": "<id из списка>" }
Если подходящего товара нет — верни { "id": "" }.`;

  const userPrompt = `Запрос: ${query}

Список товаров:
${list}`;

  const result = await callOpenRouter([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]);

  try {
    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return String(parsed?.id ?? '').trim();
  } catch {
    return '';
  }
}

async function getApiKey(): Promise<string> {
  const a = api();
  if (!a) return '';
  try {
    return (await a.GetSetting('openrouter_api_key')) || '';
  } catch {
    return '';
  }
}

export async function getSelectedModel(): Promise<string> {
  const a = api();
  if (!a) return 'google/gemini-flash-1.5';
  try {
    return (await a.GetSetting('ai_model')) || 'google/gemini-flash-1.5';
  } catch {
    return 'google/gemini-flash-1.5';
  }
}

export async function mapModelName(model: string): Promise<string> {
  const a = api();
  if (!a) return model;
  try {
    const raw = await a.GetSetting('ai_models');
    const list = JSON.parse(raw || '[]') as Array<{id:string;name:string}>;
    const found = list.find(m => m.id === model);
    return found?.name || model;
  } catch {
    return model;
  }
}

function formatOpenRouterError(raw: string, model: string): string {
  try {
    const parsed = JSON.parse(raw);
    const msg = parsed?.error?.message || '';
    const code = parsed?.error?.code || 0;
    const innerRaw = parsed?.error?.metadata?.raw || '';
    let innerMsg = '';
    try {
      const inner = JSON.parse(innerRaw);
      innerMsg = inner?.error?.message || '';
    } catch { /* not JSON */ }

    const detail = innerMsg || msg;

    if (detail.includes('not enabled') || detail.includes('not supported')) {
      return `Модель «${model}» не поддерживает этот тип запроса. Попробуйте другую модель в Настройках.\n(${detail})`;
    }
    if (detail.includes('invalid_api_key') || detail.includes('Unauthorized')) {
      return 'Неверный API-ключ OpenRouter. Проверьте ключ в Настройках.';
    }
    if (detail.includes('rate limit') || detail.includes('quota')) {
      return 'Превышен лимит запросов OpenRouter. Подождите или смените модель.';
    }
    if (detail.includes('context length') || detail.includes('too long')) {
      return 'Слишком длинный запрос для этой модели. Попробуйте сократить текст или выбрать модель с большим контекстом.';
    }
    if (code === 400) {
      return `Ошибка запроса к модели «${model}»: ${detail}`;
    }
    if (code === 402) {
      return 'Недостаточно средств на аккаунте OpenRouter. Пополните баланс на openrouter.ai';
    }
    if (code === 429) {
      return 'Слишком много запросов. Подождите немного и попробуйте снова.';
    }
    return `Ошибка AI (${code}): ${detail}`;
  } catch {
    return `Ошибка AI-сервиса: ${raw.slice(0, 200)}`;
  }
}

async function callOpenRouter(
  messages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }>,
  modelOverride?: string
): Promise<string> {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error('API ключ OpenRouter не настроен. Перейдите в Настройки.');

  const model = modelOverride || await getSelectedModel();

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(formatOpenRouterError(errText, model));
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

export async function parseRequisites(input: string): Promise<ParsedRequisites> {
  const systemPrompt = `Ты - парсер реквизитов компаний. Извлеки из текста реквизиты и верни ТОЛЬКО JSON без markdown форматирования.
Формат ответа:
{
  "name": "Полное название организации",
  "inn": "ИНН",
  "kpp": "КПП (если есть)",
  "address": "Юридический адрес",
  "bank_name": "Название банка",
  "bik": "БИК",
  "corr_account": "Корр. счет",
  "pay_account": "Расчетный счет",
  "contact_person": "Контактное лицо (если есть)",
  "phone": "Телефон (если есть)",
  "email": "Email (если есть)"
}
Если какое-то поле не найдено, оставь пустую строку.`;

  const result = await callOpenRouter([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: input },
  ]);

  try {
    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    throw new Error('Не удалось распознать реквизиты. Попробуйте другой формат.');
  }
}

export async function parseRequisitesFromImage(base64Image: string): Promise<ParsedRequisites> {
  const systemPrompt = `Ты - парсер реквизитов компаний. Извлеки из изображения реквизиты и верни ТОЛЬКО JSON без markdown форматирования.
Формат ответа:
{
  "name": "Полное название организации",
  "inn": "ИНН",
  "kpp": "КПП (если есть)",
  "address": "Юридический адрес",
  "bank_name": "Название банка",
  "bik": "БИК",
  "corr_account": "Корр. счет",
  "pay_account": "Расчетный счет",
  "contact_person": "Контактное лицо (если есть)",
  "phone": "Телефон (если есть)",
  "email": "Email (если есть)"
}
Если какое-то поле не найдено, оставь пустую строку.`;

  // For image recognition, prefer multimodal models
  const model = await getSelectedModel();

  const result = await callOpenRouter([
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Извлеки реквизиты из этого изображения' },
        { type: 'image_url', image_url: { url: base64Image } },
      ],
    },
  ], model);

  try {
    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    throw new Error('Не удалось распознать реквизиты из изображения.');
  }
}

export async function parseVoiceCommand(text: string): Promise<ParsedIntent> {
  const systemPrompt = `Ты - парсер голосовых команд для создания счетов. Извлеки сущности из текста и верни ТОЛЬКО JSON.
Формат:
{
  "client_search_term": "название клиента для поиска",
  "products": [
    { "name_search_term": "название товара для поиска", "quantity": число }
  ]
}
Пример: "Счет для ИП Путилова на 100 плиток" -> { "client_search_term": "Путилов", "products": [{ "name_search_term": "плитк", "quantity": 100 }] }`;

  const result = await callOpenRouter([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: text },
  ]);

  try {
    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    throw new Error('Не удалось распознать команду.');
  }
}

export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error('API ключ OpenRouter не настроен.');

  // Convert blob to base64
  const buffer = await audioBlob.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  const mimeType = audioBlob.type || 'audio/webm';
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const model = await getSelectedModel();

  const result = await callOpenRouter([
    { role: 'system', content: 'Транскрибируй аудио на русском языке. Верни только текст.' },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Транскрибируй это аудио' },
        { type: 'image_url', image_url: { url: dataUrl } },
      ],
    },
  ], model);

  return result.trim();
}

export async function getCurrentModelName(): Promise<string> {
  const model = await getSelectedModel();
  return mapModelName(model);
}
