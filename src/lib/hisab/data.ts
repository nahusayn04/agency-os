import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { buildLedger } from "@/lib/hisab/calc";
import {
  DEFAULT_AGREEMENT_TEMPLATE,
  DEFAULT_INVOICE_TEMPLATE,
  DEFAULT_REMINDER_MESSAGE,
} from "@/lib/hisab/templates";
import type {
  HisabCustomer,
  HisabDeal,
  HisabDoc,
  HisabExpense,
  HisabPayment,
  HisabSettings,
} from "@/lib/hisab/types";

const DEFAULT_PRODUCTS = [
  { name: "Website", rate: 30000 },
  { name: "SEO", rate: 25000 },
  { name: "Social media", rate: 15000 },
  { name: "Google Ads", rate: 15000 },
  { name: "Logo & branding", rate: 30000 },
  { name: "Maintenance", rate: 10000 },
];
const DEFAULT_CATEGORIES = ["Marketing", "Assets", "Salaries", "Tools", "Rent", "Travel", "Other"];

const num = (v: unknown) => Number(v ?? 0);

// cache() = layout and pages in the same request share one fetch
export const getHisabData = cache(async () => {
  const supabase = createClient();

  const readSettings = () =>
    supabase.from("hisab_settings").select("*").limit(1).maybeSingle();

  let { data: s } = await readSettings();
  if (!s) {
    const ins = await supabase
      .from("hisab_settings")
      .insert({
        reminder_message: DEFAULT_REMINDER_MESSAGE,
        products: DEFAULT_PRODUCTS,
        categories: DEFAULT_CATEGORIES,
        invoice_template: DEFAULT_INVOICE_TEMPLATE,
        agreement_template: DEFAULT_AGREEMENT_TEMPLATE,
      })
      .select("*")
      .single();
    s = ins.data ?? (await readSettings()).data;
  }
  if (!s) throw new Error("Could not load Business Hisab settings");

  const [customersRes, dealsRes, paymentsRes, expensesRes, docsRes] = await Promise.all([
    supabase.from("hisab_customers").select("*").order("name"),
    supabase.from("hisab_deals").select("*"),
    supabase.from("hisab_payments").select("*"),
    supabase.from("hisab_expenses").select("*").order("spent_on", { ascending: false }),
    supabase.from("hisab_documents").select("*").order("created_at", { ascending: false }),
  ]);

  const firstError =
    customersRes.error ?? dealsRes.error ?? paymentsRes.error ?? expensesRes.error ?? docsRes.error;
  if (firstError) throw new Error(firstError.message);

  const settings: HisabSettings = {
    ...s,
    products: (s.products ?? []) as HisabSettings["products"],
    categories: (s.categories ?? []) as string[],
  };
  const customers = (customersRes.data ?? []).map((c) => ({
    ...c,
    promise_amount: c.promise_amount == null ? null : num(c.promise_amount),
  })) as HisabCustomer[];
  const deals = (dealsRes.data ?? []).map((d) => ({
    ...d,
    total: num(d.total),
  })) as HisabDeal[];
  const payments = (paymentsRes.data ?? []).map((p) => ({
    ...p,
    amount: num(p.amount),
  })) as HisabPayment[];
  const expenses = (expensesRes.data ?? []).map((e) => ({
    ...e,
    amount: num(e.amount),
  })) as HisabExpense[];
  const docs = (docsRes.data ?? []) as HisabDoc[];

  return {
    settings,
    customers,
    deals,
    payments,
    expenses,
    docs,
    rows: buildLedger(customers, deals, payments, docs),
  };
});
