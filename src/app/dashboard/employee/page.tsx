import Link from "next/link";
import { CheckSquare, BookUser, Target, FileText } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { getWeekStartDateString } from "@/lib/performance/week";
import { getFounderCommitmentForWeek } from "@/lib/founder-commitment/actions";
import { FounderCommitmentReadonly } from "@/components/dashboard/founder-commitment-readonly";
import { getLatestPerformanceScoreForUser } from "@/lib/performance/actions";
import { PerformanceScoreSection } from "@/components/performance/performance-score-section";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AttendanceCard } from "@/components/dashboard/attendance-card";
import { FlashTaskCard } from "@/components/dashboard/flash-task-card";
import { getTodayDateString } from "@/lib/auth/attendance";
import { getFineAmount, closeStaleShiftSession } from "@/lib/services/strike-fine-engine";
import { getGlobalOffDayInfo } from "@/lib/services/attendance-settings";

export default async function EmployeeDashboardPage() {
  const profile = await requireRole("member");

  // Writes to the DB (auto-checkout for stale sessions) — must finish
  // before we read is_checked_in below, so this stays sequential.
  await closeStaleShiftSession(profile.id);

  const weekStart = getWeekStartDateString();
  const today = getTodayDateString();
  const startOfWeek = new Date(weekStart);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  const supabase = createClient();
  const admin = createAdminClient();

  // All of these are independent of each other — fetch them in parallel
  // instead of one-by-one.
  // Note: the old "unread notifications count" query was fetched but its
  // result was never used anywhere — removed, it was a wasted DB round trip.
  const [
    commitment,
    ownScore,
    userRowResult,
    todayAttendanceResult,
    todaysTasksResult,
    targetsResult,
    myFinesResult,
    activeStrikeCountResult,
    fineAmount,
    offDayInfo,
    coldCallTaskResult,
    myFlashTaskResult,
  ] = await Promise.all([    getFounderCommitmentForWeek(weekStart),
    getLatestPerformanceScoreForUser(profile.id),
    admin
      .from("users")
      .select("is_checked_in, last_checkin_at, shift_start, shift_end, checkout_report_pending")
      .eq("id", profile.id)
      .single(),
    admin
      .from("attendance")
      .select("id, checkout_time")
      .eq("user_id", profile.id)
      .eq("date", today)
      .maybeSingle(),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("assigned_to", profile.id)
      .not("status", "in", '("completed","approved")'),
    supabase
      .from("weekly_targets")
      .select("completion_percentage")
      .eq("user_id", profile.id)
      .gte("created_at", startOfWeek.toISOString())
      .lt("created_at", endOfWeek.toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("fines")
      .select("id, amount, status, deadline, proof_url, payment_comment")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false }),
    admin
      .from("strikes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("is_removed", false)
      .is("fine_id", null),
    getFineAmount(),
    getGlobalOffDayInfo(today),
    supabase
      .from("tasks")
      .select("id, status, mandatory_target_count, mandatory_actual_count, mandatory_type")
      .eq("assigned_to", profile.id)
      .eq("is_mandatory", true)
      .eq("mandatory_date", today)
      .maybeSingle(),
    supabase
      .from("tasks")
      .select("id, title, description, status, flash_duration_hours, deadline")
      .eq("assigned_to", profile.id)
      .eq("is_flash_task", true)
      .in("status", ["pending", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const userRow = userRowResult.data;
  const isCheckedIn = userRow?.is_checked_in ?? false;
  const reportPending = userRow?.checkout_report_pending ?? false;
  const lastCheckinAt = userRow?.last_checkin_at ?? null;

  const todayAttendance = todayAttendanceResult.data;
  // "Marked for today" should only show once checkout has actually
  // happened — a row simply existing isn't enough (an absent-marked row
  // also exists with "date = today", but its checkout_time is null).
  const checkedOutToday = !isCheckedIn && !!todayAttendance?.checkout_time;

  const todaysTasks = todaysTasksResult.count;

  const targets = targetsResult.data;
  const weeklyTargetPercent = targets?.completion_percentage ?? 0;

  const myFines = myFinesResult.data;
  const activeStrikeCount = activeStrikeCountResult.count;
  const pendingFineCount = (myFines ?? []).filter(
    (f) => f.status === "pending" || f.status === "submitted"
  ).length;

   const myFlashTask = myFlashTaskResult.data;
  const coldCallTask = coldCallTaskResult.data;
  const coldCallSubmitted = coldCallTask
    ? !["pending", "in_progress", "paused", "revision_required"].includes(coldCallTask.status)
    : false;

  const quickLinks = [
    { href: "/my-tasks", label: "My Tasks", icon: CheckSquare },
    { href: "/crm", label: "CRM", icon: BookUser },
    { href: "/targets", label: "Targets", icon: Target },
    { href: "/reports", label: "Reports", icon: FileText },
  ];

  return (
    <div className="space-y-5">
      {/* Hero summary card */}
      <section className="rounded-3xl bg-primary p-5 text-primary-foreground shadow-card">
        <p className="text-sm text-white/70">Welcome back,</p>
        <h1 className="text-xl font-semibold tracking-tight">{profile.name}</h1>

        <p className="mt-5 text-xs text-white/70">Active tasks</p>
        <p className="text-4xl font-bold leading-tight">{todaysTasks ?? 0}</p>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-lg font-bold">{weeklyTargetPercent}%</p>
            <p className="text-[11px] text-white/70">Weekly target</p>
          </div>
          <div>
            <p className="text-lg font-bold">{ownScore?.total_score ?? "—"}</p>
            <p className="text-[11px] text-white/70">Performance</p>
          </div>
          <div>
            <p className="text-lg font-bold">{activeStrikeCount ?? 0}</p>
            <p className="text-[11px] text-white/70">Strikes</p>
          </div>
        </div>

        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/25">
          <div
            className="h-full rounded-full bg-white"
            style={{ width: `${Math.min(100, Math.max(0, Number(weeklyTargetPercent) || 0))}%` }}
          />
        </div>
      </section>

      {/* Quick actions */}
      <section>
        <h2 className="mb-2 text-sm font-semibold">Quick actions</h2>
        <div className="grid grid-cols-4 gap-2">
          {quickLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1.5 rounded-2xl bg-accent px-1 py-3 text-primary transition-colors hover:bg-accent/70"
            >
              <Icon size={20} />
              <span className="text-[11px] font-medium">{label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Today */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Today</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <AttendanceCard
            isCheckedIn={isCheckedIn}
            offDayReason={offDayInfo.reason}
            lastCheckinAt={lastCheckinAt}
            shiftStart={userRow?.shift_start ?? null}
            shiftEnd={userRow?.shift_end ?? null}
            checkedOutToday={checkedOutToday}
            reportPending={reportPending}
            activeStrikeCount={activeStrikeCount ?? 0}
            pendingFineCount={pendingFineCount}
            fineAmount={fineAmount}
          />

          {myFlashTask && <FlashTaskCard task={myFlashTask} />}

          {coldCallTask && (
            <Link href="/my-tasks">
              <Card
                className={`h-full transition-colors hover:bg-muted/60 ${
                  coldCallSubmitted
                    ? "border-l-4 border-l-green-500"
                    : "border-l-4 border-l-destructive"
                }`}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="relative z-10 text-sm font-medium">
                    Cold Calls {coldCallSubmitted ? "· Submitted" : "· Mandatory"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative z-10 text-2xl font-bold">
                    {coldCallTask.mandatory_actual_count ?? 0}
                    <span className="text-base font-normal text-muted-foreground">
                      {" "}
                      / {coldCallTask.mandatory_target_count} target
                    </span>
                  </div>
                  {!coldCallSubmitted && (
                    <p className="relative z-10 mt-1 text-xs text-muted-foreground">
                      Submit before checkout — screenshot required.
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          )}
        </div>
      </section>

      <FounderCommitmentReadonly
        weekStart={weekStart}
        commitmentText={commitment?.commitment_text ?? null}
      />

      <Card>
        <CardHeader>
          <CardTitle>Your performance score</CardTitle>
        </CardHeader>
        <CardContent>
          <PerformanceScoreSection
            score={ownScore}
            override={null}
            showOverrideModal={false}
            targetUserId={profile.id}
          />
          <p className="mt-4 text-sm text-muted-foreground">
            <Link href={`/dashboard/team/${profile.id}`} className="font-medium text-primary hover:underline">
              View full profile
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
