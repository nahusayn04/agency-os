"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, MessageCircle, X } from "lucide-react";
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
  toWhatsappNumber,
} from "@/lib/crm/call-tracking";
import { appendNote, formatCallbackLabel } from "@/components/crm/crm-dialogs";
import {
  DateStrip,
  StepHeader,
  TimeWheel,
  buildDate,
  dateToStr,
  dateToTimeState,
  defaultTimeFor,
  describeWhen,
  type TimeState,
} from "@/components/crm/datetime-steps";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const SHEET =
  "left-0 top-auto bottom-0 max-w-full translate-x-0 translate-y-0 rounded-b-none max-h-[92dvh] overflow-y-auto " +
  "sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:max-w-sm sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl";
const FOOTER = "sticky bottom-0 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]";

/**
 * Opens automatically after a call made from a CRM "Call" button.
 * Triggers: coming back to the app (tab visible / focus), opening the app
 * fresh with a call still pending, or tapping the "Call ho gayi?" notification.
 */
export function PostCallPrompt() {
  const router = useRouter();
  const [saving, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [lead, setLead] = useState<LeadSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [step, setStep] = useState<"stage" | "more" | "date" | "time">("stage");
  const [target, setTarget] = useState<"callback" | "meeting">("callback");
  const [stage, setStage] = useState<LeadStage | null>(null);
  const [spoke, setSpoke] = useState(true);
  const [cbAt, setCbAt] = useState<Date | null>(null);
  const [mAt, setMAt] = useState<Date | null>(null);
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
    setCbAt(null);
    setMAt(null);
    setStep("stage");
    setSpoke(true);
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
      // "Baad me" — keep it pending, but don't re-pop until the app is
      // backgrounded and reopened again.
      const call = readPendingCall();
      if (call) savePendingCall({ ...call, left: false, startedAt: Date.now() });
    }
    void closePostCallNotifications();
  }

  const needsMeeting = stage === "meeting" && lead?.stage !== "meeting";
  const cbValid = cbAt !== null && cbAt.getTime() > Date.now();
  const meetingOk = !needsMeeting || mAt !== null;
  const canSave = Boolean(lead) && meetingOk && !saving;

  const picked = dateStr ? buildDate(dateStr, time) : null;
  const pickedOk = picked !== null && picked.getTime() > Date.now();

  function startPick(t: "callback" | "meeting") {
    const existing = t === "meeting" ? mAt : cbAt;
    setTarget(t);
    setDateStr(existing ? dateToStr(existing) : "");
    setTime(existing ? dateToTimeState(existing) : { h: 10, m: 0, pm: false });
    setStep("date");
  }

  function goTime() {
    if (!dateStr) return;
    const existing = target === "meeting" ? mAt : cbAt;
    if (!existing || dateToStr(existing) !== dateStr) setTime(defaultTimeFor(dateStr));
    setStep("time");
  }

  function confirmTime() {
    if (!picked || !pickedOk) return;
    if (target === "meeting") setMAt(picked);
    else setCbAt(picked);
    setStep("more");
  }

  function handleNext() {
    if (needsMeeting && !mAt) startPick("meeting");
    else setStep("more");
  }

  function handleSave() {
    if (!lead || !leadId || !canSave) return;
    setError(null);
    startTransition(async () => {
      // 1) stage
      if (stage && stage !== lead.stage) {
        const r = await updateLeadStageAction(
          leadId,
          stage,
          needsMeeting && mAt
            ? { datetime: mAt.toISOString(), note: note.trim() }
            : undefined
        );
        if (r?.error) {
          setError(r.error);
          return;
        }
      }

      // 2) spoke / callback / note
      const updates: Record<string, string> = {};
      if (spoke) updates.last_contact = new Date().toISOString();
      if (cbValid && cbAt) {
        updates.next_followup = cbAt.toISOString();
      } else if ((spoke || (stage && stage !== lead.stage)) && lead.next_followup) {
        // Call handled and no new callback chosen: clear an old/today
        // callback so the lead leaves "Today's Calls" (count goes down).
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);
        if (new Date(lead.next_followup).getTime() <= endOfToday.getTime()) {
          updates.next_followup = "";
        }
      }

      const trimmed = note.trim();
      if (trimmed) {
        // Re-read notes so we never overwrite something edited meanwhile.
        const fresh = await getLeadSnapshotAction(leadId);
        const base = "error" in fresh ? lead.notes : fresh.lead.notes;
        const label =
          "Call " +
          new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" }) +
          (cbValid && cbAt ? ` (callback ${formatCallbackLabel(cbAt.toISOString())})` : "");
        updates.notes = appendNote(base, label, trimmed);
      }

      if (Object.keys(updates).length > 0) {
        const r = await updateLeadAction(leadId, updates);
        if (r?.error) {
          setError(r.error);
          return;
        }
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
            <StepHeader title="Call ho gayi?" />
            <p className="text-sm text-destructive">
              {loadError}{" "}
              <button type="button" className="underline" onClick={() => close(true)}>
                Band karo
              </button>
            </p>
          </>
        )}

        {!lead && !loadError && (
          <>
            <StepHeader title="Call ho gayi?" />
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          </>
        )}

        {lead && step === "stage" && (
          <>
            <StepHeader title="Call ho gayi?" sub={`Step 1/2 · ${leadLine}`} />
            <div className="grid grid-cols-3 gap-1.5">
              {LEAD_STAGES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStage(s)}
                  className={
                    "flex h-11 items-center justify-center gap-1 rounded-xl border px-1 text-[13px] font-medium transition-colors " +
                    (stage === s
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-card text-foreground")
                  }
                >
                  {stage === s && <Check size={13} />}
                  {LEAD_STAGE_LABELS[s]}
                </button>
              ))}
            </div>
            <DialogFooter className={FOOTER + " grid grid-cols-3 gap-2"}>
              <Button
                type="button"
                size="xl"
                variant="ghost"
                disabled={saving}
                onClick={() => close(true)}
              >
                Skip
              </Button>
              <Button
                type="button"
                size="xl"
                variant="outline"
                disabled={!canSave || needsMeeting}
                onClick={handleSave}
              >
                {saving ? "…" : "Save"}
              </Button>
              <Button type="button" size="xl" onClick={handleNext}>
                Next
              </Button>
            </DialogFooter>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </>
        )}

        {lead && step === "more" && (
          <>
            <StepHeader
              title="Aage kya?"
              sub={`Step 2/2 · ${leadLine}`}
              onBack={() => setStep("stage")}
            />

            {needsMeeting && (
              <button
                type="button"
                onClick={() => startPick("meeting")}
                className="flex h-12 items-center justify-between rounded-xl border border-input bg-card px-3 text-sm"
              >
                <span className="text-muted-foreground">Meeting</span>
                <span className="flex items-center gap-1 font-semibold text-primary">
                  {mAt ? describeWhen(mAt) : "Set karo"} <ChevronRight size={16} />
                </span>
              </button>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => startPick("callback")}
                className="flex h-12 flex-1 items-center justify-between rounded-xl border border-input bg-card px-3 text-sm"
              >
                <span className="text-muted-foreground">Callback</span>
                <span className="flex items-center gap-1 font-semibold text-primary">
                  {cbAt ? describeWhen(cbAt) : "Set karo"} <ChevronRight size={16} />
                </span>
              </button>
              {cbAt && (
                <button
                  type="button"
                  aria-label="Callback hatao"
                  onClick={() => setCbAt(null)}
                  className="flex h-12 w-12 items-center justify-center rounded-xl border border-input bg-card text-muted-foreground"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {showNote && (
              <Textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Kya baat hui?"
              />
            )}

            <div className="flex flex-wrap items-center gap-2">
              {!showNote && (
                <button
                  type="button"
                  onClick={() => setShowNote(true)}
                  className="h-9 rounded-full border border-input bg-card px-3 text-xs font-medium"
                >
                  + Note
                </button>
              )}
              <button
                type="button"
                onClick={() => setSpoke((v) => !v)}
                className={
                  "flex h-9 items-center gap-1 rounded-full border px-3 text-xs font-medium " +
                  (spoke
                    ? "border-primary bg-accent text-primary"
                    : "border-input bg-card text-muted-foreground")
                }
              >
                {spoke && <Check size={12} />} Baat hui
              </button>
              {lead.phone && (
                <a
                  href={"https://wa.me/" + toWhatsappNumber(lead.phone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 items-center gap-1 rounded-full bg-green-50 px-3 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400"
                >
                  <MessageCircle size={13} /> WhatsApp
                </a>
              )}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter className={FOOTER}>
              <Button
                type="button"
                size="xl"
                className="w-full"
                disabled={!canSave}
                onClick={handleSave}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </>
        )}

        {lead && step === "date" && (
          <>
            <StepHeader
              title={target === "meeting" ? "Meeting kab?" : "Callback kab?"}
              sub="Date"
              onBack={() => setStep(target === "meeting" ? "stage" : "more")}
            />
            <DateStrip value={dateStr} onPick={setDateStr} />
            <DialogFooter className={FOOTER}>
              <Button
                type="button"
                size="xl"
                className="w-full"
                disabled={!dateStr}
                onClick={goTime}
              >
                Next
              </Button>
            </DialogFooter>
          </>
        )}

        {lead && step === "time" && (
          <>
            <StepHeader title="Time chuno" sub="Time" onBack={() => setStep("date")} />
            <p
              className={
                "text-center text-sm font-semibold " +
                (pickedOk ? "text-primary" : "text-destructive")
              }
            >
              {picked ? describeWhen(picked) : ""}
              {picked && !pickedOk ? " — future ka time chuno" : ""}
            </p>
            <TimeWheel value={time} onChange={setTime} />
            <DialogFooter className={FOOTER}>
              <Button
                type="button"
                size="xl"
                className="w-full"
                disabled={!pickedOk}
                onClick={confirmTime}
              >
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
