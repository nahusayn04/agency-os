import { inr, fmtDate } from "@/lib/cashflow/calc";
import type { CashflowItem } from "@/lib/cashflow/types";

export const DEFAULT_INVOICE_TEMPLATE = `{business}
INVOICE {invoice_no}
Date: {date}

Bill to: {customer}
Attn: {contact} · {city} · {phone}

Items
{items}

Total: {total}
Received: {paid}
Balance due: {due}

Thank you for your business.`;

export const DEFAULT_AGREEMENT_TEMPLATE = `SERVICE AGREEMENT
Between {business} and {customer} ({contact}, {city}).

1. Scope of work
{items}

2. Timeline
Work starts on {start_date} and will be completed within {days} days.

3. Payment
Total fee: {total}. {terms}

4. General
Any change in scope must be agreed in writing by both sides.

Signed: ______________      ______________
{business}      {customer}`;

export const DEFAULT_REMINDER_MESSAGE =
  "Hello {name}, this is a reminder that {amount} is pending. Please let us know when we can expect the payment. Thank you.";

export function fillTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    values[key] !== undefined ? values[key] : `{${key}}`
  );
}

export function itemLines(items: CashflowItem[]) {
  return items
    .map(
      (i, n) =>
        `${n + 1}. ${i.product} — ${i.qty} × ${inr(i.rate)} = ${inr(i.qty * i.rate)}`
    )
    .join("\n");
}

export type DocContext = {
  template: string;
  business: string;
  customer: { name: string; contact_person: string | null; city: string | null; phone: string | null };
  deal: { items: CashflowItem[]; total: number; paid: number; left: number } | null;
  invoiceNo: string;
  date: string;
  startDate: string;
  days: string;
  terms: string;
};

export function buildDocText(c: DocContext) {
  return fillTemplate(c.template, {
    business: c.business,
    customer: c.customer.name,
    contact: c.customer.contact_person ?? "",
    city: c.customer.city ?? "",
    phone: c.customer.phone ?? "",
    invoice_no: c.invoiceNo,
    date: fmtDate(c.date),
    start_date: fmtDate(c.startDate),
    days: c.days,
    terms: c.terms,
    items: c.deal ? itemLines(c.deal.items) : "",
    total: c.deal ? inr(c.deal.total) : "",
    paid: c.deal ? inr(c.deal.paid) : "",
    due: c.deal ? inr(c.deal.left) : "",
  });
}
