"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  getLeadSnapshotAction,
  updateLeadAction,
  updateLeadStageAction,
  type LeadSnapshot,
} from "@/lib/crm/actions";
import { LEAD_STAGES, LEAD_STAGE_LABELS, type LeadStage } from "@/lib/types/crm";
import {
  clearPendingCall,
  closePostCallNotifications,
  markPendingCallLeft,
  readPendingCall,
  savePendingCall,
} from "@/lib/crm/call-tracking";
import { appendNote, formatCallbackLabel } from "@/components/crm/crm-dialogs";
import {
  DateStrip,
  StepHeader,
  TimeWheel,
  buildDate,
  dateToStr,
  defaultTimeFor,
  describeWhen,
  type TimeState,
} from "@/components/crm/datetime-steps";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const SHEET =
  "left-0 top-auto bottom-0 max-w-full translate-x-0 translate-y-0 rounded-b-none max-h-[92dvh] overflow-y-auto " +
  "sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:max-w-sm sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl";
const FOOTER = "sticky bottom-0 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]";

/**
 * "Not picked" / "Busy" keep the lead in Call Pending. When this is true they
 * also set the next follow-up to tomorrow 10:00 AM (only if the lead has no
 * follow-up, or its follow-up is today or earlier) so the lead never sits in
 * Call Pending without a date. Set to false to leave follow-ups untouched.
 */
const AUTO_RETRY_FOLLOWUP = true;
const RETRY_HOUR = 10;

type Outcome = "not_picked" | "busy";
const OUTCOME_LABEL: Record<Outcome, string> = {
  not_picked: "Not picked",
  busy: "Busy",
};

function tomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return dateToStr(d);
}

function tomorrowRetryAt() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(RETRY_HOUR, 0, 0, 0);
  return d;
}

function callLabel() {
  return (
    "Call " +
    new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" })
  );
}

/** One slidable strip of stages — same feel as the date strip. */
function StageStrip({
  value,
  onPick,
}: {
  value: LeadStage;
  onPick: (s: LeadStage) => void;
}) {
  const selRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    selRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, []);

  return (
    <div className="scrollbar-hide -mx-4 flex snap-x gap-2 overflow-x-auto px-4 py-1">
      {LEAD_STAGES.map((s) => (
        <button
          key={s}
          ref={s === value ? selRef : undefined}
          type="button"
          onClick={() => onPick(s)}
          className={
            "h-9 shrink-0 snap-start rounded-full border px-3.5 text-[13px] font-medium transition-colors " +
            (s === value
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input bg-card text-foreground")
          }
        >
          {LEAD_STAGE_LABELS[s]}
        </button>
      ))}
    </div>
  );
}

/**
 * Opens automatically after a call made from a CRM "Call" button.
 * Triggers: coming back to the app (tab visible / focus), opening the app
 * fresh with a call still pending, or tapping the post-call notification.
 *
 * Flow:
 *  - Not picked / Busy  -> one tap, saves instantly (Call Pending + auto note)
 *  - Spoke              -> pick stage + callback date/time (required), save
 * Every outcome stamps last_contact with the current date/time.
 */
export function PostCallPrompt() {
  const router = useRouter();
  const [saving, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [lead, setLead] = useState<LeadSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [view, setView] = useState<"outcome" | "spoke">("outcome");
  const [stage, setStage] = useState<LeadStage>("call_pending");
  const [dateStr, setDateStr] = useState("");
  const [time, setTime] = useState<TimeState>({ h: 10, m: 0, pm: false });
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openFor = useCallback(async (id: string) => {
    setLeadId(id);
    setLead(null);
    setLoadError(null);
    setError(null);
    setNote("");
    setShowNote(false);
    setView("outcome");
    setOpen(true);
    void closePostCallNotifications();

    const res = await getLeadSnapshotAction(id);
    if ("error" in res) {
      setLoadError(res.error);
      return;
    }
    setLead(res.lead);
    setStage(res.lead.stage);
  }, []);

  const check = useCallback(
    (opts: { fresh: boolean }) => {
      if (open) return;
      // Notification tap: /crm?postcall=<leadId>
      const params = new URLSearchParams(window.location.search);
      const fromNotif = params.get("postcall");
      if (fromNotif) {
        params.delete("postcall");
        const qs = params.toString();
        window.history.replaceState(
          null,
          "",
          window.location.pathname + (qs ? "?" + qs : "")
        );
        void openFor(fromNotif);
        return;
      }
      const call = readPendingCall();
      if (!call) return;
      const age = Date.now() - call.startedAt;
      // Came back after the app really went to background, or opened the app
      // fresh while a call is still waiting for its outcome.
      if (call.left || (opts.fresh && age > 8000)) {
        void openFor(call.leadId);
      }
    },
    [open, openFor]
  );

  useEffect(() => {
    check({ fresh: true });
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        markPendingCallLeft();
      } else {
        check({ fresh: false });
      }
    }
    function onFocus() {
      check({ fresh: false });
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onFocus);
    };
  }, [check]);

  function close(done: boolean) {
    setOpen(false);
    if (done) {
      clearPendingCall();
    } else {
      // Closed with X — keep it pending, but don't re-pop until the app is
      // backgrounded and reopened again.
      const call = readPendingCall();
      if (call) savePendingCall({ ...call, left: false, startedAt: Date.now() });
    }
    void closePostCallNotifications();
  }

  const needsMeeting = stage === "meeting" && lead?.stage !== "meeting";
  const picked = dateStr ? buildDate(dateStr, time) : null;
  const pickedOk = picked !== null && picked.getTime() > Date.now();

  function goSpoke() {
    if (!lead) return;
    setError(null);
    setStage(lead.stage);
    setDateStr(tomorrowStr());
    setTime({ h: 10, m: 0, pm: false });
    setView("spoke");
  }

  function onPickDate(ds: string) {
    const todayStr = dateToStr(new Date());
    if (ds === todayStr) setTime(defaultTimeFor(ds));
    else if (dateStr === todayStr) setTime({ h: 10, m: 0, pm: false });
    setDateStr(ds);
  }

  /** Not picked / Busy: one tap, saves and closes. */
  function saveOutcome(kind: Outcome) {
    if (!leadId || saving) return;
    setError(null);
    startTransition(async () => {
      // Always work from fresh data so we never overwrite newer notes.
      const snap = await getLeadSnapshotAction(leadId);
      if ("error" in snap) {
        setError(snap.error);
        return;
      }
      const cur = snap.lead;

      if (cur.stage !== "call_pending") {
        const r = await updateLeadStageAction(leadId, "call_pending");
        if (r?.error) {
          setError(r.error);
          return;
        }
      }

      const updates: Record<string, string> = {
        last_contact: new Date().toISOString(),
        notes: appendNote(cur.notes, callLabel(), OUTCOME_LABEL[kind]),
      };

      if (AUTO_RETRY_FOLLOWUP) {
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);
        const hasLaterFollowup =
          cur.next_followup &&
          new Date(cur.next_followup).getTime() > endOfToday.getTime();
        if (!hasLaterFollowup) {
          updates.next_followup = tomorrowRetryAt().toISOString();
        }
      }

      const r = await updateLeadAction(leadId, updates);
      if (r?.error) {
        setError(r.error);
        return;
      }

      close(true);
      router.refresh();
    });
  }

  /** Spoke: stage + required callback (or meeting) date/time. */
  function saveSpoke() {
    if (!leadId || saving) return;
    if (!picked || !pickedOk) {
      setError("Pick a future date and time.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const snap = await getLeadSnapshotAction(leadId);
      if ("error" in snap) {
        setError(snap.error);
        return;
      }
      const cur = snap.lead;
      const iso = picked.toISOString();
      const trimmed = note.trim();
      const movingToMeeting = stage === "meeting" && cur.stage !== "meeting";

      if (stage !== cur.stage) {
        const r = await updateLeadStageAction(
          leadId,
          stage,
          movingToMeeting ? { datetime: iso, note: trimmed } : undefined
        );
        if (r?.error) {
          setError(r.error);
          return;
        }
      }

      // The picked date/time is the callback; for a new Meeting it doubles
      // as the meeting time.
      const updates: Record<string, string> = {
        last_contact: new Date().toISOString(),
        next_followup: iso,
      };
      if (trimmed) {
        const label =
          callLabel() +
          ` (${movingToMeeting ? "meeting" : "callback"} ${formatCallbackLabel(iso)})`;
        updates.notes = appendNote(cur.notes, label, trimmed);
      }

      const r = await updateLeadAction(leadId, updates);
      if (r?.error) {
        setError(r.error);
        return;
      }

      close(true);
      router.refresh();
    });
  }

  const leadLine = lead
    ? lead.name + (lead.business_name ? " · " + lead.business_name : "")
    : "";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) close(false);
      }}
    >
      <DialogContent className={SHEET}>
        {loadError && (
          <>
            <StepHeader title="How did the call go?" />
            <p className="text-sm text-destructive">
              {loadError}{" "}
              <button type="button" className="underline" onClick={() => close(true)}>
                Close
              </button>
            </p>
          </>
        )}

        {!loadError && view === "outcome" && (
          <>
            <StepHeader title="How did the call go?" sub={leadLine || "Loading…"} />
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                size="xl"
                disabled={!lead || saving}
                onClick={goSpoke}
              >
                Spoke
              </Button>
              <Button
                type="button"
                size="xl"
                variant="outline"
                disabled={!lead || saving}
                onClick={() => saveOutcome("not_picked")}
              >
                Not picked
              </Button>
              <Button
                type="button"
                size="xl"
                variant="outline"
                disabled={!lead || saving}
                onClick={() => saveOutcome("busy")}
              >
                Busy
              </Button>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              {saving
                ? "Saving…"
                : "Not picked and Busy save instantly and keep the lead in Call Pending."}
            </p>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="pb-[env(safe-area-inset-bottom,0px)] text-center">
              <button
                type="button"
                disabled={saving}
                onClick={() => close(true)}
                className="h-9 px-3 text-xs text-muted-foreground underline"
              >
                Skip
              </button>
            </div>
          </>
        )}

        {!loadError && view === "spoke" && lead && (
          <>
            <StepHeader
              title="Spoke · next step"
              sub={leadLine}
              onBack={() => setView("outcome")}
            />

            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Stage</p>
              <StageStrip value={stage} onPick={setStage} />
            </div>

            <div>
              <p className="text-[11px] font-medium text-muted-foreground">
                {needsMeeting ? "Meeting date" : "Callback date"} (required)
              </p>
              <DateStrip value={dateStr} onPick={onPickDate} />
            </div>

            <p
              className={
                "text-center text-sm font-semibold " +
                (pickedOk ? "text-primary" : "text-destructive")
              }
            >
              {picked ? describeWhen(picked) : ""}
              {picked && !pickedOk ? " — pick a future time" : ""}
            </p>
            <TimeWheel value={time} onChange={setTime} />

            {showNote ? (
              <Textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What was discussed?"
              />
            ) : (
              <button
                type="button"
                onClick={() => setShowNote(true)}
                className="h-9 w-fit rounded-full border border-input bg-card px-3 text-xs font-medium"
              >
                + Note
              </button>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter className={FOOTER}>
              <Button
                type="button"
                size="xl"
                className="w-full"
                disabled={saving}
                onClick={saveSpoke}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </>
        )}

        {!loadError && view === "spoke" && !lead && (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
