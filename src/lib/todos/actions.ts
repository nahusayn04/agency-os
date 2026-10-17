"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { requireUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

type Result = { error?: string };

function refresh() {
  revalidatePath("/dashboard", "layout");
}

export async function createTodoAction(formData: FormData): Promise<Result> {
  const profile = await requireUserProfile();

  const title = String(formData.get("title") ?? "").trim();
  const due = String(formData.get("due") ?? "").trim(); // datetime-local, entered in IST

  if (!title) return { error: "Please enter a title." };
  if (title.length > 200) return { error: "Title is too long (max 200 characters)." };

  if (!due) return { error: "Please choose a deadline." };
  const d = new Date(`${due.length === 16 ? `${due}:00` : due}+05:30`);
  if (Number.isNaN(d.getTime())) return { error: "Invalid deadline." };
  const dueAt = d.toISOString();

  const supabase = createClient();
  const { error } = await supabase.from("todos").insert({ user_id: profile.id, title, due_at: dueAt });
  if (error) return { error: error.message };

  refresh();
  return {};
}

export async function completeTodoAction(id: string): Promise<Result> {
  const profile = await requireUserProfile();
  const supabase = createClient();
  const { error } = await supabase
    .from("todos")
    .update({ done: true, done_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", profile.id);
  if (error) return { error: error.message };
  refresh();
  return {};
}

export async function deleteTodoAction(id: string): Promise<Result> {
  const profile = await requireUserProfile();
  const supabase = createClient();
  const { error } = await supabase.from("todos").delete().eq("id", id).eq("user_id", profile.id);
  if (error) return { error: error.message };
  refresh();
  return {};
}
