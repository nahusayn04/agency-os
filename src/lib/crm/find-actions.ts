"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { requireUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { LEAD_TEXT_MAX_LENGTH } from "@/lib/types/crm";

export type FoundLeadInput = {
  name: string;
  phone: string;
  address: string;
  note: string;
};

export type AddFoundResult =
  | { ok: true; created: number; duplicates: number; invalid: number; warning?: string }
  | { ok: false; error: string };

const MAX_ROWS = 60;

function last10(phone: string): string {
  const d = phone.replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : d;
}

/**
 * Adds businesses found via "Find Businesses" as leads (stage "new_lead").
 * Same rules as the existing Import Leads: name + 10-digit phone required,
 * duplicates are skipped by phone number. Assigned to `assignTo` (defaults to
 * whoever is adding them).
 */
export async function addFoundLeadsAction(
  rows: FoundLeadInput[],
  assignTo?: string
): Promise<AddFoundResult> {
  const profile = await requireUserProfile();

  if (profile.role === "member") {
    return { ok: false, error: "Only admins can add leads." };
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, error: "No business selected." };
  }
  if (rows.length > MAX_ROWS) {
    return { ok: false, error: `You can add up to ${MAX_ROWS} at a time.` };
  }

  const supabase = createClient();

  // Who may receive the lead: any active user (same list the CRM uses).
  let assignee = profile.id;
  if (assignTo && assignTo !== profile.id) {
    const { data: target } = await supabase
      .from("users")
      .select("id")
      .eq("id", assignTo)
      .eq("is_active", true)
      .maybeSingle();
    if (!target) return { ok: false, error: "The selected user is not active." };
    assignee = target.id;
  }

  const { data: existingRows } = await supabase
    .from("leads")
    .select("phone")
    .is("deleted_at", null)
    .not("phone", "is", null)
    .limit(20000);
  const seen = new Set(
    (existingRows ?? []).map((r) => last10(String(r.phone))).filter((p) => p.length === 10)
  );

  let invalid = 0;
  let duplicates = 0;
  const toInsert: Array<{
    name: string;
    business_name: string | null;
    phone: string;
    notes: string | null;
    stage: "new_lead";
    assigned_to: string;
  }> = [];

  for (const r of rows) {
    const name = String(r?.name ?? "").trim().slice(0, LEAD_TEXT_MAX_LENGTH);
    const phone = last10(String(r?.phone ?? ""));
    const address = String(r?.address ?? "").trim().slice(0, LEAD_TEXT_MAX_LENGTH);
    const note = String(r?.note ?? "").trim().slice(0, 500);

    if (!name || phone.length !== 10) {
      invalid += 1;
      continue;
    }
    if (seen.has(phone)) {
      duplicates += 1;
      continue;
    }
    seen.add(phone);
    toInsert.push({
      name,
      business_name: address || null,
      phone,
      notes: note || null,
      stage: "new_lead",
      assigned_to: assignee,
    });
  }

  if (toInsert.length === 0) {
    return { ok: true, created: 0, duplicates, invalid };
  }

  const { data: created, error } = await supabase.from("leads").insert(toInsert).select("id");
  if (error || !created) {
    return { ok: false, error: error?.message ?? "Could not add the leads." };
  }

  const { error: auditError } = await supabase.from("lead_audit").insert(
    created.map((l) => ({
      lead_id: l.id,
      changed_by: profile.id,
      field_changed: "stage",
      old_value: null,
      new_value: "new_lead",
    }))
  );

  revalidatePath("/crm");
  revalidatePath("/dashboard/manager");
  revalidatePath("/dashboard/founder");

  return {
    ok: true,
    created: created.length,
    duplicates,
    invalid,
    warning: auditError ? "Leads were created, but their history entries could not be saved." : undefined,
  };
}
