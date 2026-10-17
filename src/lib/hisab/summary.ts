import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { daysAgo, todayIST } from "@/lib/hisab/calc";

export type HisabSummary = {
  monthLabel: string;
  totalDues: number;
  owing: number;
  received: number;
  spent: number;
  net: number;
  top: { id: string; name: string; dues: number }[];
  attention: number;
  hasCustomers: boolean;
};

// Light version of the Hisab numbers for the founder dashboard:
// only the columns we need, expenses only for this month, all in parallel.
// Returns null if the Hisab tables are not there yet, so the dashboard never breaks.
export async function getHisabSummary(supabase: SupabaseClient): Promise<HisabSummary | null> {
  const today = todayIST();
  const monthStart = `${today.slice(0, 7)}-01`;

  const [settings, customers, deals, payments, expenses] = await Promise.all([
    supabase.from("hisab_settings").select("alert_days").limit(1).maybeSingle(),
    supabase.from("hisab_customers").select("id, name, promise_amount, promise_date"),
    supabase.from("hisab_deals").select("id, customer_id, total, deal_date"),
    supabase.from("hisab_payments").select("deal_id, amount, paid_on"),
    supabase.from("hisab_expenses").select("amount").gte("spent_on", monthStart),
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

  const received = new Map<string, number>();
  const lastPaid = new Map<string, string>();
  let receivedThisMonth = 0;
  for (const p of payments.data ?? []) {
    const cid = dealOwner.get(p.deal_id);
    if (!cid) continue;
    received.set(cid, (received.get(cid) ?? 0) + Number(p.amount));
    if (!lastPaid.get(cid) || p.paid_on > (lastPaid.get(cid) as string)) lastPaid.set(cid, p.paid_on);
    if (p.paid_on >= monthStart) receivedThisMonth += Number(p.amount);
  }

  const owing: { id: string; name: string; dues: number }[] = [];
  let attention = 0;
  for (const c of customers.data ?? []) {
    const dues = (sales.get(c.id) ?? 0) - (received.get(c.id) ?? 0);
    if (dues <= 0) continue;
    owing.push({ id: c.id, name: c.name, dues });
    const missedPromise = !!c.promise_date && !!c.promise_amount && daysAgo(c.promise_date) > 0;
    const idleFrom = lastPaid.get(c.id) ?? firstDeal.get(c.id);
    if (missedPromise || (idleFrom && daysAgo(idleFrom) >= alertDays)) attention++;
  }
  owing.sort((a, b) => b.dues - a.dues);

  const spent = (expenses.data ?? []).reduce((a, e) => a + Number(e.amount), 0);
  return {
    monthLabel: new Date(monthStart + "T00:00:00Z").toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
    totalDues: owing.reduce((a, c) => a + c.dues, 0),
    owing: owing.length,
    received: receivedThisMonth,
    spent,
    net: receivedThisMonth - spent,
    top: owing.slice(0, 3),
    attention,
    hasCustomers: (customers.data ?? []).length > 0,
  };
}
