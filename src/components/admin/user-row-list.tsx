"use client";

import { useState, useTransition } from "react";
import { toggleUserActiveAction, setUserRoleAction, setShiftAction, setUserNameAction } from "@/lib/admin/users";

function NameForm({ userId, name }: { userId: string; name: string }) {
  const [value, setValue] = useState(name);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    setSaved(false);
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("userId", userId);
      formData.set("name", value);
      const result = await setUserNameAction(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        placeholder="Name"
        className="h-10 flex-1 min-w-0 rounded-xl border bg-card px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/30"
      />
      <button
        type="button"
        disabled={pending}
        onClick={handleSave}
        className="shrink-0 text-sm font-medium px-3 py-2 rounded-xl bg-accent text-primary hover:bg-accent/70 transition-colors disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {saved && !pending && <span className="text-xs text-emerald-500 shrink-0">Saved ✓</span>}
      {error && <span className="text-xs text-destructive shrink-0">{error}</span>}
    </div>
  );
}

function ShiftForm({ userId, shiftStart, shiftEnd }: { userId: string; shiftStart: string; shiftEnd: string }) {
  const [start, setStart] = useState(shiftStart);
  const [end, setEnd] = useState(shiftEnd);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    setSaved(false);
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("userId", userId);
      formData.set("shift_start", start);
      formData.set("shift_end", end);
      const result = await setShiftAction(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <input
        type="time"
        value={start}
        onChange={(e) => {
          setStart(e.target.value);
          setSaved(false);
        }}
        className="h-10 min-w-0 flex-1 rounded-xl border bg-card px-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/30"
      />
      <span className="text-xs text-muted-foreground shrink-0">to</span>
      <input
        type="time"
        value={end}
        onChange={(e) => {
          setEnd(e.target.value);
          setSaved(false);
        }}
        className="h-10 min-w-0 flex-1 rounded-xl border bg-card px-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/30"
      />
      <button
        type="button"
        disabled={pending}
        onClick={handleSave}
        className="shrink-0 text-sm font-medium px-3 py-2 rounded-xl bg-accent text-primary hover:bg-accent/70 transition-colors disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {saved && !pending && <span className="text-xs text-emerald-500 shrink-0">Saved ✓</span>}
      {error && <span className="text-xs text-destructive shrink-0">{error}</span>}
    </div>
  );
}

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  shift_start?: string | null;
  shift_end?: string | null;
}

const ROLE_LABEL: Record<string, string> = {
  member: "Member",
  admin: "Admin",
  super_admin: "Super admin",
};

export function UsersList({ rows, isSuperAdmin }: { rows: AdminUserRow[]; isSuperAdmin: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((u) => {
        const isOpen = openId === u.id;
        const shift =
          u.shift_start && u.shift_end ? `${u.shift_start.slice(0, 5)} – ${u.shift_end.slice(0, 5)}` : "—";
        return (
          <div key={u.id} className="min-w-0 space-y-4 rounded-2xl border bg-card p-5 shadow-card">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 flex-none place-items-center rounded-full bg-accent text-base font-bold text-primary">
                {u.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">{u.name}</p>
                <p className="truncate text-xs text-muted-foreground">{u.email}</p>
              </div>
              <span
                className={`inline-flex flex-none items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  u.is_active ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-destructive/10 text-destructive"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${u.is_active ? "bg-green-500" : "bg-destructive"}`} />
                {u.is_active ? "Active" : "Inactive"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl bg-muted/50 px-3 py-2.5">
                <p className="text-[11px] text-muted-foreground">Role</p>
                <p className="mt-0.5 truncate text-[13px] font-semibold">{ROLE_LABEL[u.role] ?? u.role}</p>
              </div>
              <div className="rounded-xl bg-muted/50 px-3 py-2.5">
                <p className="text-[11px] text-muted-foreground">Shift</p>
                <p className="mt-0.5 truncate text-[13px] font-semibold">{shift}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : u.id)}
                className="flex-1 rounded-xl bg-accent px-3 py-2.5 text-[13px] font-semibold text-primary transition-colors hover:bg-accent/70"
              >
                {isOpen ? "Close" : "Edit details"}
              </button>
              <form action={toggleUserActiveAction}>
                <input type="hidden" name="userId" value={u.id} />
                <input type="hidden" name="isActive" value={u.is_active ? "false" : "true"} />
                <button
                  type="submit"
                  className={`rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors ${
                    u.is_active
                      ? "bg-destructive/10 text-destructive hover:bg-destructive hover:text-white"
                      : "bg-green-500/10 text-green-700 hover:bg-green-600 hover:text-white dark:text-green-400"
                  }`}
                >
                  {u.is_active ? "Deactivate" : "Activate"}
                </button>
              </form>
            </div>

            {isOpen && (
              <div className="space-y-3 border-t pt-4">
                <NameForm userId={u.id} name={u.name} />

                <form action={setUserRoleAction} className="flex items-center gap-2">
                  <input type="hidden" name="userId" value={u.id} />
                  <select
                    name="role"
                    defaultValue={u.role}
                    className="h-10 min-w-0 flex-1 rounded-xl border bg-card px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/30"
                  >
                    <option value="member">member</option>
                    <option value="admin">admin</option>
                    <option value="super_admin">super_admin</option>
                  </select>
                  <button
                    type="submit"
                    className="shrink-0 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Set role
                  </button>
                </form>

                {isSuperAdmin && (
                  <ShiftForm
                    userId={u.id}
                    shiftStart={u.shift_start?.slice(0, 5) ?? "09:00"}
                    shiftEnd={u.shift_end?.slice(0, 5) ?? "17:00"}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
