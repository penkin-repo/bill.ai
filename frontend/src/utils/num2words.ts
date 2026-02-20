const ones = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
const onesF = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
const teens = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
const tens = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
const hundreds = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];

type WordForms = [string, string, string];

function getForm(n: number, forms: WordForms): string {
  const abs = Math.abs(n) % 100;
  const n1 = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (n1 > 1 && n1 < 5) return forms[1];
  if (n1 === 1) return forms[0];
  return forms[2];
}

function convertGroup(n: number, feminine: boolean): string {
  if (n === 0) return '';
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const remainder = n % 100;
  const t = Math.floor(remainder / 10);
  const o = remainder % 10;

  if (h > 0) parts.push(hundreds[h]);
  if (remainder >= 10 && remainder < 20) {
    parts.push(teens[remainder - 10]);
  } else {
    if (t > 0) parts.push(tens[t]);
    if (o > 0) parts.push(feminine ? onesF[o] : ones[o]);
  }
  return parts.join(' ');
}

export function numberToWords(amount: number): string {
  if (amount === 0) return 'ноль рублей 00 копеек';

  const rub = Math.floor(Math.abs(amount));
  const kop = Math.round((Math.abs(amount) - rub) * 100);

  const billions = Math.floor(rub / 1000000000);
  const millions = Math.floor((rub % 1000000000) / 1000000);
  const thousands = Math.floor((rub % 1000000) / 1000);
  const rest = rub % 1000;

  const parts: string[] = [];

  if (billions > 0) {
    parts.push(convertGroup(billions, false));
    parts.push(getForm(billions, ['миллиард', 'миллиарда', 'миллиардов']));
  }
  if (millions > 0) {
    parts.push(convertGroup(millions, false));
    parts.push(getForm(millions, ['миллион', 'миллиона', 'миллионов']));
  }
  if (thousands > 0) {
    parts.push(convertGroup(thousands, true));
    parts.push(getForm(thousands, ['тысяча', 'тысячи', 'тысяч']));
  }
  if (rest > 0) {
    parts.push(convertGroup(rest, false));
  }

  if (parts.length === 0) parts.push('ноль');

  const rubWord = getForm(rub, ['рубль', 'рубля', 'рублей']);
  const kopStr = kop.toString().padStart(2, '0');
  const kopWord = getForm(kop, ['копейка', 'копейки', 'копеек']);

  let result = parts.join(' ') + ' ' + rubWord + ' ' + kopStr + ' ' + kopWord;
  result = result.charAt(0).toUpperCase() + result.slice(1);
  return result;
}

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
