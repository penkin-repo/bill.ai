export type VatMode = 'none' | 'included' | 'on_top' | string;

export const VAT_RATE = 0.22;

export type InvoiceTotals = {
  subtotal: number;
  vatAmount: number;
  total: number;
};

export function calcTotalsBySubtotal(subtotalRaw: number, vatMode: VatMode): InvoiceTotals {
  const subtotal = Number.isFinite(subtotalRaw) ? subtotalRaw : 0;

  if (vatMode === 'on_top') {
    const vatAmount = subtotal * VAT_RATE;
    return { subtotal, vatAmount, total: subtotal + vatAmount };
  }

  if (vatMode === 'included') {
    const vatAmount = subtotal - subtotal / (1 + VAT_RATE);
    return { subtotal, vatAmount, total: subtotal };
  }

  return { subtotal, vatAmount: 0, total: subtotal };
}

export function calcTotalsByItems<T extends { sum: number }>(items: T[], vatMode: VatMode): InvoiceTotals {
  const subtotal = (items || []).reduce((acc, item) => {
    const sum = Number(item?.sum);
    return acc + (Number.isFinite(sum) ? sum : 0);
  }, 0);

  return calcTotalsBySubtotal(subtotal, vatMode);
}
