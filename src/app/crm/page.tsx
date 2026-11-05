import { requireUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { KanbanBoard } from "@/components/crm/kanban-board";
import { NewLeadDialog } from "@/components/crm/crm-dialogs";
import { CrmFilterButton, CrmFiltersProvider } from "@/components/crm/crm-filters";
import { getAssignableUsers } from "@/lib/crm/actions";
import { LEAD_STAGES } from "@/lib/types/crm";

export default async function CrmPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  const profile = await requireUserProfile();
  const supabase = createClient();

  const BASE_COLUMNS =
    "id, name, business_name, phone, deal_value, stage, assigned_to, last_contact, next_followup, meeting_datetime, meeting_note, meeting_history, notes, is_hot_lead";
  const RESEARCH_COLUMNS = ", online_presence, competitors, checklist, category";

  type LeadRow = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  let leads: LeadRow[] | null = null;
  let error: { message: string; code?: string } | null = null;

  {
    const res = await supabase
      .from("leads")
      .select(BASE_COLUMNS + RESEARCH_COLUMNS)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    leads = res.data as unknown as LeadRow[] | null;
    error = res.error;
  }

  // Migration 029 not applied yet (columns missing): fall back so the CRM
  // keeps working; the research panel just starts empty until it's run.
  if (error && error.code === "42703") {
    const res = await supabase
      .from("leads")
      .select(BASE_COLUMNS)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    leads = res.data as unknown as LeadRow[] | null;
    error = res.error;
  }

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
    online_presence: lead.online_presence ?? null,
    competitors: lead.competitors ?? null,
    checklist: lead.checklist ?? null,
    category: lead.category ?? null,
    assignee: {
      id: lead.assigned_to,
      name: userMap.get(lead.assigned_to) ?? "Unknown",
    },
  }));

  return (
    <CrmFiltersProvider>
    <div className="space-y-4">
      {/* Page header: title on the left, "+ New Lead" on the right (opens a
          popup). Members can't create leads, so no button for them. */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">CRM</h1>
          <p className="text-sm text-muted-foreground">
            {profile.role === "member"
              ? "Your leads pipeline"
              : "Team leads pipeline"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CrmFilterButton
            assignees={assignableUsers.map((u) => ({ id: u.id, name: u.name }))}
            canFilterAssignee={profile.role !== "member"}
          />
          {profile.role !== "member" && (
            <NewLeadDialog
              users={assignableUsers.map((u) => ({ id: u.id, name: u.name }))}
              currentUserId={profile.id}
            />
          )}
        </div>
      </div>

      {searchParams?.error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
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
    </CrmFiltersProvider>
  );
}
