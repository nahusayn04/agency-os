"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Trash2, X, BellRing } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { NotificationPermission } from "@/components/notifications/notification-permission";
import {
  markAllNotificationsAsRead,
  markNotificationReadAction,
  deleteNotificationAction,
} from "@/lib/messages/actions";
import {
  clearReadNotificationsAction,
  snoozeLeadAction,
  type NotificationRow,
} from "@/lib/notifications/actions";
import {
  CATEGORY_LABELS,
  LEAD_REMINDER_TYPES,
  categoryFor,
  type NotificationCategory,
} from "@/lib/notifications/types";

type Filter = "all" | "unread" | NotificationCategory;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "crm", label: CATEGORY_LABELS.crm },
  { id: "tasks", label: CATEGORY_LABELS.tasks },
  { id: "attendance", label: CATEGORY_LABELS.attendance },
  { id: "messages", label: CATEGORY_LABELS.messages },
];

function istDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function matches(n: NotificationRow, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "unread") return !n.is_read;
  return categoryFor(n.type) === filter;
}

function Row({
  n,
  onOpen,
  onDelete,
  onSnooze,
}: {
  n: NotificationRow;
  onOpen: (n: NotificationRow) => void;
  onDelete: (id: string) => void;
  onSnooze: (n: NotificationRow, mode: "1h" | "tomorrow") => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const canSnooze = n.needs_action && !!n.reference_id && !!n.type && LEAD_REMINDER_TYPES.has(n.type);

  async function snooze(mode: "1h" | "tomorrow") {
    setBusy(true);
    await onSnooze(n, mode);
    setBusy(false);
  }

  return (
    <div
      className={`group relative rounded-xl border bg-card p-3 pr-9 transition-colors ${
        n.is_read ? "opacity-70" : "border-primary/30"
      }`}
    >
      {!n.is_read && <span className="absolute left-1.5 top-4 h-1.5 w-1.5 rounded-full bg-primary" />}
      <button type="button" onClick={() => onOpen(n)} className="block w-full pl-2 text-left">
        <div className="flex flex-wrap items-center gap-1.5">
          {n.priority === "urgent" && (
            <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-600">
              Urgent
            </span>
          )}
          <span className="text-sm font-semibold text-foreground">{n.title}</span>
          {n.item_count > 1 && !/\(\d+\)\s*$/.test(n.title) && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-primary">
              ×{n.item_count}
            </span>
          )}
        </div>
        <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{n.message}</p>
        <p className="mt-1.5 text-xs text-muted-foreground">{timeAgo(n.updated_at)}</p>
      </button>

      {canSnooze && (
        <div className="mt-2 flex gap-2 pl-2">
          <Button size="xs" variant="outline" disabled={busy} onClick={() => snooze("1h")}>
            Snooze 1 hr
          </Button>
          <Button size="xs" variant="outline" disabled={busy} onClick={() => snooze("tomorrow")}>
            Tomorrow
          </Button>
        </div>
      )}

      <button
        type="button"
        aria-label="Remove notification"
        onClick={() => onDelete(n.id)}
        className="absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function NotificationsView({
  userId,
  initialPending,
  initialRecent,
}: {
  userId: string;
  initialPending: NotificationRow[];
  initialRecent: NotificationRow[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<NotificationRow[]>(() => [...initialPending, ...initialRecent]);
  const [filter, setFilter] = useState<Filter>("all");
  const [toast, setToast] = useState<string | null>(null);

  // Live updates: new, merged (count changed) and removed notifications.
  useEffect(() => {
    const channel = supabase
      .channel(`notifications-page-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const oldId = (payload.old as { id?: string }).id;
            if (oldId) setRows((prev) => prev.filter((r) => r.id !== oldId));
            return;
          }
          const incoming = payload.new as NotificationRow;
          setRows((prev) => [incoming, ...prev.filter((r) => r.id !== incoming.id)]);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const visible = useMemo(() => rows.filter((r) => matches(r, filter)), [rows, filter]);
  const sorted = useMemo(
    () => [...visible].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [visible]
  );

  const pending = sorted.filter((r) => r.needs_action);
  const history = sorted.filter((r) => !r.needs_action);

  const todayKey = istDay(new Date().toISOString());
  const yesterdayKey = istDay(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  const groups: { label: string; items: NotificationRow[] }[] = [
    { label: "Today", items: history.filter((r) => istDay(r.updated_at) === todayKey) },
    { label: "Yesterday", items: history.filter((r) => istDay(r.updated_at) === yesterdayKey) },
    {
      label: "Earlier",
      items: history.filter((r) => ![todayKey, yesterdayKey].includes(istDay(r.updated_at))),
    },
  ].filter((g) => g.items.length > 0);

  const unreadCount = rows.filter((r) => !r.is_read).length;

  const open = useCallback(
    (n: NotificationRow) => {
      if (!n.is_read) {
        setRows((prev) => prev.map((r) => (r.id === n.id ? { ...r, is_read: true } : r)));
        markNotificationReadAction(n.id).catch(() => {});
      }
      if (n.link) router.push(n.link);
    },
    [router]
  );

  const remove = useCallback((id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    deleteNotificationAction(id).catch(() => {});
  }, []);

  const snooze = useCallback(async (n: NotificationRow, mode: "1h" | "tomorrow") => {
    if (!n.reference_id) return;
    const res = await snoozeLeadAction(n.reference_id, mode);
    setToast("error" in res && res.error ? res.error : mode === "1h" ? "Snoozed for 1 hour" : "Snoozed until tomorrow 9 AM");
  }, []);

  async function markAll() {
    setRows((prev) => prev.map((r) => ({ ...r, is_read: true })));
    await markAllNotificationsAsRead();
  }

  async function clearRead() {
    setRows((prev) => prev.filter((r) => !r.is_read || r.needs_action));
    await clearReadNotificationsAction();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread` : "You are all caught up"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={markAll} disabled={unreadCount === 0}>
            <Check /> Mark all read
          </Button>
          <Button size="sm" variant="outline" onClick={clearRead}>
            <Trash2 /> Clear read
          </Button>
        </div>
      </div>

      <NotificationPermission />

      <div className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
              filter === f.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {pending.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-red-600">
            <BellRing size={14} /> Needs action ({pending.length})
          </h2>
          <p className="text-xs text-muted-foreground">
            These stay here until you set a new callback date, mark Spoke, or change the stage.
          </p>
          {pending.map((n) => (
            <Row key={n.id} n={n} onOpen={open} onDelete={remove} onSnooze={snooze} />
          ))}
        </section>
      )}

      {groups.map((g) => (
        <section key={g.label} className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{g.label}</h2>
          {g.items.map((n) => (
            <Row key={n.id} n={n} onOpen={open} onDelete={remove} onSnooze={snooze} />
          ))}
        </section>
      ))}

      {pending.length === 0 && groups.length === 0 && (
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          No notifications here.
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background shadow-lg lg:bottom-8">
          {toast}
        </div>
      )}
    </div>
  );
}
