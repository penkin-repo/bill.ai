export type VatMode = 'none' | 'included' | 'on_top';

export type EditableItem = {
  product_id: string;
  name: string;
  unit: string;
  quantity: number;
  price: number;
  sum: number;
};

export type InvoiceEditDraft = {
  id: string;
  number: string;
  date: string;
  company_id: string;
  client_id: string;
  comment: string;
  vat_mode: VatMode;
  vat_rate: number;
  subtotal: number;
  vat_amount: number;
  total: number;
  total_words: string;
  items_json: string;
  items: EditableItem[];
  created_at: string;
  updated_at: string;
};
