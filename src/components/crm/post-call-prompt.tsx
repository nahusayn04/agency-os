"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, MessageCircle } from "lucide-react";
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
import {
  appendNote,
  formatCallbackLabel,
  toDateInputValue,
} from "@/components/crm/crm-dialogs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const SHEET =
  "left-0 top-auto bottom-0 max-w-full translate-x-0 translate-y-0 rounded-b-none max-h-[92dvh] overflow-y-auto " +
  "sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:max-w-sm sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl";
const FOOTER = "sticky bottom-0 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]";
const FIELD =
  "flex h-11 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20";

function addDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

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

  const [stage, setStage] = useState<LeadStage | null>(null);
  const [spoke, setSpoke] = useState(true);
  const [cbDate, setCbDate] = useState("");
  const [cbTime, setCbTime] = useState("");
  const [mDate, setMDate] = useState("");
  const [mTime, setMTime] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const openFor = useCallback(async (id: string) => {
    setLeadId(id);
    setLead(null);
    setLoadError(null);
    setError(null);
    setNote("");
    setCbDate("");
    setCbTime("");
    setMDate("");
    setMTime("");
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

  const cbPicked = cbDate && cbTime ? new Date(`${cbDate}T${cbTime}`) : null;
  const cbValid = cbPicked !== null && cbPicked.getTime() > Date.now();
  const cbTouched = Boolean(cbDate || cbTime);
  const needsMeeting = stage === "meeting" && lead?.stage !== "meeting";
  const mPicked = mDate && mTime ? new Date(`${mDate}T${mTime}`) : null;
  const meetingOk = !needsMeeting || (mPicked !== null && !isNaN(mPicked.getTime()));
  const canSave =
    Boolean(lead) && meetingOk && (!cbTouched || cbValid) && !saving;

  function pickTomorrow() {
    setCbDate(toDateInputValue(addDays(1)));
    if (!cbTime) setCbTime("10:00");
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
          needsMeeting && mPicked
            ? { datetime: mPicked.toISOString(), note: note.trim() }
            : undefined
        );
        if (r?.error) {
          setError(r.error);
          return;
        }
      }

      // 2) spoke / callback / note
      const updates: Record<string, string> = {};
      const nowIso = new Date().toISOString();
      if (spoke) updates.last_contact = nowIso;
      if (cbValid && cbPicked) {
        updates.next_followup = cbPicked.toISOString();
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
          (cbValid && cbPicked
            ? ` (callback ${formatCallbackLabel(cbPicked.toISOString())})`
            : "");
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

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) close(false);
      }}
    >
      <DialogContent className={SHEET}>
        <DialogHeader>
          <DialogTitle>Call ho gayi?</DialogTitle>
          {lead && (
            <p className="text-sm text-muted-foreground">
              {lead.name}
              {lead.business_name ? " · " + lead.business_name : ""}
            </p>
          )}
        </DialogHeader>

        {loadError && (
          <p className="text-sm text-destructive">
            {loadError}{" "}
            <button
              type="button"
              className="underline"
              onClick={() => close(true)}
            >
              Band karo
            </button>
          </p>
        )}

        {!lead && !loadError && (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
        )}

        {lead && (
          <>
            {/* Stage */}
            <div className="space-y-1.5">
              <Label>Stage</Label>
              <div className="grid grid-cols-2 gap-2">
                {LEAD_STAGES.map((s) => (
                  <Button
                    key={s}
                    type="button"
                    size="lg"
                    variant={stage === s ? "primary" : "outline"}
                    className="w-full"
                    onClick={() => setStage(s)}
                  >
                    {stage === s && <Check />}
                    {LEAD_STAGE_LABELS[s]}
                  </Button>
                ))}
              </div>
            </div>

            {needsMeeting && (
              <div className="space-y-1.5">
                <Label>Meeting kab hai? (zaroori)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={mDate}
                    min={toDateInputValue(new Date())}
                    onChange={(e) => setMDate(e.target.value)}
                    className={FIELD}
                  />
                  <input
                    type="time"
                    value={mTime}
                    step={900}
                    onChange={(e) => setMTime(e.target.value)}
                    className={FIELD}
                  />
                </div>
              </div>
            )}

            {/* Callback */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Callback (optional)</Label>
                <Button
                  type="button"
                  size="xs"
                  variant={
                    cbDate === toDateInputValue(addDays(1)) ? "primary" : "secondary"
                  }
                  onClick={pickTomorrow}
                >
                  Kal
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={cbDate}
                  min={toDateInputValue(new Date())}
                  onChange={(e) => setCbDate(e.target.value)}
                  className={FIELD}
                />
                <input
                  type="time"
                  value={cbTime}
                  step={900}
                  onChange={(e) => setCbTime(e.target.value)}
                  className={FIELD}
                />
              </div>
              {cbTouched && !cbValid && (
                <p className="text-xs text-destructive">
                  Date aur time dono daalo (future ka).
                </p>
              )}
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <Label htmlFor="postcall-note">Note (optional)</Label>
              <Textarea
                id="postcall-note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Kya baat hui?"
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={spoke}
                onChange={(e) => setSpoke(e.target.checked)}
                className="h-4 w-4"
              />
              Baat hui (Spoke mark karo)
            </label>

            {lead.phone && (
              <a
                href={"https://wa.me/" + toWhatsappNumber(lead.phone)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 items-center justify-center gap-2 rounded-xl bg-green-50 text-sm font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400"
              >
                <MessageCircle size={16} /> WhatsApp bhejo
              </a>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter className={FOOTER + " gap-2"}>
              <Button
                type="button"
                size="xl"
                variant="ghost"
                onClick={() => close(true)}
                disabled={saving}
              >
                Skip
              </Button>
              <Button
                type="button"
                size="xl"
                className="flex-1"
                disabled={!canSave}
                onClick={handleSave}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
