import { requireUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import TaskCard from "@/components/tasks/task-card";
import { TaskTabs } from "@/components/tasks/task-tabs";

type TaskRow = {
  id: string;
  title: string;
  description?: string | null;
  priority: string;
  estimated_hours?: number | null;
  deadline?: string | null;
  assigned_by: string;
  assigned_to: string;
  status: string;
  proof_url?: string | null;
  created_at: string;
  total_time_spent_seconds?: number | null;
  session_start_time?: string | null;
  is_mandatory?: boolean;
  mandatory_type?: string | null;
  mandatory_target_count?: number | null;
  mandatory_actual_count?: number | null;
};

export default async function MyTasksPage() {
  const profile = await requireUserProfile();
  const supabase = createClient();

  const { data: tasks } = await supabase
    .from("tasks")
    .select(
      "id, title, description, priority, estimated_hours, deadline, assigned_by, assigned_to, status, proof_url, created_at, total_time_spent_seconds, session_start_time, is_mandatory, mandatory_type, mandatory_target_count, mandatory_actual_count"
    )
    .eq("assigned_to", profile.id)
    .order("created_at", { ascending: false });

  const rows = (tasks ?? []) as TaskRow[];
  const userIds = new Set<string>([profile.id as string]);
  for (const t of rows) userIds.add(t.assigned_by);

  type UserInfo = { id: string; name: string; role: string };
  const { data: users } = await supabase.from("users").select("id, name, role").in("id", Array.from(userIds));
  const userMap = new Map((users ?? []).map((u: UserInfo) => [u.id, u]));

  const activeTasks = rows.filter(
    (task) =>
      task.status === "in_progress" ||
      task.status === "revision_required" ||
      task.status === "paused"
  );
  const pendingTasks = rows.filter((task) => task.status === "pending");
  const reviewTasks = rows.filter((task) => task.status === "waiting_review");
  const doneTasks = rows.filter((task) =>
    task.status === "approved" || task.status === "completed"
  );

  const list = (items: TaskRow[]) => (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((t) => (
        <TaskCard
          key={t.id}
          task={t}
          assignerName={userMap.get(t.assigned_by)?.name}
          assignerRole={userMap.get(t.assigned_by)?.role}
        />
      ))}
    </div>
  );

  const groups = [
    { label: "Active", items: activeTasks },
    { label: "Pending", items: pendingTasks },
    { label: "In Review", items: reviewTasks },
    { label: "Done", items: doneTasks },
  ];

  const allContent = (
    <div className="space-y-6">
      {groups
        .filter((g) => g.items.length > 0)
        .map((g) => (
          <section key={g.label} className="space-y-3">
            <h2 className="text-sm font-semibold">{g.label}</h2>
            {list(g.items)}
          </section>
        ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Tasks</h1>
        <p className="text-sm text-muted-foreground">
          Tasks assigned to you for execution and submission.
        </p>
      </div>

      <TaskTabs
        tabs={[
          { key: "all", label: "All", count: rows.length, content: allContent },
          { key: "active", label: "Active", count: activeTasks.length, content: list(activeTasks) },
          { key: "pending", label: "Pending", count: pendingTasks.length, content: list(pendingTasks) },
          { key: "review", label: "In Review", count: reviewTasks.length, content: list(reviewTasks) },
          { key: "done", label: "Done", count: doneTasks.length, content: list(doneTasks) },
        ]}
      />
    </div>
  );
}
