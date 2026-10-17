"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { animate, motion, useReducedMotion, type Variants } from "framer-motion";
import { BookUser, Check, CheckSquare, FileText, PhoneCall, Plus, Target, Trash2, Upload, UserPlus } from "lucide-react";
import { ImportLeadsDialog } from "@/components/crm/import-leads-dialog";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { DateStrip, StepHeader, TimeWheel, buildDate, defaultTimeFor, describeWhen, type TimeState } from "@/components/crm/datetime-steps";
import { Button } from "@/components/ui/button";
import { createTodoAction, completeTodoAction, deleteTodoAction } from "@/lib/todos/actions";
import type { Kpi, OverviewData, OverviewLead } from "@/lib/dashboard/overview";
import type { CashflowMonth } from "@/lib/cashflow/types";

const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 26 } },
};

const card = "rounded-2xl border bg-card p-4 shadow-card";

const ICONS = {
  lead: UserPlus,
  task: Plus,
  tasks: CheckSquare,
  crm: BookUser,
  targets: Target,
  reports: FileText,
} as const;

export type QuickAction = { href: string; label: string; icon: keyof typeof ICONS };

const TONE: Record<NonNullable<Kpi["tone"]>, string> = {
  primary: "border-l-primary",
  green: "border-l-green-500",
  red: "border-l-destructive",
  amber: "border-l-amber-500",
};

function CountUp({ to, prefix = "", suffix = "" }: { to: number; prefix?: string; suffix?: string }) {
  const reduce = useReducedMotion();
  const [v, setV] = useState(reduce ? to : 0);
  useEffect(() => {
    if (reduce) {
      setV(to);
      return;
    }
    const c = animate(0, to, { duration: 1.2, ease: "easeOut", onUpdate: (x) => setV(Math.round(x)) });
    return () => c.stop();
  }, [to, reduce]);
  return (
    <>
      {prefix}
      {v.toLocaleString("en-IN")}
      {suffix}
    </>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-muted/50 px-3 py-4 text-center text-xs text-muted-foreground">{children}</p>;
}

function LeadRow({ lead, kind }: { lead: OverviewLead; kind: "meeting" | "followup" }) {
  const [t1, t2] = (lead.time ?? "").split(" ");
  return (
    <motion.div whileHover={{ x: 4 }}>
      <Link href={`/crm/${lead.id}`} className="flex items-center gap-3 rounded-2xl bg-muted/50 p-2.5">
        {kind === "meeting" ? (
          <div className="min-w-[56px] rounded-xl bg-accent px-2 py-1.5 text-center text-[11px] font-bold leading-tight text-primary">
            {t1}
            <br />
            {t2}
          </div>
        ) : (
          <div className="grid h-10 w-10 flex-none place-items-center rounded-full bg-accent text-sm font-bold text-primary">
            {lead.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{lead.name}</p>
          <p className="truncate text-xs text-muted-foreground">{lead.sub}</p>
        </div>
        <span
          className={`whitespace-nowrap rounded-lg px-2.5 py-0.5 text-[10px] font-medium ${
            lead.tag === "Overdue"
              ? "bg-destructive/10 text-destructive"
              : lead.tag === "Today"
              ? "bg-amber-500/15 text-amber-600"
              : "bg-accent text-primary"
          }`}
        >
          {kind === "meeting" ? "Meeting" : lead.tag}
        </span>
      </Link>
    </motion.div>
  );
}

function CrmChart({ chart }: { chart: OverviewData["chart"] }) {
  const W = 520;
  const H = 120;
  const max = Math.max(5, ...chart.days.map((d) => Math.max(d.added, d.closed)));
  const x = (i: number) => 20 + (i * (W - 40)) / 6;
  const y = (v: number) => H - (v / max) * H + 8;
  const path = (k: "added" | "closed") =>
    chart.days.map((d, i) => `${i ? "L" : "M"}${x(i)} ${y(d[k])}`).join(" ");
  const stageMax = Math.max(1, ...chart.stages.map((s) => s.count));

  return (
    <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
      <div>
      <div className="mb-1 flex gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-primary" />Leads added</span>
        <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-green-500" />Deals closed</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H + 40}`} className="w-full" role="img" aria-label="Leads added and deals closed in the last 7 days">
        <defs>
          <linearGradient id="crmArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="hsl(var(--primary))" stopOpacity="0.25" />
            <stop offset="1" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1="20" x2={W - 20} y1={8 + (i * H) / 3} y2={8 + (i * H) / 3} stroke="hsl(var(--border))" />
        ))}
        {chart.days.map((d, i) => (
          <text key={d.label + i} x={x(i)} y={H + 28} textAnchor="middle" fontSize="10" fill="hsl(var(--muted-foreground))">
            {d.label}
          </text>
        ))}
        <motion.path
          d={`${path("added")} L${x(6)} ${H + 8} L${x(0)} ${H + 8}Z`}
          fill="url(#crmArea)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.8 }}
        />
        <motion.path d={path("added")} fill="none" stroke="hsl(var(--primary))" strokeWidth="3" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4, delay: 0.3, ease: "easeInOut" }} />
        <motion.path d={path("closed")} fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4, delay: 0.6, ease: "easeInOut" }} />
        {chart.days.map((d, i) => (
          <motion.circle key={i} cx={x(i)} cy={y(d.added)} r="4" fill="hsl(var(--card))" stroke="hsl(var(--primary))" strokeWidth="2.5" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.8 + i * 0.08 }} />
        ))}
      </svg>
      </div>
      <div className="space-y-2 self-center">
        {chart.stages.map((s, i) => (
          <div key={s.label} className="flex items-center gap-2 text-[11px]">
            <span className="w-24 text-muted-foreground">{s.label}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-accent">
              <motion.span
                className="block h-full rounded-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${(s.count / stageMax) * 100}%` }}
                transition={{ duration: 1, delay: 0.5 + i * 0.07, ease: "easeOut" }}
              />
            </span>
            <b className="w-8 text-right">{s.count}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function KpiColumn({ kpis }: { kpis: Kpi[] }) {
  return (
    <motion.div variants={container} className="grid grid-cols-2 gap-2 lg:flex lg:flex-col">
      {kpis.map((k) => {
        const body = (
          <motion.div
            variants={item}
            whileHover={{ x: 4 }}
            className={`flex items-center justify-between gap-2 rounded-xl border border-l-4 bg-card px-3 py-2 shadow-card ${TONE[k.tone ?? "primary"]}`}
          >
            <div className="min-w-0">
              <p className="truncate text-[11px] text-muted-foreground">{k.label}</p>
              {k.hint && <p className="truncate text-[10px] text-muted-foreground/80">{k.hint}</p>}
            </div>
            <b className="whitespace-nowrap text-base">
              <CountUp to={k.value} prefix={k.prefix} suffix={k.suffix} />
            </b>
          </motion.div>
        );
        return k.href ? <Link key={k.label} href={k.href}>{body}</Link> : <div key={k.label}>{body}</div>;
      })}
    </motion.div>
  );
}

function CashflowChart({ months }: { months: CashflowMonth[] }) {
  const reduce = useReducedMotion();
  const W = 520;
  const H = 120;
  const max = Math.max(1, ...months.flatMap((m) => [m.received, m.spent]));
  const slot = (W - 40) / months.length;
  const bw = Math.min(18, slot / 3);

  return (
    <div>
      <div className="mb-1 flex gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-green-500" />Received</span>
        <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-primary" />Expenses</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H + 40}`} className="w-full" role="img" aria-label="Money received and expenses in the last 6 months">
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1="20" x2={W - 20} y1={8 + (i * H) / 3} y2={8 + (i * H) / 3} stroke="hsl(var(--border))" />
        ))}
        {months.map((m, i) => {
          const cx = 20 + slot * i + slot / 2;
          const hr = (m.received / max) * H;
          const hs = (m.spent / max) * H;
          return (
            <g key={m.label + i}>
              <motion.rect x={cx - bw - 1} width={bw} rx={3} fill="#22c55e" initial={reduce ? false : { height: 0, y: H + 8 }} animate={{ height: hr, y: H + 8 - hr }} transition={{ duration: 0.8, delay: 0.2 + i * 0.07, ease: "easeOut" }} />
              <motion.rect x={cx + 1} width={bw} rx={3} fill="hsl(var(--primary))" initial={reduce ? false : { height: 0, y: H + 8 }} animate={{ height: hs, y: H + 8 - hs }} transition={{ duration: 0.8, delay: 0.25 + i * 0.07, ease: "easeOut" }} />
              <text x={cx} y={H + 28} textAnchor="middle" fontSize="10" fill="hsl(var(--muted-foreground))">{m.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const SHEET =
  "left-0 top-auto bottom-0 max-w-full translate-x-0 translate-y-0 rounded-b-none max-h-[90dvh] overflow-y-auto " +
  "sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:max-w-sm sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl";
const FOOTER = "sticky bottom-0 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]";

function TodoCard({ todos, count }: { todos: OverviewData["todos"]; count: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"what" | "date" | "time">("what");
  const [title, setTitle] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [time, setTime] = useState<TimeState>({ h: 10, m: 0, pm: false });

  const picked = dateStr ? buildDate(dateStr, time) : null;
  const inFuture = picked !== null && picked.getTime() > Date.now();

  function goTime() {
    if (!dateStr) return;
    setTime(defaultTimeFor(dateStr));
    setStep("time");
  }

  function handleSave() {
    if (!picked || !inFuture || !title.trim()) return;
    const h24 = (time.h % 12) + (time.pm ? 12 : 0);
    const fd = new FormData();
    fd.set("title", title.trim());
    fd.set("due", `${dateStr}T${String(h24).padStart(2, "0")}:${String(time.m).padStart(2, "0")}`);
    setError(null);
    startTransition(async () => {
      const res = await createTodoAction(fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  function run(id: string, fn: (id: string) => Promise<{ error?: string }>) {
    setBusyId(id);
    startTransition(async () => {
      await fn(id);
      setBusyId(null);
      router.refresh();
    });
  }

  const input =
    "h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20";

  return (
    <>
      <motion.div variants={item} className={card}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            To-do list <span className="font-normal text-muted-foreground">· {count}</span>
          </h3>
          <motion.button
            type="button"
            whileHover={{ rotate: 90 }}
            onClick={() => {
              setError(null);
              setStep("what");
              setTitle("");
              setDateStr("");
              setOpen(true);
            }}
            aria-label="Add to-do"
            className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground"
          >
            <Plus size={18} />
          </motion.button>
        </div>
        <div className="space-y-2">
          {todos.length === 0 ? (
            <Empty>Nothing on your list. Tap + to add one.</Empty>
          ) : (
            todos.map((t) => (
              <div
                key={t.id}
                className={`flex items-center gap-3 rounded-xl bg-muted/50 px-3 py-2.5 transition-opacity ${busyId === t.id ? "opacity-50" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => run(t.id, completeTodoAction)}
                  disabled={busyId === t.id}
                  aria-label={`Mark "${t.title}" done`}
                  className="grid h-6 w-6 flex-none place-items-center rounded-full border-2 border-primary/40 text-transparent transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
                >
                  <Check size={14} strokeWidth={3} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.title}</p>
                  <p className={`text-[11px] ${t.overdue ? "text-destructive" : "text-muted-foreground"}`}>{t.due}</p>
                </div>
                <button
                  type="button"
                  onClick={() => run(t.id, deleteTodoAction)}
                  disabled={busyId === t.id}
                  aria-label={`Delete "${t.title}"`}
                  className="grid h-8 w-8 flex-none place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          )}
        </div>
      </motion.div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={SHEET}>
          {step === "what" && (
            <>
              <StepHeader title="New to-do" sub="Step 1/2 · Kya karna hai aur kab tak?" />
              <input
                id="todo-title"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                placeholder="e.g. Call the supplier"
                className={input}
              />
              <p className="text-xs font-medium text-muted-foreground">Deadline date</p>
              <DateStrip value={dateStr} onPick={setDateStr} />
              <DialogFooter className={FOOTER}>
                <Button type="button" size="xl" className="w-full" disabled={!dateStr || !title.trim()} onClick={goTime}>
                  Next
                </Button>
              </DialogFooter>
            </>
          )}
          {step === "time" && (
            <>
              <StepHeader title="Time chuno" sub="Step 2/2 · Time" onBack={() => setStep("what")} />
              <p className={"text-center text-sm font-semibold " + (inFuture ? "text-primary" : "text-destructive")}>
                {picked ? describeWhen(picked) : ""}
                {picked && !inFuture ? " — future ka time chuno" : ""}
              </p>
              <TimeWheel value={time} onChange={setTime} />
              {error && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
              )}
              <DialogFooter className={FOOTER}>
                <Button type="button" size="xl" className="w-full" disabled={!inFuture || pending} onClick={handleSave}>
                  {pending ? "Adding…" : "Add to-do"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DashboardOverview({
  data,
  kpis,
  checkIn,
  flashTask,
  chips,
  quickActions,
  canImport,
  todayCalls,
  cashflow,
}: {
  data: OverviewData;
  kpis: Kpi[];
  checkIn: ReactNode;
  flashTask?: ReactNode;
  chips?: { label: string; value: string }[];
  quickActions: QuickAction[];
  canImport: boolean;
  canCreateTask: boolean;
  todayCalls?: number;
  cashflow?: { kpis: Kpi[]; months: CashflowMonth[] };
}) {
  const [importOpen, setImportOpen] = useState(false);

  return (
    <>
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
        <motion.div variants={item} className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {todayCalls !== undefined && (
              <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}>
                <Link
                  href="/crm/today"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-card"
                >
                  <PhoneCall size={15} /> Today&apos;s Calls
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white/25 px-1.5 text-xs font-bold">
                    {todayCalls}
                  </span>
                </Link>
              </motion.div>
            )}
            {quickActions.map((q) => {
              const Icon = ICONS[q.icon];
              return (
                <motion.div key={q.href + q.label} whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}>
                  <Link
                    href={q.href}
                    className="inline-flex items-center gap-2 rounded-xl border bg-card px-3.5 py-2 text-xs font-semibold text-primary shadow-card"
                  >
                    <Icon size={15} /> {q.label}
                  </Link>
                </motion.div>
              );
            })}
          </div>
          {canImport && (
            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-card"
            >
              <Upload size={15} /> Import Leads
            </motion.button>
          )}
        </motion.div>

        <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.2fr)_minmax(0,1.2fr)]">
          <motion.div variants={item} className="flex min-w-0 flex-col justify-center rounded-2xl bg-primary p-5 text-primary-foreground shadow-card lg:col-span-2 xl:col-span-1">
            <p className="text-sm text-white/80">Tasks today</p>
            <p className="text-5xl font-bold leading-tight">
              <CountUp to={data.tasksToday} />
            </p>
            <p className="text-sm text-white/80">
              {data.meetingsCount} meeting{data.meetingsCount === 1 ? "" : "s"} · {data.followupsCount} follow-up
              {data.followupsCount === 1 ? "" : "s"}
            </p>
            {chips && chips.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {chips.map((c) => (
                  <div key={c.label}>
                    <p className="text-base font-bold">{c.value}</p>
                    <p className="text-[11px] text-white/70">{c.label}</p>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          <motion.div variants={item} className="flex min-w-0 flex-col gap-4">
            {checkIn}
            {flashTask}
            <div className={card}>
              <h3 className="mb-3 text-sm font-semibold">Today’s meetings</h3>
              <div className="space-y-2">
                {data.meetings.length === 0 ? <Empty>No meetings today</Empty> : data.meetings.map((m) => <LeadRow key={m.id} lead={m} kind="meeting" />)}
              </div>
            </div>
          </motion.div>

          <div className="flex min-w-0 flex-col gap-4 self-start">
          <motion.div variants={item} className={card}>
            <h3 className="mb-3 text-sm font-semibold">Follow-ups due</h3>
            <div className="space-y-2">
              {data.followups.length === 0 ? <Empty>No follow-ups due</Empty> : data.followups.map((f) => <LeadRow key={f.id} lead={f} kind="followup" />)}
            </div>
          </motion.div>
            <TodoCard todos={data.todos} count={data.todosCount} />

          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)]">
          <KpiColumn kpis={kpis} />

          <div className="grid gap-4">
            <motion.div variants={item} className={card}>
              <h3 className="mb-2 flex items-center justify-between text-sm font-semibold">
                CRM overview <span className="text-[11px] font-normal text-muted-foreground">Last 7 days</span>
              </h3>
              <CrmChart chart={data.chart} />
            </motion.div>
          </div>
        </section>

        {cashflow && (
          <section className="grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)]">
            <KpiColumn kpis={cashflow.kpis} />
            <div className="grid gap-4">
              <motion.div variants={item} className={card}>
                <h3 className="mb-2 flex items-center justify-between text-sm font-semibold">
                  Cashflow overview <span className="text-[11px] font-normal text-muted-foreground">Last 6 months</span>
                </h3>
                <CashflowChart months={cashflow.months} />
              </motion.div>
            </div>
          </section>
        )}
      </motion.div>

      {canImport && <ImportLeadsDialog open={importOpen} onClose={() => setImportOpen(false)} />}
    </>
  );
}
