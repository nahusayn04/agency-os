export type DocKind = "agreement" | "invoice" | "proof";

export type CashflowItem = { product: string; qty: number; rate: number };
export type CashflowProduct = { name: string; rate: number };

export type CashflowSettings = {
  id: string;
  business_name: string;
  alert_days: number;
  reminder_message: string;
  products: CashflowProduct[];
  categories: string[];
  invoice_template: string;
  agreement_template: string;
  next_invoice_no: number;
};

export type CashflowCustomer = {
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

export type CashflowDeal = {
  id: string;
  customer_id: string;
  deal_date: string;
  items: CashflowItem[];
  total: number;
  note: string | null;
};

export type CashflowPayment = {
  id: string;
  deal_id: string;
  amount: number;
  paid_on: string;
  note: string | null;
};

export type CashflowExpense = {
  id: string;
  category: string;
  amount: number;
  description: string | null;
  spent_on: string;
};

export type CashflowDoc = {
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

export type CashflowMonth = { label: string; received: number; spent: number };
