"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createFlashTaskAction } from "@/lib/tasks/flash-actions";
import { Button } from "@/components/ui/button";

const DURATIONS = [2, 3, 4];

const field =
  "w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20";
const section = "space-y-4 rounded-2xl border bg-card p-5 shadow-card lg:p-6";

export function CreateFlashTaskForm({
  assignableUsers,
}: {
  assignableUsers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(2);
  const [isCustom, setIsCustom] = useState(false);
  const [customHours, setCustomHours] = useState("");

  function handleSubmit(formData: FormData) {
    const finalDuration = isCustom ? Number(customHours) : duration;
    formData.set("duration_hours", String(finalDuration));
    setError(null);
    startTransition(async () => {
      const result = await createFlashTaskAction(formData);
      if (result?.error) setError(result.error);
      else {
        router.push("/tasks");
        router.refresh();
      }
    });
  }

  const chip = (active: boolean) =>
    "rounded-full border px-4 py-2 text-sm font-medium transition-colors " +
    (active
      ? "border-primary bg-primary text-primary-foreground shadow-card"
      : "border-border bg-card text-muted-foreground hover:text-foreground");

  return (
    <form id="flash-task-form" action={handleSubmit} className="grid items-start gap-4 lg:grid-cols-2">
      <section className={section}>
        <h2 className="text-sm font-semibold">⚡ Flash task (anytime, hour-based)</h2>
        <div className="space-y-2">
          <label htmlFor="flash-title" className="text-sm font-medium">Title</label>
          <input
            id="flash-title"
            name="title"
            placeholder="Task title"
            required
            className={field + " h-11"}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="flash-desc" className="text-sm font-medium">Description</label>
          <textarea
            id="flash-desc"
            name="description"
            placeholder="Description (optional)"
            rows={3}
            className={field + " resize-none py-2"}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="flash-assignee" className="text-sm font-medium">Assign to</label>
          <select
            id="flash-assignee"
            name="assigned_to"
            required
            defaultValue=""
            className={field + " h-11"}
          >
            <option value="" disabled>
              Select user
            </option>
            {assignableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className={section}>
        <h2 className="text-sm font-semibold">Duration</h2>
        <div className="flex flex-wrap items-center gap-2">
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => {
                setIsCustom(false);
                setDuration(d);
              }}
              className={chip(!isCustom && duration === d)}
            >
              {d}h
            </button>
          ))}
          <button
            type="button"
            onClick={() => setIsCustom(true)}
            className={chip(isCustom)}
          >
            Custom
          </button>
          {isCustom && (
            <input
              type="number"
              min={1}
              max={24}
              step={0.5}
              placeholder="Hours"
              value={customHours}
              onChange={(e) => setCustomHours(e.target.value)}
              className={field + " h-10 w-24"}
            />
          )}
        </div>
      </section>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 lg:col-span-2">
          {error}
        </p>
      )}

      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] z-30 -mx-4 lg:col-span-2 border-t bg-card/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:mx-0 lg:rounded-2xl lg:border">
        <Button type="submit" disabled={pending} className="h-11 w-full">
          {pending ? "Assigning…" : "Assign flash task"}
        </Button>
      </div>
    </form>
  );
}
