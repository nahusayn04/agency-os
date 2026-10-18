"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus } from "lucide-react";
import { createLeadAction } from "@/lib/crm/actions";
import { LEAD_STAGE_LABELS, type LeadStage } from "@/lib/types/crm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

/* -------------------------------------------------------------------------- */
/* Shared helpers                                                             */
/* -------------------------------------------------------------------------- */

// Bottom sheet on phones, centered popup from `sm` up. Layered on top of the
// existing DialogContent classes (tailwind-merge resolves the overrides).
const SHEET =
  "left-0 top-auto bottom-0 max-w-full translate-x-0 translate-y-0 rounded-b-none max-h-[90dvh] overflow-y-auto " +
  "sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:max-w-sm sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl";

const FOOTER = "sticky bottom-0 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]";

const NATIVE_FIELD =
  "flex h-11 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20";

export function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function toTimeInputValue(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function addDays(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function shortDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function timeLabel(d: Date): string {
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** "17 Oct" — shown under the Spoke button. */
export function formatSpokeLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : shortDate(d);
}

/** "18 Oct, 4:00 PM" — shown under the Callback button. */
export function formatCallbackLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : `${shortDate(d)}, ${timeLabel(d)}`;
}

/** "18 Oct, 16:00" — 24-hour, only for the CRM card's Callback button. */
export function formatCallbackButtonLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return `${shortDate(d)}, ${time}`;
}

/** Appends a dated line to the lead's existing notes. */
export function appendNote(
  existing: string | null,
  label: string,
  note: string
): string {
  const line = `${label}: ${note}`;
  return existing?.trim() ? `${existing.trim()}\n${line}` : line;
}

function BigChoice({
  selected,
  onClick,
  disabled,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="xl"
      variant={selected ? "primary" : "outline"}
      disabled={disabled}
      onClick={onClick}
      className="w-full"
    >
      {selected && <Check />}
      {children}
    </Button>
  );
}

/* -------------------------------------------------------------------------- */
/* 1. Spoke                                                                   */
/* -------------------------------------------------------------------------- */

/** One slidable row of earlier days (before yesterday), oldest on the left. */
function PastDateStrip({
  value,
  onPick,
}: {
  value: string;
  onPick: (dateStr: string) => void;
}) {
  const rowRef = useRef<HTMLDivElement | null>(null);

  const days: Date[] = [];
  for (let i = 14; i >= 2; i--) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - i);
    days.push(d);
  }

  // Start at the newest end so the days closest to today are visible.
  useEffect(() => {
    const el = rowRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  return (
    <div
      ref={rowRef}
      className="scrollbar-hide -mx-4 flex snap-x gap-2 overflow-x-auto px-4 py-1"
    >
      {days.map((d) => {
        const ds = dateToStr(d);
        const selected = ds === value;
        return (
          <button
            key={ds}
            type="button"
            onClick={() => onPick(ds)}
            className={
              "flex h-[72px] w-[58px] shrink-0 snap-start flex-col items-center justify-center rounded-2xl border text-center transition-colors " +
              (selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-card text-foreground")
            }
          >
            <span className="text-[11px] font-medium opacity-80">
              {d.toLocaleDateString("en-IN", { weekday: "short" })}
            </span>
            <span className="text-xl font-bold leading-tight">
              {d.getDate()}
            </span>
            <span className="text-[10px] opacity-70">
              {d.toLocaleDateString("en-IN", { month: "short" })}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function SpokeDialog({
  open,
  onOpenChange,
  pending,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  onSave: (iso: string, note: string) => void;
}) {
  const today = toDateInputValue(new Date());
  const yesterday = toDateInputValue(addDays(-1));

  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setDate(toDateInputValue(new Date()));
    setNote("");
  }, [open]);

  const picked = new Date(`${date}T12:00:00`);
  const pickedLabel = isNaN(picked.getTime())
    ? ""
    : (date === today
        ? "Today, "
        : date === yesterday
          ? "Yesterday, "
          : picked.toLocaleDateString("en-IN", { weekday: "short" }) + ", ") +
      shortDate(picked);

  function handleSave() {
    if (!date) return;
    const iso =
      date === today
        ? new Date().toISOString()
        : new Date(`${date}T12:00:00`).toISOString();
    onSave(iso, note.trim());
  }

  return (
    <Dialog open={open} onOpenChange={(o) => onOpenChange(o)}>
      <DialogContent className={SHEET}>
        <DialogHeader>
          <DialogTitle>When did you speak?</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          <BigChoice selected={date === today} onClick={() => setDate(today)}>
            Today
          </BigChoice>
          <BigChoice
            selected={date === yesterday}
            onClick={() => setDate(yesterday)}
          >
            Yesterday
          </BigChoice>
        </div>

        <div className="space-y-1.5">
          <Label>Or an earlier date</Label>
          <PastDateStrip value={date} onPick={setDate} />
          <p className="text-center text-sm font-semibold text-primary">
            {pickedLabel}
          </p>
        </div>

        <Input
          id="spoke-note"
          aria-label="Note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note (optional)"
          autoComplete="off"
        />

        <DialogFooter className={FOOTER}>
          <Button
            type="button"
            size="xl"
            className="w-full"
            disabled={!date || pending}
            onClick={handleSave}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Callback                                                                */
/* -------------------------------------------------------------------------- */

export function CallbackDialog({
  open,
  onOpenChange,
  initialIso,
  pending,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialIso: string | null;
  pending: boolean;
  onSave: (iso: string, note: string) => void;
}) {
  const [step, setStep] = useState<"date" | "time">("date");
  const [dateStr, setDateStr] = useState("");
  const [time, setTime] = useState<TimeState>({ h: 10, m: 0, pm: false });
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);

  useEffect(() => {
    if (!open) return;
    const base = initialIso ? new Date(initialIso) : null;
    const usable = base && !isNaN(base.getTime()) && base.getTime() > Date.now();
    setStep("date");
    setDateStr(usable ? dateToStr(base) : "");
    setTime(usable ? dateToTimeState(base) : { h: 10, m: 0, pm: false });
    setNote("");
    setShowNote(false);
  }, [open, initialIso]);

  const picked = dateStr ? buildDate(dateStr, time) : null;
  const inFuture = picked !== null && picked.getTime() > Date.now();

  function goTime() {
    if (!dateStr) return;
    // First time here for this date: start from a sensible time.
    const existing = initialIso ? new Date(initialIso) : null;
    const sameDay = existing && dateToStr(existing) === dateStr;
    if (!sameDay) setTime(defaultTimeFor(dateStr));
    setStep("time");
  }

  function handleSave() {
    if (!picked || !inFuture) return;
    onSave(picked.toISOString(), note.trim());
  }

  return (
    <Dialog open={open} onOpenChange={(o) => onOpenChange(o)}>
      <DialogContent className={SHEET}>
        {step === "date" ? (
          <>
            <StepHeader title="Callback kab?" sub="Step 1/2 · Date" />
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
        ) : (
          <>
            <StepHeader
              title="Time chuno"
              sub="Step 2/2 · Time"
              onBack={() => setStep("date")}
            />
            <p
              className={
                "text-center text-sm font-semibold " +
                (inFuture ? "text-primary" : "text-destructive")
              }
            >
              {picked ? describeWhen(picked) : ""}
              {picked && !inFuture ? " — future ka time chuno" : ""}
            </p>
            <TimeWheel value={time} onChange={setTime} />
            {showNote ? (
              <Textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optional)"
              />
            ) : (
              <button
                type="button"
                onClick={() => setShowNote(true)}
                className="mx-auto text-xs font-medium text-primary"
              >
                + Note
              </button>
            )}
            <DialogFooter className={FOOTER}>
              <Button
                type="button"
                size="xl"
                className="w-full"
                disabled={!inFuture || pending}
                onClick={handleSave}
              >
                Save
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. Move (stage change)                                                     */
/* -------------------------------------------------------------------------- */

export function MoveDialog({
  open,
  onOpenChange,
  currentStage,
  stages,
  pending,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentStage: LeadStage;
  stages: LeadStage[];
  pending: boolean;
  onPick: (stage: LeadStage) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => onOpenChange(o)}>
      <DialogContent className={SHEET}>
        <DialogHeader>
          <DialogTitle>Move to</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 pb-[env(safe-area-inset-bottom,0px)]">
          {stages.map((s) => (
            <BigChoice
              key={s}
              selected={s === currentStage}
              disabled={pending}
              onClick={() => {
                onOpenChange(false);
                if (s !== currentStage) onPick(s);
              }}
            >
              {LEAD_STAGE_LABELS[s]}
            </BigChoice>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* 3b. Meeting date-time step (move into Meeting + reschedule)                */
/* -------------------------------------------------------------------------- */

export function MeetingDialog({
  open,
  mode,
  initialDatetime,
  initialNote,
  pending,
  onClose,
  onConfirm,
}: {
  open: boolean;
  mode: "schedule" | "reschedule";
  initialDatetime: string | null;
  initialNote: string | null;
  pending: boolean;
  onClose: () => void;
  onConfirm: (isoDatetime: string, note: string) => void;
}) {
  const [step, setStep] = useState<"date" | "time">("date");
  const [dateStr, setDateStr] = useState("");
  const [time, setTime] = useState<TimeState>({ h: 10, m: 0, pm: false });
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);

  useEffect(() => {
    if (!open) return;
    const base = initialDatetime ? new Date(initialDatetime) : null;
    const ok = base && !isNaN(base.getTime());
    setStep("date");
    setDateStr(ok ? dateToStr(base) : "");
    setTime(ok ? dateToTimeState(base) : { h: 10, m: 0, pm: false });
    setNote(initialNote ?? "");
    setShowNote(Boolean(initialNote));
  }, [open, initialDatetime, initialNote]);

  const picked = dateStr ? buildDate(dateStr, time) : null;
  const canConfirm = picked !== null && !isNaN(picked.getTime());

  function goTime() {
    if (!dateStr) return;
    const existing = initialDatetime ? new Date(initialDatetime) : null;
    const sameDay = existing && !isNaN(existing.getTime()) && dateToStr(existing) === dateStr;
    if (!sameDay) setTime(defaultTimeFor(dateStr));
    setStep("time");
  }

  function handleConfirm() {
    if (!picked || !canConfirm) return;
    onConfirm(picked.toISOString(), note.trim());
  }

  const title = mode === "schedule" ? "Meeting kab?" : "Meeting reschedule";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={SHEET}>
        {step === "date" ? (
          <>
            <StepHeader title={title} sub="Step 1/2 · Date" />
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
        ) : (
          <>
            <StepHeader title="Time chuno" sub="Step 2/2 · Time" onBack={() => setStep("date")} />
            <p className="text-center text-sm font-semibold text-primary">
              {picked ? describeWhen(picked) : ""}
            </p>
            <TimeWheel value={time} onChange={setTime} />
            {showNote ? (
              <Textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Agenda / what to discuss..."
              />
            ) : (
              <button
                type="button"
                onClick={() => setShowNote(true)}
                className="mx-auto text-xs font-medium text-primary"
              >
                + Note
              </button>
            )}
            <DialogFooter className={FOOTER}>
              <Button
                type="button"
                size="xl"
                className="w-full"
                disabled={!canConfirm || pending}
                onClick={handleConfirm}
              >
                Save
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* 4. Create lead                                                             */
/* -------------------------------------------------------------------------- */

export function NewLeadDialog({
  users,
  currentUserId,
}: {
  users: { id: string; name: string }[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setError(null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);
    const get = (k: string) => String(form.get(k) ?? "").trim();

    const name = get("name");
    const address = get("address");
    const business = get("business");
    const phone = get("phone");

    if (!name || !address || !phone) {
      setError("Name, address and phone are required.");
      return;
    }
    if (phone.replace(/\D/g, "").length < 10) {
      setError("Enter a valid phone number.");
      return;
    }

    // The leads table has a single text column for this; keep both parts.
    const businessName = business ? `${business} — ${address}` : address;

    const fd = new FormData();
    fd.set("name", name);
    fd.set("business_name", businessName);
    fd.set("phone", phone);
    fd.set("stage", "new_lead");
    fd.set("assigned_to", get("assigned_to") || currentUserId);
    if (get("deal_value")) fd.set("deal_value", get("deal_value"));
    if (get("notes")) fd.set("notes", get("notes"));

    startTransition(async () => {
      const result = await createLeadAction(fd);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        aria-label="New lead"
        onClick={() => setOpen(true)}
        className="flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow-card transition-transform active:scale-95"
      >
        <Plus size={18} />
        New Lead
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className={SHEET}>
          <DialogHeader>
            <DialogTitle>New lead</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nl-name">Name *</Label>
              <Input id="nl-name" name="name" placeholder="Contact person" autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nl-address">Address *</Label>
              <Input id="nl-address" name="address" placeholder="Area, city" autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nl-phone">Phone *</Label>
              <Input
                id="nl-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                placeholder="+91"
                autoComplete="off"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nl-business">Business (optional)</Label>
              <Input id="nl-business" name="business" placeholder="Clinic / shop name" autoComplete="off" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="nl-value">Deal value</Label>
                <Input
                  id="nl-value"
                  name="deal_value"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nl-assignee">Assignee</Label>
                <select
                  id="nl-assignee"
                  name="assigned_to"
                  defaultValue={currentUserId}
                  className={NATIVE_FIELD}
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                      {u.id === currentUserId ? " (You)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nl-notes">Note (optional)</Label>
              <Textarea id="nl-notes" name="notes" rows={2} placeholder="What was discussed?" />
            </div>

            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
                {error}
              </p>
            )}

            <DialogFooter className={FOOTER}>
              <Button type="submit" size="xl" className="w-full" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
