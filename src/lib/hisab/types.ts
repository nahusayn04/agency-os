export type DocKind = "agreement" | "invoice" | "proof";

export type HisabItem = { product: string; qty: number; rate: number };
export type HisabProduct = { name: string; rate: number };

export type HisabSettings = {
  id: string;
  business_name: string;
  alert_days: number;
  reminder_message: string;
  products: HisabProduct[];
  categories: string[];
  invoice_template: string;
  agreement_template: string;
  next_invoice_no: number;
};

export type HisabCustomer = {
  id: string;
  name: string;
  business: string | null;
  contact_person: string | null;
  phone: string | null;
  city: string | null;
  notes: string;
  promise_amount: number | null;
  promise_date: string | null;
  last_reminder_at: string | null;
  created_at: string;
};

export type HisabDeal = {
  id: string;
  customer_id: string;
  deal_date: string;
  items: HisabItem[];
  total: number;
  note: string | null;
};

export type HisabPayment = {
  id: string;
  deal_id: string;
  amount: number;
  paid_on: string;
  note: string | null;
};

export type HisabExpense = {
  id: string;
  category: string;
  amount: number;
  description: string | null;
  spent_on: string;
};

export type HisabDoc = {
  id: string;
  customer_id: string;
  kind: DocKind;
  source: "made" | "pdf";
  deal_id: string | null;
  doc_number: string | null;
  content: string | null;
  file_path: string | null;
  file_name: string | null;
  created_at: string;
};

export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string };
