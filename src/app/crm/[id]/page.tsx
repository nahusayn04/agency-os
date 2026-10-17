import Link from "next/link";
import { CallLink } from "@/components/crm/call-link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getAssignableUsers } from "@/lib/crm/actions";
import { LeadEditForm } from "@/components/crm/lead-edit-form";
import { LEAD_STAGE_LABELS, type LeadStage } from "@/lib/types/crm";
import { formatDate } from "@/lib/utils";

interface LeadDetailPageProps {
  params: { id: string };
}

export default async function LeadDetailPage({ params }: LeadDetailPageProps) {
  const profile = await requireUserProfile();
  const supabase = createClient();

  const { data: lead, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !lead || lead.deleted_at) {
    notFound();
  }

  const { data: audit } = await supabase
    .from("lead_audit")
    .select("id, field_changed, old_value, new_value, changed_at, changed_by")
    .eq("lead_id", params.id)
    .order("changed_at", { ascending: false });

  const changerIds = Array.from(
    new Set((audit ?? []).map((a) => a.changed_by))
  );
  const { data: changers } = await supabase
    .from("users")
    .select("id, name")
    .in(
      "id",
      changerIds.length ? changerIds : ["00000000-0000-0000-0000-000000000000"]
    );

  const changerMap = new Map((changers ?? []).map((u) => [u.id, u.name]));
  const assignees = profile.role === "member" ? [] : await getAssignableUsers();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="relative flex items-center justify-center py-1">
        <Link
          href="/crm"
          aria-label="Back to CRM"
          className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-lg font-semibold">Lead</h1>
      </div>

      {/* Profile block */}
      <div className="rounded-2xl border bg-card p-4 text-center shadow-card">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent text-2xl font-bold text-primary">
          {(lead.name || "?").charAt(0).toUpperCase()}
        </div>
        <h2 className="mt-2 text-lg font-semibold">{lead.name}</h2>
        {lead.business_name && (
          <p className="text-sm text-muted-foreground">{lead.business_name}</p>
        )}
        <span className="mt-2 inline-block rounded-full bg-accent px-3 py-0.5 text-xs font-medium text-primary">
          {LEAD_STAGE_LABELS[lead.stage as LeadStage]}
        </span>
        {lead.phone && (
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-semibold">
            <CallLink
              leadId={lead.id}
              name={lead.name}
              phone={lead.phone}
              className="rounded-xl bg-accent py-2 text-primary"
            >
              Call
            </CallLink>
            <a
              href={"https://wa.me/" + (lead.phone.replace(/\D/g, "").length === 10 ? "91" : "") + lead.phone.replace(/\D/g, "")}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-green-50 py-2 text-green-700"
            >
              WhatsApp
            </a>
          </div>
        )}
      </div>

      <section className="rounded-2xl border bg-card p-4 shadow-card">
        <h2 className="mb-4 text-sm font-semibold">Lead details</h2>
        <LeadEditForm
          lead={lead}
          assignedTo={lead.assigned_to}
          canAssign={profile.role !== "member"}
          assignees={assignees.map((u) => ({ id: u.id, name: u.name }))}
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">History</h2>
        <ol className="space-y-2 border-l-2 border-accent pl-4">
          {(audit ?? []).length === 0 ? (
            <li className="text-sm text-muted-foreground">No changes recorded.</li>
          ) : (
            (audit ?? []).map((entry) => (
              <li key={entry.id} className="rounded-xl border bg-card p-3 text-sm shadow-card">
                <p className="font-medium">
                  {changerMap.get(entry.changed_by) ?? "Unknown"} changed{" "}
                  <span className="font-mono">{entry.field_changed}</span>
                </p>
                <p className="text-muted-foreground">
                  {entry.old_value ?? "—"} → {entry.new_value ?? "—"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDate(entry.changed_at)}
                </p>
              </li>
            ))
          )}
        </ol>
      </section>
    </div>
  );
}
