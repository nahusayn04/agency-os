import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUserProfile } from "@/lib/auth/session";
import { canManageTasks } from "@/lib/tasks/permissions";
import { createTaskAction, getAssignableMembers } from "@/lib/tasks/actions";
import { CreateTaskForm } from "@/components/tasks/create-task-form";
import { CreateFlashTaskForm } from "@/components/tasks/create-flash-task-form";

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams?: { type?: string; error?: string };
}) {
  const profile = await requireUserProfile();
  if (!canManageTasks(profile.role)) redirect("/my-tasks");

  const isFlash = searchParams?.type === "flash";

  // Runs the existing create logic. On success createTaskAction already
  // redirects to /tasks; on failure we stay here and show the message.
  async function submitTask(formData: FormData) {
    "use server";
    const result = await createTaskAction(formData);
    if (result?.error) {
      redirect(`/tasks/new?error=${encodeURIComponent(result.error)}`);
    }
    redirect("/tasks");
  }

  const chip = (active: boolean) =>
    "flex-1 rounded-full border px-4 py-2 text-center text-sm font-medium transition-colors " +
    (active
      ? "border-primary bg-primary text-primary-foreground shadow-card"
      : "border-border bg-card text-muted-foreground");

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="relative flex items-center justify-center py-1">
        <Link
          href="/tasks"
          aria-label="Back to Tasks"
          className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-lg font-semibold">New Task</h1>
      </div>

      <div className="flex gap-2">
        <Link href="/tasks/new" className={chip(!isFlash)}>
          Task
        </Link>
        <Link href="/tasks/new?type=flash" className={chip(isFlash)}>
          ⚡ Flash task
        </Link>
      </div>

      {searchParams?.error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {searchParams.error}
        </p>
      )}

      {isFlash ? (
        <CreateFlashTaskForm assignableUsers={await getAssignableMembers()} />
      ) : (
        <CreateTaskForm action={submitTask} />
      )}
    </div>
  );
}
