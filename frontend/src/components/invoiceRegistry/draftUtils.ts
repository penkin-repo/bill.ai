import { EditableItem } from './types';

export function normalizeItems(rawItems: any[]): EditableItem[] {
  return (rawItems || []).map((it: any) => {
    const quantity = typeof it?.quantity === 'number' ? it.quantity : Number(it?.quantity || 0);
    const price = typeof it?.price === 'number' ? it.price : Number(it?.price || 0);
    const sum = typeof it?.sum === 'number'
      ? it.sum
      : (typeof it?.amount === 'number' ? it.amount : quantity * price);

    return {
      product_id: String(it?.product_id || ''),
      name: String(it?.name || ''),
      unit: String(it?.unit || 'шт'),
      quantity: Number.isFinite(quantity) ? quantity : 0,
      price: Number.isFinite(price) ? price : 0,
      sum: Number.isFinite(sum) ? sum : 0,
    };
  });
}

export function parseDraftItems(inv: any): EditableItem[] {
  if (Array.isArray(inv?.items) && inv.items.length > 0) {
    return normalizeItems(inv.items);
  }

  try {
    const parsed = JSON.parse(inv?.items_json || '[]');
    if (!Array.isArray(parsed)) return [];
    return normalizeItems(parsed);
  } catch {
    return [];
  }
}
