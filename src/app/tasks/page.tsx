import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageTasks } from "@/lib/tasks/permissions";
import { PendingApprovalSection, type PendingApprovalTask } from "@/components/tasks/pending-approval-section";

export default async function TasksPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  const profile = await requireUserProfile();
  const supabase = createClient();

  const isFounder = profile.role === "super_admin";
  const adminClient = createAdminClient();
  const canManage = canManageTasks(profile.role);

  let pendingApprovalTasks: PendingApprovalTask[] = [];
  if (canManage) {
    const reviewQuery = isFounder
      ? supabase
          .from("tasks")
          .select("id, title, description, assigned_to, assigned_by, updated_at, proof_url, deadline, status, total_time_spent_seconds")
      : supabase
          .from("tasks")
          .select("id, title, description, assigned_to, assigned_by, updated_at, proof_url, deadline, status, total_time_spent_seconds")
          .eq("assigned_by", profile.id);

    const { data: reviewTasks } = await reviewQuery.order("updated_at", { ascending: false });

    const reviewIds = (reviewTasks ?? []).map((t) => t.id);
    const reviewUserIds = new Set<string>();
    (reviewTasks ?? []).forEach((t) => reviewUserIds.add(t.assigned_to));

    const { data: reviewUsers } = reviewUserIds.size
      ? await adminClient.from("users").select("id, name").in("id", Array.from(reviewUserIds))
      : { data: [] };
    const reviewUserMap = new Map((reviewUsers ?? []).map((u) => [u.id, u.name]));

    const { data: comments } = reviewIds.length
      ? await supabase
          .from("task_comments")
          .select("task_id, message, created_at")
          .in("task_id", reviewIds)
          .order("created_at", { ascending: false })
      : { data: [] };

    const latestNoteByTask = new Map<string, string>();
    (comments ?? []).forEach((c) => {
      if (!latestNoteByTask.has(c.task_id)) latestNoteByTask.set(c.task_id, c.message);
    });

    pendingApprovalTasks = (reviewTasks ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      assignedToId: t.assigned_to,
      assignedToName: reviewUserMap.get(t.assigned_to) ?? "Unknown",
      updatedAt: t.updated_at,
      deadline: t.deadline,
      timeSpentSeconds: t.total_time_spent_seconds,
      proofUrl: t.proof_url,
      note: latestNoteByTask.get(t.id) ?? null,
      isMine: t.assigned_by === profile.id,
    }));
  }

  return (
    <div className="space-y-6">
      {/* Page header: title on the left, round "+" on the right (opens the
          New Task screen). Only people who can manage tasks get the "+". */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            Tasks assigned by or to you.
          </p>
        </div>
        {canManage && (
          <Link
            href="/tasks/new"
            aria-label="New task"
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-3 text-sm font-semibold text-primary-foreground shadow-card transition-transform active:scale-95 sm:px-5"
          >
            <Plus size={20} />
            <span className="hidden sm:inline">New task</span>
          </Link>
        )}
      </div>

      {canManage && pendingApprovalTasks.length > 0 && (
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {[
            { label: "Total", value: pendingApprovalTasks.length },
            { label: "In progress", value: pendingApprovalTasks.filter((t) => t.status === "in_progress" || t.status === "paused").length },
            { label: "Waiting review", value: pendingApprovalTasks.filter((t) => t.status === "waiting_review").length },
            { label: "Completed", value: pendingApprovalTasks.filter((t) => t.status === "approved" || t.status === "completed").length },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border bg-card px-4 py-3 shadow-card lg:px-5 lg:py-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-2xl font-bold leading-tight lg:text-3xl">{s.value}</p>
            </div>
          ))}
        </section>
      )}

      {searchParams?.error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {searchParams.error}
        </p>
      )}

      {canManage && pendingApprovalTasks.length > 0 && (
        <PendingApprovalSection
          tasks={pendingApprovalTasks}
          isFounder={isFounder}
          currentUserId={profile.id}
        />
      )}

      {canManage && pendingApprovalTasks.length === 0 && (
        <div className="rounded-2xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
          No tasks yet. Tap + to create one.
        </div>
      )}

      {!canManage && (
        <div className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground shadow-card">
          Your assigned tasks are in{" "}
          <Link href="/my-tasks" className="font-medium text-primary hover:underline">
            My Tasks
          </Link>
          .
        </div>
      )}
    </div>
  );
}
