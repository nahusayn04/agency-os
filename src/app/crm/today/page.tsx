import Link from "next/link";
import { requireUserProfile } from "@/lib/auth/session";
import { getTodayDateString } from "@/lib/auth/attendance";
import { getTodayCallsData, type TodayCallLead } from "@/lib/crm/today-calls";
import { TodayCallRow } from "@/components/crm/today-call-row";
import { TodayDatePicker } from "@/components/crm/today-date-picker";

export const dynamic = "force-dynamic";

function Section({
  title,
  tone,
  leads,
  kind,
  showAssignee,
}: {
  title: string;
  tone?: "red";
  leads: TodayCallLead[];
  kind: "overdue" | "callback" | "meeting";
  showAssignee: boolean;
}) {
  if (leads.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2
        className={
          "text-sm font-semibold " + (tone === "red" ? "text-red-600 dark:text-red-400" : "")
        }
      >
        {title} <span className="font-normal text-muted-foreground">({leads.length})</span>
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {leads.map((l) => (
          <TodayCallRow key={l.id} lead={l} kind={kind} showAssignee={showAssignee} />
        ))}
      </div>
    </section>
  );
}

export default async function TodayCallsPage({
  searchParams,
}: {
  searchParams?: { date?: string; who?: string };
}) {
  const profile = await requireUserProfile();
  const isMember = profile.role === "member";
  const everyone = !isMember && searchParams?.who === "all";
  const todayStr = getTodayDateString();

  const data = await getTodayCallsData({
    userId: profile.id,
    role: profile.role,
    date: searchParams?.date,
    everyone,
  });

  const total = data.overdue.length + data.callbacks.length + data.meetings.length;
  const who = everyone ? "all" : "mine";
  const dateQs = data.isToday ? "" : `date=${data.date}`;
  const link = (w: "mine" | "all") => {
    const qs = [dateQs, w === "all" ? "who=all" : ""].filter(Boolean).join("&");
    return "/crm/today" + (qs ? "?" + qs : "");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Today&apos;s Calls</h1>
          <p className="text-sm text-muted-foreground">
            {total === 0
              ? "No calls pending."
              : `${total} call${total === 1 ? "" : "s"} ${data.isToday ? "to make today" : "on " + data.date}`}
          </p>
        </div>
        <TodayDatePicker date={data.date} todayStr={todayStr} who={who} />
      </div>

      {!isMember && (
        <div className="flex gap-2">
          {(["mine", "all"] as const).map((w) => (
            <Link
              key={w}
              href={link(w)}
              className={
                "rounded-full border px-3.5 py-1.5 text-xs font-medium " +
                (who === w
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground")
              }
            >
              {w === "mine" ? "My leads" : "Everyone"}
            </Link>
          ))}
        </div>
      )}

      {total === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center shadow-card">
          <p className="text-base font-semibold">All clear 🎉</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.isToday
              ? "No overdue or scheduled calls for today."
              : "No calls scheduled for this date."}
          </p>
        </div>
      ) : (
        <>
          <Section title="Overdue" tone="red" leads={data.overdue} kind="overdue" showAssignee={everyone} />
          <Section title="Callbacks" leads={data.callbacks} kind="callback" showAssignee={everyone} />
          <Section title="Meetings" leads={data.meetings} kind="meeting" showAssignee={everyone} />
        </>
      )}
    </div>
  );
}
