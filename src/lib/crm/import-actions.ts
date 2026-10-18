"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { requireUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { LEAD_TEXT_MAX_LENGTH } from "@/lib/types/crm";

export type ImportRow = { name: string; phone: string; address: string };

export type ImportResult =
  | { ok: true; created: number; duplicates: number; invalid: number; warning?: string }
  | { ok: false; error: string };

const MAX_ROWS = 200;

function last10(phone: string): string {
  const d = phone.replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : d;
}

async function loadExistingPhones(supabase: ReturnType<typeof createClient>) {
  const { data } = await supabase
    .from("leads")
    .select("phone")
    .is("deleted_at", null)
    .not("phone", "is", null)
    .limit(20000);
  return new Set(
    (data ?? []).map((r) => last10(String(r.phone))).filter((p) => p.length === 10)
  );
}

/** Which of these phone numbers already exist as leads (compared on the last 10 digits). */
export async function findExistingPhonesAction(phones: string[]): Promise<string[]> {
  const profile = await requireUserProfile();
  if (profile.role === "member" || !Array.isArray(phones)) return [];

  const existing = await loadExistingPhones(createClient());
  return Array.from(new Set(phones.map(last10))).filter((p) => existing.has(p));
}

/** Bulk-create leads (stage "new_lead", assigned to the importing admin). */
export async function importLeadsAction(rows: ImportRow[]): Promise<ImportResult> {
  const profile = await requireUserProfile();

  if (profile.role === "member") {
    return { ok: false, error: "Only admins can import leads." };
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, error: "No leads selected." };
  }
  if (rows.length > MAX_ROWS) {
    return { ok: false, error: `You can import up to ${MAX_ROWS} leads at a time.` };
  }

  const supabase = createClient();
  const seen = await loadExistingPhones(supabase);

  let invalid = 0;
  let duplicates = 0;
  const toInsert: Array<{
    name: string;
    business_name: string | null;
    phone: string;
    stage: "new_lead";
    assigned_to: string;
  }> = [];

  for (const r of rows) {
    const name = String(r?.name ?? "").trim().slice(0, LEAD_TEXT_MAX_LENGTH);
    const phone = last10(String(r?.phone ?? ""));
    const address = String(r?.address ?? "").trim().slice(0, LEAD_TEXT_MAX_LENGTH);

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
      stage: "new_lead",
      assigned_to: profile.id,
    });
  }

  if (toInsert.length === 0) {
    return { ok: true, created: 0, duplicates, invalid };
  }

  const { data: created, error } = await supabase.from("leads").insert(toInsert).select("id");

  if (error || !created) {
    return { ok: false, error: error?.message ?? "Failed to import leads." };
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
