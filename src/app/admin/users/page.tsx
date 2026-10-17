import Link from "next/link";
import { requireUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { UsersList } from "@/components/admin/user-row-list";
import { HolidaySettings } from "@/components/dashboard/holiday-settings";
import { ColdCallSettings } from "@/components/dashboard/cold-call-settings";
import { getSundayOffSetting, listHolidays } from "@/lib/services/attendance-settings";
import { getDefaultColdCallTarget, listColdCallTargets } from "@/lib/services/cold-call-settings";

export default async function AdminUsersPage() {
  const profile = await requireUserProfile();
  if (profile.role !== "admin" && profile.role !== "super_admin") {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-semibold">Admin Users</h1>
        <p className="text-sm text-muted-foreground">You are not authorized to view this page.</p>
      </div>
    );
  }

  const supabase = createClient();
  const { data: users } = await supabase
    .from("users")
    .select("id, name, email, role, is_active, shift_start, shift_end")
    .order("name");

  const rows = (users ?? []) as Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    is_active: boolean;
    shift_start?: string | null;
    shift_end?: string | null;
  }>;

  const isSuperAdmin = profile.role === "super_admin";
  const sundayOff = isSuperAdmin ? await getSundayOffSetting() : true;
  const holidays = isSuperAdmin ? await listHolidays() : [];
  const defaultColdCallTarget = isSuperAdmin ? await getDefaultColdCallTarget() : 15;
  const coldCallMembers = isSuperAdmin ? await listColdCallTargets() : [];

  const activeCount = rows.filter((r) => r.is_active).length;
  const adminCount = rows.filter((r) => r.role === "admin" || r.role === "super_admin").length;
  const stats = [
    { label: "Total members", value: String(rows.length) },
    { label: "Active", value: String(activeCount) },
    { label: "Admins", value: String(adminCount) },
    isSuperAdmin
      ? { label: "Cold call default", value: `${defaultColdCallTarget} / day` }
      : { label: "Inactive", value: String(rows.length - activeCount) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your team, shifts, holidays and daily targets.
          </p>
        </div>
        <Link
          href="/admin/users"
          className="inline-flex items-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card"
        >
          Refresh
        </Link>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border bg-card px-4 py-3 shadow-card lg:px-5 lg:py-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-2xl font-bold leading-tight lg:text-3xl">{s.value}</p>
          </div>
        ))}
      </section>

      {isSuperAdmin && (
        <section className="grid items-start gap-4 lg:grid-cols-2">
          <HolidaySettings initialSundayOff={sundayOff} initialHolidays={holidays} />
          <ColdCallSettings initialDefaultTarget={defaultColdCallTarget} initialMembers={coldCallMembers} />
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">
          Team members <span className="text-sm font-normal text-muted-foreground">· {rows.length}</span>
        </h2>
        <UsersList rows={rows} isSuperAdmin={isSuperAdmin} />
      </section>
    </div>
  );
}
