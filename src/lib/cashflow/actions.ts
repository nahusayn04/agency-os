"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, DocKind, CashflowItem, CashflowProduct } from "@/lib/cashflow/types";

async function ctx() {
  const profile = await requireRole("super_admin");
  return { profile, supabase: createClient() };
}

const refresh = () => revalidatePath("/cashflow", "layout");
const ok = <T = null>(data: T = null as T): ActionResult<T> => ({ ok: true, data });
const fail = (message: string): ActionResult<never> => ({ ok: false, error: message });

const money = (v: unknown) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");

// ---------- customers ----------
export async function createCustomerAction(input: {
  name: string;
  contact_person?: string;
  phone?: string;
  city?: string;
  business?: string;
}): Promise<ActionResult<{ id: string }>> {
  const { profile, supabase } = await ctx();
  const name = clean(input.name);
  if (!name) return fail("Business name is required");
  const { data, error } = await supabase
    .from("hisab_customers")
    .insert({
      name,
      contact_person: clean(input.contact_person) || null,
      phone: clean(input.phone) || null,
      city: clean(input.city) || null,
      business: clean(input.business) || null,
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (error) return fail(error.message);
  refresh();
  return ok({ id: data.id as string });
}

export async function updateCustomerAction(
  id: string,
  input: { name: string; contact_person?: string; phone?: string; city?: string; business?: string }
): Promise<ActionResult> {
  const { supabase } = await ctx();
  const name = clean(input.name);
  if (!name) return fail("Business name is required");
  const { error } = await supabase
    .from("hisab_customers")
    .update({
      name,
      contact_person: clean(input.contact_person) || null,
      phone: clean(input.phone) || null,
      city: clean(input.city) || null,
      business: clean(input.business) || null,
    })
    .eq("id", id);
  if (error) return fail(error.message);
  refresh();
  return ok();
}

export async function saveNotesAction(id: string, notes: string): Promise<ActionResult> {
  const { supabase } = await ctx();
  const { error } = await supabase.from("hisab_customers").update({ notes }).eq("id", id);
  if (error) return fail(error.message);
  refresh();
  return ok();
}

export async function setPromiseAction(
  id: string,
  promise: { amount: number; date: string } | null
): Promise<ActionResult> {
  const { supabase } = await ctx();
  if (promise && (!money(promise.amount) || !/^\d{4}-\d{2}-\d{2}$/.test(promise.date))) {
    return fail("Enter an amount and a date");
  }
  const { error } = await supabase
    .from("hisab_customers")
    .update({
      promise_amount: promise ? money(promise.amount) : null,
      promise_date: promise ? promise.date : null,
    })
    .eq("id", id);
  if (error) return fail(error.message);
  refresh();
  return ok();
}

export async function markReminderAction(id: string): Promise<ActionResult> {
  const { supabase } = await ctx();
  const { error } = await supabase
    .from("hisab_customers")
    .update({ last_reminder_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return fail(error.message);
  refresh();
  return ok();
}

// ---------- deals, payments, expenses ----------
export async function createDealAction(input: {
  customerId: string;
  items: CashflowItem[];
  note?: string;
  advance?: number;
}): Promise<ActionResult> {
  const { profile, supabase } = await ctx();
  const items = (input.items ?? [])
    .map((i) => ({
      product: clean(i.product),
      qty: Math.max(1, Math.round(Number(i.qty) || 1)),
      rate: money(i.rate),
    }))
    .filter((i) => i.product && i.rate > 0);
  if (!input.customerId) return fail("Choose a customer");
  if (items.length === 0) return fail("Add at least one product with a rate");
  const total = items.reduce((a, i) => a + i.qty * i.rate, 0);

  const { data: deal, error } = await supabase
    .from("hisab_deals")
    .insert({
      customer_id: input.customerId,
      items,
      total,
      note: clean(input.note) || null,
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (error) return fail(error.message);

  const advance = Math.min(money(input.advance), total);
  if (advance > 0) {
    const { error: payError } = await supabase.from("hisab_payments").insert({
      deal_id: deal.id,
      amount: advance,
      note: "Advance",
      created_by: profile.id,
    });
    if (payError) return fail("Deal saved, but the advance failed: " + payError.message);
  }
  refresh();
  return ok();
}

export async function createPaymentAction(input: {
  dealId: string;
  amount: number;
  note?: string;
}): Promise<ActionResult> {
  const { profile, supabase } = await ctx();
  const amount = money(input.amount);
  if (!input.dealId) return fail("Choose which deal this payment is for");
  if (!amount) return fail("Enter an amount");
  const { error } = await supabase.from("hisab_payments").insert({
    deal_id: input.dealId,
    amount,
    note: clean(input.note) || null,
    created_by: profile.id,
  });
  if (error) return fail(error.message);
  refresh();
  return ok();
}

export async function createExpenseAction(input: {
  category: string;
  amount: number;
  description?: string;
}): Promise<ActionResult> {
  const { profile, supabase } = await ctx();
  const amount = money(input.amount);
  const category = clean(input.category);
  if (!category) return fail("Choose a category");
  if (!amount) return fail("Enter an amount");
  const { error } = await supabase.from("hisab_expenses").insert({
    category,
    amount,
    description: clean(input.description) || category,
    created_by: profile.id,
  });
  if (error) return fail(error.message);
  refresh();
  return ok();
}

// ---------- documents ----------
export async function saveDocumentAction(input: {
  customerId: string;
  kind: Exclude<DocKind, "proof">;
  dealId: string | null;
  docNumber: string | null;
  content: string;
}): Promise<ActionResult> {
  const { profile, supabase } = await ctx();
  if (!clean(input.content)) return fail("The document is empty");
  const { error } = await supabase.from("hisab_documents").insert({
    customer_id: input.customerId,
    kind: input.kind,
    source: "made",
    deal_id: input.dealId,
    doc_number: input.docNumber,
    content: input.content,
    created_by: profile.id,
  });
  if (error) return fail(error.message);

  if (input.kind === "invoice") {
    const { data: s } = await supabase
      .from("hisab_settings")
      .select("id, next_invoice_no")
      .limit(1)
      .maybeSingle();
    if (s) {
      await supabase
        .from("hisab_settings")
        .update({ next_invoice_no: Number(s.next_invoice_no) + 1 })
        .eq("id", s.id);
    }
  }
  refresh();
  return ok();
}

export async function updateDocumentAction(docId: string, content: string): Promise<ActionResult> {
  const { supabase } = await ctx();
  if (!clean(content)) return fail("The document is empty");
  const { error } = await supabase.from("hisab_documents").update({ content }).eq("id", docId);
  if (error) return fail(error.message);
  refresh();
  return ok();
}

export async function recordUploadAction(input: {
  customerId: string;
  kind: DocKind;
  filePath: string;
  fileName: string;
}): Promise<ActionResult> {
  const { profile, supabase } = await ctx();
  const { error } = await supabase.from("hisab_documents").insert({
    customer_id: input.customerId,
    kind: input.kind,
    source: "pdf",
    file_path: input.filePath,
    file_name: input.fileName,
    created_by: profile.id,
  });
  if (error) return fail(error.message);
  refresh();
  return ok();
}

export async function getDocumentUrlAction(filePath: string): Promise<ActionResult<string>> {
  const { supabase } = await ctx();
  const { data, error } = await supabase.storage
    .from("hisab-docs")
    .createSignedUrl(filePath, 300);
  if (error || !data) return fail(error?.message ?? "Could not open the file");
  return ok(data.signedUrl);
}

// ---------- settings ----------
export async function saveSettingsAction(input: {
  business_name: string;
  alert_days: number;
  reminder_message: string;
  products: CashflowProduct[];
  categories: string[];
  invoice_template: string;
  agreement_template: string;
}): Promise<ActionResult> {
  const { supabase } = await ctx();
  if (![15, 30, 45, 60].includes(input.alert_days)) return fail("Choose 15, 30, 45 or 60 days");
  const products = (input.products ?? [])
    .map((p) => ({ name: clean(p.name), rate: money(p.rate) }))
    .filter((p) => p.name);
  const categories = Array.from(new Set((input.categories ?? []).map(clean).filter(Boolean)));
  if (!clean(input.business_name)) return fail("Business name is required");
  if (!clean(input.reminder_message)) return fail("Reminder message cannot be empty");

  const { data: s } = await supabase.from("hisab_settings").select("id").limit(1).maybeSingle();
  if (!s) return fail("Settings not found. Reload the page and try again.");
  const { error } = await supabase
    .from("hisab_settings")
    .update({
      business_name: clean(input.business_name),
      alert_days: input.alert_days,
      reminder_message: input.reminder_message,
      products,
      categories,
      invoice_template: input.invoice_template,
      agreement_template: input.agreement_template,
      updated_at: new Date().toISOString(),
    })
    .eq("id", s.id);
  if (error) return fail(error.message);
  refresh();
  return ok();
}
