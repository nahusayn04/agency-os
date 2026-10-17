import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Kpi } from "@/lib/dashboard/overview";
import { daysAgo, todayIST } from "@/lib/cashflow/calc";
import type { CashflowMonth } from "@/lib/cashflow/types";

export type CashflowSummary = {
  totalDues: number;
  owing: number;
  received: number;
  spent: number;
  net: number;
  attention: number;
  months: CashflowMonth[];
};

// Light version of the Cashflow numbers for the founder dashboard:
// only the columns we need, expenses only for the last 6 months, all in parallel.
// Returns null if the Cashflow tables are not there yet, so the dashboard never breaks.
export async function getCashflowSummary(supabase: SupabaseClient): Promise<CashflowSummary | null> {
  const today = todayIST();
  const monthKeys = Array.from({ length: 6 }, (_, i) =>
    new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1 - (5 - i), 1)).toISOString().slice(0, 7)
  );
  const thisMonth = monthKeys[5];

  const [settings, customers, deals, payments, expenses] = await Promise.all([
    supabase.from("hisab_settings").select("alert_days").limit(1).maybeSingle(),
    supabase.from("hisab_customers").select("id, promise_amount, promise_date"),
    supabase.from("hisab_deals").select("id, customer_id, total, deal_date"),
    supabase.from("hisab_payments").select("deal_id, amount, paid_on"),
    supabase.from("hisab_expenses").select("amount, spent_on").gte("spent_on", `${monthKeys[0]}-01`),
  ]);

  if (customers.error || deals.error || payments.error || expenses.error) return null;

  const alertDays = Number(settings.data?.alert_days ?? 30);
  const dealOwner = new Map<string, string>();
  const sales = new Map<string, number>();
  const firstDeal = new Map<string, string>();
  for (const d of deals.data ?? []) {
    dealOwner.set(d.id, d.customer_id);
    sales.set(d.customer_id, (sales.get(d.customer_id) ?? 0) + Number(d.total));
    const first = firstDeal.get(d.customer_id);
    if (!first || d.deal_date < first) firstDeal.set(d.customer_id, d.deal_date);
  }

  const receivedBy = new Map<string, number>();
  const lastPaid = new Map<string, string>();
  const receivedByMonth = new Map<string, number>();
  for (const p of payments.data ?? []) {
    const cid = dealOwner.get(p.deal_id);
    if (!cid) continue;
    receivedBy.set(cid, (receivedBy.get(cid) ?? 0) + Number(p.amount));
    if (!lastPaid.get(cid) || p.paid_on > (lastPaid.get(cid) as string)) lastPaid.set(cid, p.paid_on);
    const key = (p.paid_on as string).slice(0, 7);
    receivedByMonth.set(key, (receivedByMonth.get(key) ?? 0) + Number(p.amount));
  }

  const spentByMonth = new Map<string, number>();
  for (const e of expenses.data ?? []) {
    const key = (e.spent_on as string).slice(0, 7);
    spentByMonth.set(key, (spentByMonth.get(key) ?? 0) + Number(e.amount));
  }

  let totalDues = 0;
  let owing = 0;
  let attention = 0;
  for (const c of customers.data ?? []) {
    const dues = (sales.get(c.id) ?? 0) - (receivedBy.get(c.id) ?? 0);
    if (dues <= 0) continue;
    totalDues += dues;
    owing++;
    const missedPromise = !!c.promise_date && !!c.promise_amount && daysAgo(c.promise_date) > 0;
    const idleFrom = lastPaid.get(c.id) ?? firstDeal.get(c.id);
    if (missedPromise || (idleFrom && daysAgo(idleFrom) >= alertDays)) attention++;
  }

  const received = receivedByMonth.get(thisMonth) ?? 0;
  const spent = spentByMonth.get(thisMonth) ?? 0;
  return {
    totalDues,
    owing,
    received,
    spent,
    net: received - spent,
    attention,
    months: monthKeys.map((k) => ({
      label: new Date(k + "-01T00:00:00Z").toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
      received: receivedByMonth.get(k) ?? 0,
      spent: spentByMonth.get(k) ?? 0,
    })),
  };
}

// Tiles for the dashboard KPI column, same shape as the CRM tiles
export function buildCashflowKpis(s: CashflowSummary): Kpi[] {
  return [
    {
      label: "Outstanding",
      value: s.totalDues,
      prefix: "₹",
      tone: s.totalDues > 0 ? "red" : "green",
      hint: `${s.owing} ${s.owing === 1 ? "customer" : "customers"}`,
      href: "/cashflow/customers",
    },
    { label: "Received This Month", value: s.received, prefix: "₹", tone: "green", href: "/cashflow/history" },
    { label: "Expenses This Month", value: s.spent, prefix: "₹", tone: "amber", href: "/cashflow/history?tab=expenses" },
    {
      label: "Net Cashflow",
      value: Math.abs(s.net),
      prefix: s.net < 0 ? "−₹" : "₹",
      tone: s.net < 0 ? "red" : "green",
      href: "/cashflow/history?tab=expenses",
    },
    {
      label: "Needs Attention",
      value: s.attention,
      tone: s.attention > 0 ? "amber" : "green",
      hint: s.attention > 0 ? "Follow up" : "All clear",
      href: "/cashflow",
    },
  ];
}
