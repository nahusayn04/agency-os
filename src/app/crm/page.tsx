import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { KanbanBoard } from "@/components/crm/kanban-board";
import { getAssignableUsers } from "@/lib/crm/actions";
import { LEAD_STAGES } from "@/lib/types/crm";

export default async function CrmPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  const profile = await requireUserProfile();
  const supabase = createClient();

  const { data: leads, error } = await supabase
    .from("leads")
    .select(
     "id, name, business_name, phone, deal_value, stage, assigned_to, last_contact, next_followup, meeting_datetime, meeting_note, meeting_history, notes, is_hot_lead"
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <p className="text-destructive">Failed to load leads: {error.message}</p>
    );
  }

  const assigneeIds = Array.from(
    new Set((leads ?? []).map((l) => l.assigned_to))
  );
  const { data: users } = await supabase
    .from("users")
    .select("id, name")
    .in("id", assigneeIds.length ? assigneeIds : ["00000000-0000-0000-0000-000000000000"]);

  const userMap = new Map((users ?? []).map((u) => [u.id, u.name]));
  const assignableUsers = await getAssignableUsers();

  const kanbanLeads = (leads ?? []).map((lead) => ({
    id: lead.id,
    name: lead.name,
    business_name: lead.business_name,
    phone: lead.phone,
    deal_value: lead.deal_value,
    stage: lead.stage,
    last_contact: lead.last_contact,
    next_followup: lead.next_followup,
    meeting_datetime: lead.meeting_datetime,
   meeting_note: lead.meeting_note,
    meeting_history: lead.meeting_history ?? [],
    notes: lead.notes,
    is_hot_lead: lead.is_hot_lead ?? false,
    assignee: {
      id: lead.assigned_to,
      name: userMap.get(lead.assigned_to) ?? "Unknown",
    },
  }));

  return (
    <div className="space-y-4">
      {/* Page header: title on the left, round "+" on the right (opens the
          Add Lead screen). Members can't create leads, so no "+" for them. */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">CRM</h1>
          <p className="text-sm text-muted-foreground">
            {profile.role === "member"
              ? "Your leads pipeline"
              : "Team leads pipeline"}
          </p>
        </div>
        {profile.role !== "member" && (
          <Link
            href="/crm/new"
            aria-label="Add lead"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-card transition-transform active:scale-95"
          >
            <Plus size={22} />
          </Link>
        )}
      </div>

      {searchParams?.error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {searchParams.error}
        </p>
      )}

      <KanbanBoard
        leads={kanbanLeads}
        stages={LEAD_STAGES}
        assignableUsers={assignableUsers}
        canReassign={profile.role !== "member"}
        currentUserId={profile.id}
      />
    </div>
  );
}
