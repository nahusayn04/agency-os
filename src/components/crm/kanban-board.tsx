"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Send, Star } from "lucide-react";
import {
  updateLeadStageAction,
  updateLeadAssigneeAction,
  updateLeadAction,
  bulkUpdateLeadStageAction,
  bulkUpdateLeadAssigneeAction,
  rescheduleMeetingAction,
  deleteLeadAction,
  bulkDeleteLeadsAction,
  toggleLeadHotAction,
  toggleLeadProspectAction,
  setLeadCategoryAction,
} from "@/lib/crm/actions";
import {
  ASSIGNEE_CHANGEABLE_STAGES,
  LEAD_STAGE_LABELS,
  type LeadStage,
  type MeetingHistoryEntry,
} from "@/lib/types/crm";
import {
  CallbackDialog,
  MeetingDialog,
  MoveDialog,
  SpokeDialog,
  appendNote,
  formatCallbackLabel,
  formatCallbackButtonLabel,
  formatSpokeLabel,
} from "@/components/crm/crm-dialogs";
import { CallLink } from "@/components/crm/call-link";
import { useCrmFilters } from "@/components/crm/crm-filters";
import { BulkMenu } from "@/components/crm/crm-bulk-menu";
import { CategoryPicker } from "@/components/crm/category-picker";
import {
  categoryKey,
  getLeadCategory,
  normalizeCategory,
  OTHER_CATEGORY,
} from "@/lib/crm/lead-category";
import {
  ProspectResearch,
  type ProspectResearchSaved,
} from "@/components/crm/prospect-research";

export interface AssignableUser {
  id: string;
  name: string;
}

export interface KanbanLead {
  id: string;
  name: string;
  business_name: string | null;
  phone: string | null;
  deal_value: number | null;
  stage: LeadStage;
  last_contact: string | null;
  next_followup: string | null;
  meeting_datetime: string | null;
  meeting_note: string | null;
  meeting_history: MeetingHistoryEntry[];
  notes: string | null;
  is_hot_lead: boolean;
  // Prospect research panel (JSONB, only used on Prospects-stage cards)
  online_presence?: unknown;
  competitors?: unknown;
  checklist?: unknown;
  /** Manual category tag; null = auto-guessed from the name. */
  category?: string | null;
  assignee: { id: string; name: string };
}

interface KanbanBoardProps {
  leads: KanbanLead[];
  stages: LeadStage[];
  assignableUsers: AssignableUser[];
  canReassign: boolean;
  currentUserId: string;
}

function getFollowupBucket(iso: string | null): "overdue" | "due_today" | "upcoming" | "not_set" {
  if (!iso) return "not_set";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "not_set";

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  if (d.getTime() < startOfToday.getTime()) return "overdue";
  if (d.getTime() < startOfTomorrow.getTime()) return "due_today";
  return "upcoming";
}

/**
 * Long-press trigger (mobile touch + desktop mouse click-and-hold), used
 * only for the delete-confirmation prompt (`onExtraLongPress`, default
 * 9s). Ignores presses that start on an interactive child (buttons, links,
 * inputs) so it never hijacks the existing Move / assignee / date-chip
 * taps, and cancels itself if the finger/cursor moves (i.e. the user was
 * scrolling/dragging, not holding) or the mouse button is released early.
 * A light tap/click or plain mouse hover never triggers it.
 */
function useLongPress(
  onLongPress: () => void,
  ms = 5000,
  onExtraLongPress?: () => void,
  extraMs = 9000
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const extraTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const movedRef = useRef(false);

  function clear() {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (extraTimerRef.current) clearTimeout(extraTimerRef.current);
    timerRef.current = null;
    extraTimerRef.current = null;
  }

  function start(target: HTMLElement) {
    if (target.closest("button, a, input, label")) return;
    movedRef.current = false;
    clear();
    timerRef.current = setTimeout(() => {
      if (!movedRef.current) onLongPress();
    }, ms);
    if (onExtraLongPress) {
      extraTimerRef.current = setTimeout(() => {
        if (!movedRef.current) onExtraLongPress();
      }, extraMs);
    }
  }

  function onTouchStart(e: React.TouchEvent) {
    start(e.target as HTMLElement);
  }

  function onTouchMove() {
    movedRef.current = true;
    clear();
  }

  function onMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return; // left click only
    start(e.target as HTMLElement);
  }

  function onMouseMove() {
    // Only matters while a hold is in progress; harmless no-op otherwise.
    if (timerRef.current || extraTimerRef.current) {
      movedRef.current = true;
      clear();
    }
  }

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd: clear,
    onTouchCancel: clear,
    onMouseDown,
    onMouseMove,
    onMouseUp: clear,
    onMouseLeave: clear,
  };
}

const STAGE_COLORS: Record<
  LeadStage,
  { tab: string; badge: string; dot: string }
> = {
  new_lead: {
    tab: "text-blue-700 dark:text-blue-400",
    badge: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
    dot: "bg-blue-500",
  },
  call_pending: {
    tab: "text-yellow-700 dark:text-yellow-400",
    badge: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800",
    dot: "bg-yellow-500",
  },
  interested: {
    tab: "text-purple-700 dark:text-purple-400",
    badge: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800",
    dot: "bg-purple-500",
  },
  hot_lead: {
    tab: "text-amber-700 dark:text-amber-400",
    badge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
    dot: "bg-amber-500",
  },
  meeting: {
    tab: "text-cyan-700 dark:text-cyan-400",
    badge: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800",
    dot: "bg-cyan-500",
  },
  negotiation: {
    tab: "text-orange-700 dark:text-orange-400",
    badge: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800",
    dot: "bg-orange-500",
  },
  deal_won: {
    tab: "text-green-700 dark:text-green-400",
    badge: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
    dot: "bg-green-500",
  },
  deal_lost: {
    tab: "text-red-700 dark:text-red-400",
    badge: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
    dot: "bg-red-500",
  },
};

function toWhatsappNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return "91" + digits;
  if (digits.length === 11 && digits.startsWith("0")) return "91" + digits.slice(1);
  return digits;
}

function AssigneeDropdown({
  currentAssignee,
  users,
  disabled,
  onSelect,
}: {
  currentAssignee: { id: string; name: string };
  users: AssignableUser[];
  disabled: boolean;
  onSelect: (userId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    // small delay so the same click that opens it doesn't also close it
    const focusTimer = setTimeout(() => inputRef.current?.focus(), 30);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      clearTimeout(focusTimer);
    };
  }, [open]);

  const filtered = users.filter((u) =>
    u.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  if (!users.length) {
    // no permission / nothing to pick from — plain text
    return (
      <span className="text-xs text-muted-foreground">
        {currentAssignee.name}
      </span>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setQuery("");
          setOpen((v) => !v);
        }}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:pointer-events-none max-w-[140px]"
      >
        <span className="truncate">{currentAssignee.name}</span>
        <svg
          viewBox="0 0 24 24"
          width="11"
          height="11"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="shrink-0"
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1.5 w-56 max-w-[80vw] glass-card rounded-lg shadow-lg overflow-hidden">
          <div className="p-1.5 border-b">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name..."
              className="glass-card w-full rounded-md px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                No matches.
              </p>
            ) : (
              filtered.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    if (u.id !== currentAssignee.id) onSelect(u.id);
                  }}
                  className={
                    "flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-muted " +
                    (u.id === currentAssignee.id
                      ? "text-foreground font-medium"
                      : "text-muted-foreground")
                  }
                >
                  <span className="truncate">{u.name}</span>
                  {u.id === currentAssignee.id && (
                    <svg
                      viewBox="0 0 24 24"
                      width="12"
                      height="12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className="shrink-0 text-primary"
                    >
                      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function isOverdue(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}

function formatMeetingDateTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function SpokeChip({
  lead,
  disabled,
  onSave,
}: {
  lead: KanbanLead;
  disabled: boolean;
  onSave: (iso: string, note: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="flex w-full flex-col items-center justify-center rounded-lg bg-accent/60 px-1 py-1.5 text-center text-xs font-bold text-primary/80 transition-colors disabled:opacity-50"
      >
        <span>Spoke</span>
        <span className="w-full truncate text-[10px] font-normal leading-tight text-primary/60">
          {formatSpokeLabel(lead.last_contact) || "\u00A0"}
        </span>
      </button>

      <SpokeDialog
        open={open}
        onOpenChange={setOpen}
        pending={disabled}
        onSave={(iso, note) => {
          setOpen(false);
          onSave(iso, note);
        }}
      />
    </>
  );
}

function CallbackChip({
  lead,
  disabled,
  onSave,
}: {
  lead: KanbanLead;
  disabled: boolean;
  onSave: (iso: string, note: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const bucket = getFollowupBucket(lead.next_followup);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={
          "flex w-full flex-col items-center justify-center rounded-lg px-1 py-1.5 text-center text-xs font-bold transition-colors disabled:opacity-50 " +
          (bucket === "overdue"
            ? "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
            : bucket === "due_today"
              ? "bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
              : "bg-accent/60 text-primary/80")
        }
      >
        <span>Callback</span>
        <span className="w-full truncate text-[10px] font-normal leading-tight opacity-60">
          {formatCallbackButtonLabel(lead.next_followup) || "\u00A0"}
        </span>
      </button>

      <CallbackDialog
        open={open}
        onOpenChange={setOpen}
        initialIso={lead.next_followup}
        pending={disabled}
        onSave={(iso, note) => {
          setOpen(false);
          onSave(iso, note);
        }}
      />
    </>
  );
}

/**
 * Gated stage-transition popup: mandatory date + time before a lead can
 * move into "Meeting", and reused as-is for rescheduling an existing
 * meeting. No skip option — a lead can't be in the Meeting stage
 * without an actual scheduled time (that's the whole point).
 */
function DeleteConfirmModal({
  open,
  leadName,
  count,
  pending,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  leadName: string | null;
  count?: number;
  pending: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  const isBulk = !!count && count > 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm glass-card rounded-xl p-4 space-y-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="font-semibold text-sm">
            {isBulk ? `Delete ${count} leads?` : "Delete this lead?"}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isBulk
              ? `${count} leads will be removed from every CRM view (board, search, dashboards). Their history stays on record.`
              : `${leadName ? `"${leadName}"` : "This lead"} will be removed from every CRM view (board, search, dashboards). Its history stays on record.`}
          </p>
          {error && (
            <p className="text-xs text-destructive mt-2 border border-destructive/30 rounded-md px-2 py-1.5 bg-destructive/5">
              {error}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="flex-1 text-sm px-3 py-2 rounded-md border hover:bg-muted transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="flex-1 text-sm px-3 py-2 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
          >
            {pending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MeetingChip({
  lead,
  disabled,
  onClick,
}: {
  lead: KanbanLead;
  disabled: boolean;
  onClick: () => void;
}) {
  if (!lead.meeting_datetime) return null;

  const overdue = isOverdue(lead.meeting_datetime);
  const meetingNo = lead.meeting_history.length + 1;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={
        "text-[11px] px-1.5 py-1 rounded-md border transition-colors disabled:opacity-50 text-left w-full " +
        (overdue
          ? "border-red-200 text-red-600 bg-red-50 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400"
          : "border-cyan-200 text-cyan-700 bg-cyan-50 dark:border-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300")
      }
    >
      <span className="block">
        📍 {meetingNo > 1 ? `#${meetingNo} ` : ""}
        {formatMeetingDateTime(lead.meeting_datetime)}
        {overdue ? " · Overdue ⚠️" : ""}
      </span>
      {lead.meeting_note && (
        <span className="block text-muted-foreground truncate max-w-[180px] font-normal">
          {lead.meeting_note}
        </span>
      )}
    </button>
  );
}

function NotePreview({
  leadId,
  note,
  pending,
  onSave,
}: {
  leadId: string;
  note: string | null;
  pending: boolean;
  onSave: (id: string, note: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note ?? "");

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setDraft(note ?? "");
    setEditing(true);
  }

  function cancelEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setEditing(false);
  }

  function saveEdit(e: React.MouseEvent) {
    e.stopPropagation();
    const trimmed = draft.trim();
    if (trimmed && trimmed !== (note ?? "")) {
      onSave(leadId, trimmed);
    }
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          className="w-full text-[11px] rounded-md border border-border bg-background px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <div className="flex justify-end gap-1.5">
          <button
            type="button"
            onClick={cancelEdit}
            disabled={pending}
            className="text-[11px] text-muted-foreground hover:text-foreground border rounded px-1.5 py-0.5 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={saveEdit}
            disabled={pending || !draft.trim()}
            className="text-[11px] text-primary-foreground bg-primary hover:bg-primary/90 rounded px-1.5 py-0.5 transition-colors disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  if (!note) {
    return (
      <button
        type="button"
        onClick={startEdit}
        className="text-[11px] text-muted-foreground hover:text-foreground text-left w-full rounded-md border border-dashed border-border/50 px-1.5 py-1 hover:bg-muted/30 transition-colors"
      >
        + Add note
      </button>
    );
  }

  return (
    <div className="group/note flex items-start gap-1">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded((v) => !v);
        }}
        className="text-[11px] text-muted-foreground text-left flex-1 min-w-0 rounded-md border border-border/50 bg-muted/30 px-1.5 py-1 hover:bg-muted/50 transition-colors"
      >
        <span className={expanded ? "block whitespace-pre-wrap break-words" : "block truncate"}>
          📝 {note}
        </span>
      </button>
      <button
        type="button"
        onClick={startEdit}
        title="Edit note"
        aria-label="Edit note"
        className="shrink-0 text-muted-foreground/50 hover:text-foreground transition-colors px-0.5"
      >
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 20h9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

function LeadCard({
  lead,
  onStageChange,
  onAssigneeChange,
  onDateChange,
  onNoteChange,
  onToggleHot,
  onResearchSaved,
  onToggleProspect,
  onCategoryChange,
  onRequestMeetingMove,
  onRequestReschedule,
  onRequestDelete,
  stages,
  pending,
  assignableUsers,
  canReassign,
  canSelect,
  canDelete,
  selected,
  selectionActive,
  onToggleSelect,
  focused,
  onFocus,
}: {
  lead: KanbanLead;
  onStageChange: (id: string, stage: LeadStage) => void;
  onAssigneeChange: (id: string, userId: string) => void;
  onDateChange: (
    id: string,
    field: "last_contact" | "next_followup",
    iso: string,
    note?: string,
    callbackIso?: string
  ) => void;
  onNoteChange: (id: string, note: string) => void;
  onToggleHot: (id: string, hot: boolean) => void;
  onResearchSaved: (id: string, saved: ProspectResearchSaved) => void;
  onToggleProspect: (id: string, toProspect: boolean) => void;
  onCategoryChange: (id: string, category: string | null) => void;
  onRequestMeetingMove: (leadId: string) => void;
  onRequestReschedule: (leadId: string) => void;
  onRequestDelete: (leadId: string) => void;
  stages: LeadStage[];
  pending: boolean;
  assignableUsers: AssignableUser[];
  canReassign: boolean;
  canSelect: boolean;
  canDelete: boolean;
  selected: boolean;
  selectionActive: boolean;
  onToggleSelect: (id: string) => void;
  focused: boolean;
  onFocus: (id: string) => void;
}) {
  const assigneeLocked = !ASSIGNEE_CHANGEABLE_STAGES.includes(lead.stage);
  const [moveOpen, setMoveOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [pickingCategory, setPickingCategory] = useState(false);
  const longPress = useLongPress(
    () => {},
    5000,
    canDelete ? () => onRequestDelete(lead.id) : undefined,
    9000
  );
  const detailHref = "/crm/" + lead.id;

  return (
    <div
      {...(canDelete ? longPress : {})}
      onClickCapture={() => onFocus(lead.id)}
      className={
        "group relative min-w-0 space-y-3 rounded-2xl border p-3.5 shadow-card transition-colors " +
        (selected
          ? "border-primary bg-accent/40"
          : lead.is_hot_lead
          ? "border-[#FF6B4A] bg-[#FF6B4A] text-white"
          : focused
          ? "border-primary/50 bg-accent/40"
          : "bg-card-soft") +
        (focused && !selected ? " ring-1 ring-primary/30" : "")
      }
    >
      {/* Selection checkbox: only visible once selection mode is on, and
          never for leads the current user can't bulk-act on. */}
      {canSelect && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(lead.id);
          }}
          aria-label={selected ? "Deselect lead" : "Select lead"}
          className={
            "absolute -left-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-md border transition-opacity " +
            (selected
              ? "opacity-100 bg-primary border-primary text-primary-foreground"
              : "bg-card border-border " +
                (selectionActive ? "opacity-100" : "opacity-0 pointer-events-none"))
          }
        >
          {selected && (
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      )}

      {/* Avatar + name / business */}
      <div className="flex items-start gap-3">
        <Link
          href={detailHref}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-base font-bold text-primary"
        >
          {(lead.name || "?").charAt(0).toUpperCase()}
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            href={detailHref}
            className={
              "block truncate text-sm font-semibold " +
              (lead.is_hot_lead ? "text-white" : "")
            }
          >
            {lead.name}
          </Link>
          {lead.business_name && (
            <p
              className={
                "truncate text-xs " +
                (lead.is_hot_lead ? "text-white/85" : "text-muted-foreground")
              }
            >
              {lead.business_name}
            </p>
          )}
        </div>
        {canSelect && (
          <div className="flex shrink-0 items-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleProspect(lead.id, lead.stage !== "hot_lead");
              }}
              disabled={pending}
              aria-pressed={lead.stage === "hot_lead"}
              aria-label={
                lead.stage === "hot_lead"
                  ? "Move back from Prospects"
                  : "Send to Prospects"
              }
              title={
                lead.stage === "hot_lead"
                  ? "Move back from Prospects"
                  : "Send to Prospects"
              }
              className={
                "shrink-0 rounded-full p-1.5 transition-colors disabled:opacity-50 " +
                (lead.stage === "hot_lead"
                  ? lead.is_hot_lead
                    ? "bg-white/25 text-white hover:bg-white/35"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                  : lead.is_hot_lead
                  ? "text-white hover:bg-white/20"
                  : "text-muted-foreground hover:bg-accent hover:text-primary")
              }
            >
              <Send size={17} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleHot(lead.id, !lead.is_hot_lead);
              }}
              disabled={pending}
              aria-pressed={lead.is_hot_lead}
              aria-label={lead.is_hot_lead ? "Remove hot lead" : "Mark as hot lead"}
              className={
                "shrink-0 rounded-full p-1.5 transition-colors disabled:opacity-50 " +
                (lead.is_hot_lead
                  ? "text-white hover:bg-white/20"
                  : "text-muted-foreground hover:bg-accent hover:text-[#FF6B4A]")
              }
            >
              <Star
                size={18}
                className={lead.is_hot_lead ? "fill-white" : ""}
              />
            </button>
          </div>
        )}
      </div>

      {/* Quick actions: Call, WhatsApp, Spoke, Callback */}
      <div
        className={
          "grid grid-cols-[repeat(auto-fit,minmax(4.25rem,1fr))] gap-1.5 text-center text-xs font-bold [&>*]:min-w-0 [&>*]:overflow-hidden [&>*]:whitespace-nowrap " +
          (lead.is_hot_lead ? "rounded-xl bg-card p-1.5 text-foreground" : "")
        }
      >
        {lead.phone ? (
          <CallLink
            leadId={lead.id}
            name={lead.name}
            phone={lead.phone}
            className="flex items-center justify-center rounded-lg bg-primary/15 py-2 font-bold text-primary"
          >
            Call
          </CallLink>
        ) : (
          <span className="flex items-center justify-center rounded-lg bg-muted py-2 text-muted-foreground/50">
            Call
          </span>
        )}
        {lead.phone ? (
          <a
            href={"https://wa.me/" + toWhatsappNumber(lead.phone)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center rounded-lg bg-green-50/70 py-2 text-green-700 dark:bg-green-900/30 dark:text-green-400"
          >
            WhatsApp
          </a>
        ) : (
          <span className="flex items-center justify-center rounded-lg bg-muted py-2 text-muted-foreground/50">
            WhatsApp
          </span>
        )}
        <SpokeChip
          lead={lead}
          disabled={pending}
          onSave={(iso, note) =>
            onDateChange(lead.id, "last_contact", iso, note)
          }
        />
        <CallbackChip
          lead={lead}
          disabled={pending}
          onSave={(iso, note) => onDateChange(lead.id, "next_followup", iso, note)}
        />
      </div>

      {/* Prospects only: research panel (Online Presence / Competitors / Checklist) */}
      {lead.stage === "hot_lead" && (
        <ProspectResearch
          leadId={lead.id}
          leadName={lead.name}
          onlinePresence={lead.online_presence}
          competitors={lead.competitors}
          checklist={lead.checklist}
          onCoral={lead.is_hot_lead}
          onSaved={(saved) => onResearchSaved(lead.id, saved)}
        />
      )}

      <div className="-mt-1 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            setExpanded((v) => !v);
          }}
          aria-expanded={expanded}
          className={
            "text-center text-[11px] " +
            (lead.is_hot_lead ? "text-white/90" : "text-muted-foreground")
          }
        >
          {expanded ? "▴ Less" : "▾ More"}
        </button>

        {/* Business-type tag (auto-guessed; tap to change) */}
        {(() => {
          const tag = getLeadCategory(lead);
          const chipCls =
            "h-[18px] max-w-[8rem] truncate rounded-full px-2.5 text-[10px] font-bold leading-[18px] " +
            (lead.is_hot_lead
              ? "bg-white text-[#FF6B4A]"
              : tag === OTHER_CATEGORY
              ? "bg-accent text-muted-foreground"
              : "bg-primary text-primary-foreground");
          return canSelect ? (
            <button
              type="button"
              onClick={() => setPickingCategory(true)}
              title="Change category"
              aria-label={"Category: " + tag + ". Tap to change"}
              className={chipCls + " transition-opacity hover:opacity-85"}
            >
              {tag}
            </button>
          ) : (
            <span className={chipCls}>{tag}</span>
          );
        })()}
      </div>

      {pickingCategory && (
        <CategoryPicker
          leadName={lead.business_name ? lead.name + " · " + lead.business_name : lead.name}
          current={getLeadCategory(lead)}
          isManual={normalizeCategory(lead.category) !== null}
          onSelect={(c) => {
            setPickingCategory(false);
            onCategoryChange(lead.id, c);
          }}
          onClose={() => setPickingCategory(false)}
        />
      )}

      {expanded && (
        <div
          className={
            "space-y-3 " +
            (lead.is_hot_lead
              ? "rounded-xl bg-card p-3 text-foreground"
              : "border-t pt-3")
          }
        >
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            {assigneeLocked ? (
              <span
                title="Assignee is locked once a lead leaves Call Pending"
                className="flex max-w-[160px] items-center gap-1"
              >
                <span className="truncate">🔒 {lead.assignee.name}</span>
              </span>
            ) : (
              <AssigneeDropdown
                currentAssignee={lead.assignee}
                users={canReassign ? assignableUsers : []}
                disabled={pending}
                onSelect={(userId) => onAssigneeChange(lead.id, userId)}
              />
            )}
            {lead.deal_value != null && (
              <span className="font-semibold text-primary">
                {"$" + Number(lead.deal_value).toLocaleString()}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-center text-xs font-semibold">
            <button
              type="button"
              onClick={() => setMoveOpen(true)}
              className="rounded-lg bg-accent py-2 text-primary"
            >
              Move
            </button>
            <Link href={detailHref} className="rounded-lg border py-2 text-muted-foreground">
              Open
            </Link>
          </div>

          {lead.stage === "meeting" && (
            <MeetingChip
              lead={lead}
              disabled={pending}
              onClick={() => onRequestReschedule(lead.id)}
            />
          )}

          <NotePreview
            leadId={lead.id}
            note={lead.notes}
            pending={pending}
            onSave={onNoteChange}
          />
        </div>
      )}

      <MoveDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        currentStage={lead.stage}
        stages={stages}
        pending={pending}
        onPick={(stage) => {
          if (stage === "meeting") {
            onRequestMeetingMove(lead.id);
          } else {
            onStageChange(lead.id, stage);
          }
        }}
      />
    </div>
  );
}

export function KanbanBoard({
  leads: initialLeads,
  stages,
  assignableUsers,
  canReassign,
  currentUserId,
}: KanbanBoardProps) {
  const [items, setItems] = useState(initialLeads);

  // Pick up fresh server data (e.g. after a lead is created from the popup).
  useEffect(() => {
    setItems(initialLeads);
  }, [initialLeads]);
  const [activeStage, setActiveStage] = useState<LeadStage>(stages[0]);
  // The card being worked on gets a soft highlight so focus stays on one lead.
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // --- Global filters (apply across all 6 stages, not per-stage) ---
  // Follow-up / assignee filters live in the header funnel dropdown.
  const {
    followup: followupFilter,
    assignedTo: assignedToFilter,
    categories: categoryFilter,
    setAvailableCategories,
  } = useCrmFilters();
  const [search, setSearch] = useState("");

  // --- Bulk selection ---
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // `selectionModeOn` is the explicit "Select" button toggle — it turns
  // checkboxes on before anything is picked. `selectionActive` also stays
  // true once a lead is selected via long-press, so either path keeps the
  // toolbar/back-button interception working.
  const [selectionModeOn, setSelectionModeOn] = useState(false);
  const selectionActive = selectionModeOn || selectedIds.size > 0;

  function enterSelectionMode() {
    setSelectionModeOn(true);
  }

  function exitSelectionMode() {
    setSelectionModeOn(false);
    setSelectedIds(new Set());
  }

  // --- Meeting schedule / reschedule popup ---
  const [meetingModal, setMeetingModal] = useState<{
    leadId: string;
    mode: "schedule" | "reschedule";
  } | null>(null);
  const meetingModalLead = meetingModal
    ? items.find((l) => l.id === meetingModal.leadId) ?? null
    : null;

  function toggleSelect(id: string) {
    setSelectedIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  // --- Prevent back-button from leaving the CRM while mark-mode is active ---
  // When selection starts, push a dummy history entry. Pressing back then
  // just consumes that entry (popstate fires) and we clear selection instead
  // of letting the browser navigate away from the CRM page.
  const pushedHistoryRef = useRef(false);

  useEffect(() => {
    function handlePopState() {
      if (pushedHistoryRef.current) {
        pushedHistoryRef.current = false;
        setSelectionModeOn(false);
        setSelectedIds(new Set());
      }
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (selectionActive && !pushedHistoryRef.current) {
      window.history.pushState({ crmSelectionMode: true }, "");
      pushedHistoryRef.current = true;
    } else if (!selectionActive && pushedHistoryRef.current) {
      pushedHistoryRef.current = false;
      window.history.back();
    }
  }, [selectionActive]);

  function handleStageChange(leadId: string, newStage: LeadStage) {
    const previous = items;

    setItems((cur) =>
      cur.map((l) =>
        l.id === leadId ? { ...l, stage: newStage } : l
      )
    );

    startTransition(async () => {
      const result = await updateLeadStageAction(leadId, newStage);

      if (result?.error) {
        setItems(previous);
      }
    });
  }

  function handleScheduleMeeting(leadId: string, isoDatetime: string, note: string) {
    const previous = items;

    setItems((cur) =>
      cur.map((l) =>
        l.id === leadId
          ? {
              ...l,
              stage: "meeting" as LeadStage,
              meeting_datetime: isoDatetime,
              meeting_note: note || null,
            }
          : l
      )
    );
    setMeetingModal(null);

    startTransition(async () => {
      const result = await updateLeadStageAction(leadId, "meeting", {
        datetime: isoDatetime,
        note,
      });
      if (result?.error) {
        setItems(previous);
      }
    });
  }

  function handleRescheduleMeeting(leadId: string, isoDatetime: string, note: string) {
    const previous = items;

    setItems((cur) =>
      cur.map((l) => {
        if (l.id !== leadId) return l;
        const prevHistory = l.meeting_datetime
          ? [
              ...l.meeting_history,
              {
                datetime: l.meeting_datetime,
                note: l.meeting_note,
                logged_at: new Date().toISOString(),
              },
            ]
          : l.meeting_history;
        return {
          ...l,
          meeting_datetime: isoDatetime,
          meeting_note: note || null,
          meeting_history: prevHistory,
        };
      })
    );
    setMeetingModal(null);

    startTransition(async () => {
      const result = await rescheduleMeetingAction(leadId, isoDatetime, note);
      if (result?.error) {
        setItems(previous);
      }
    });
  }

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteTargetLead = deleteTarget
    ? items.find((l) => l.id === deleteTarget) ?? null
    : null;

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    const leadId = deleteTarget;
    setDeletePending(true);
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteLeadAction(leadId);
      setDeletePending(false);
      if (result?.error) {
        setDeleteError(result.error);
      } else {
        setItems((cur) => cur.filter((l) => l.id !== leadId));
        setDeleteTarget(null);
      }
    });
  }

  function handleAssigneeChange(leadId: string, userId: string) {
    const previous = items;
    const newAssignee = assignableUsers.find((u) => u.id === userId);
    if (!newAssignee) return;

    setItems((cur) =>
      cur.map((l) =>
        l.id === leadId ? { ...l, assignee: newAssignee } : l
      )
    );

    startTransition(async () => {
      const result = await updateLeadAssigneeAction(leadId, userId);

      if (result?.error) {
        setItems(previous);
      }
    });
  }

  function handleDateChange(
    leadId: string,
    field: "last_contact" | "next_followup",
    value: string,
    note?: string,
    callbackIso?: string
  ) {
    const previous = items;
    const target = items.find((l) => l.id === leadId);
    if (!target) return;

    // Optional note from the Spoke / Callback popup is appended to the
    // lead's notes with a dated label.
    let newNotes: string | undefined;
    if (note) {
      const label =
        field === "last_contact"
          ? `Spoke ${formatSpokeLabel(value)}` +
            (callbackIso ? ` (callback ${formatCallbackLabel(callbackIso)})` : "")
          : `Callback ${formatCallbackLabel(value)}`;
      newNotes = appendNote(target.notes, label, note);
    }

    // Spoke popup also sets the next callback in the same save.
    const extra = callbackIso ? { next_followup: callbackIso } : {};

    setItems((cur) =>
      cur.map((l) =>
        l.id === leadId
          ? {
              ...l,
              [field]: value,
              ...extra,
              ...(newNotes !== undefined ? { notes: newNotes } : {}),
            }
          : l
      )
    );

    startTransition(async () => {
      const result = await updateLeadAction(leadId, {
        [field]: value,
        ...extra,
        ...(newNotes !== undefined ? { notes: newNotes } : {}),
      });

      if (result?.error) {
        setItems(previous);
      }
    });
  }

  function handleToggleHot(leadId: string, hot: boolean) {
    const previous = items;

    setItems((cur) =>
      cur.map((l) => (l.id === leadId ? { ...l, is_hot_lead: hot } : l))
    );

    startTransition(async () => {
      const result = await toggleLeadHotAction(leadId, hot);

      if (result?.error) {
        setItems(previous);
      }
    });
  }

  function handleToggleProspect(leadId: string, toProspect: boolean) {
    const previous = items;

    if (toProspect) {
      setItems((cur) =>
        cur.map((l) =>
          l.id === leadId ? { ...l, stage: "hot_lead" as LeadStage } : l
        )
      );
    }

    startTransition(async () => {
      const result = await toggleLeadProspectAction(leadId, toProspect);

      if ("error" in result) {
        setItems(previous);
        return;
      }
      // Covers the "send back" case, where the target stage comes from the server.
      setItems((cur) =>
        cur.map((l) => (l.id === leadId ? { ...l, stage: result.stage } : l))
      );
    });
  }

  function handleCategoryChange(leadId: string, category: string | null) {
    const previous = items;
    const value = normalizeCategory(category);
    setItems((cur) =>
      cur.map((l) => (l.id === leadId ? { ...l, category: value } : l))
    );
    startTransition(async () => {
      const result = await setLeadCategoryAction(leadId, value);
      if (result && "error" in result && result.error) {
        setItems(previous);
      }
    });
  }

  function handleResearchSaved(leadId: string, saved: ProspectResearchSaved) {
    setItems((cur) =>
      cur.map((l) => (l.id === leadId ? { ...l, ...saved } : l))
    );
  }

  function handleNoteChange(leadId: string, note: string) {
    const previous = items;

    setItems((cur) =>
      cur.map((l) => (l.id === leadId ? { ...l, notes: note } : l))
    );

    startTransition(async () => {
      const result = await updateLeadAction(leadId, { notes: note });

      if (result?.error) {
        setItems(previous);
      }
    });
  }

  function handleBulkMove(newStage: LeadStage) {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    const previous = items;

    setItems((cur) =>
      cur.map((l) => (ids.includes(l.id) ? { ...l, stage: newStage } : l))
    );
    clearSelection();

    startTransition(async () => {
      const result = await bulkUpdateLeadStageAction(ids, newStage);
      if (result?.error) {
        setItems(previous);
      }
    });
  }

  function handleBulkAssign(userId: string) {
    const ids = Array.from(selectedIds);
    const newAssignee = assignableUsers.find((u) => u.id === userId);
    if (!ids.length || !newAssignee) return;
    const previous = items;

    setItems((cur) =>
      cur.map((l) => (ids.includes(l.id) ? { ...l, assignee: newAssignee } : l))
    );
    clearSelection();

    startTransition(async () => {
      const result = await bulkUpdateLeadAssigneeAction(ids, userId);
      if (result?.error) {
        setItems(previous);
      }
    });
  }

  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkDeletePending, setBulkDeletePending] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);

  function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    setBulkDeletePending(true);
    setBulkDeleteError(null);

    startTransition(async () => {
      const result = await bulkDeleteLeadsAction(ids);
      setBulkDeletePending(false);
      if (result?.error) {
        setBulkDeleteError(result.error);
      } else {
        setItems((cur) => cur.filter((l) => !ids.includes(l.id)));
        setConfirmBulkDelete(false);
        exitSelectionMode();
      }
    });
  }

  // A member can only ever bulk-act on their own leads; admins/founders can
  // select anything. This mirrors the server-side permission check exactly.
  function canSelectLead(lead: KanbanLead) {
    if (canReassign) return true; // not a member
    return lead.assignee.id === currentUserId;
  }

  // Tell the header filter which categories exist (with counts).
  useEffect(() => {
    const counts = new Map<string, { name: string; count: number }>();
    for (const l of items) {
      const name = getLeadCategory(l);
      const key = categoryKey(name);
      const cur = counts.get(key);
      if (cur) cur.count += 1;
      else counts.set(key, { name, count: 1 });
    }
    setAvailableCategories(
      Array.from(counts.values()).sort(
        (a, b) =>
          (a.name === OTHER_CATEGORY ? 1 : 0) - (b.name === OTHER_CATEGORY ? 1 : 0) ||
          b.count - a.count ||
          a.name.localeCompare(b.name)
      )
    );
  }, [items, setAvailableCategories]);

  const filteredItems = items.filter((l) => {
    if (assignedToFilter !== "all" && l.assignee.id !== assignedToFilter) {
      return false;
    }

    if (followupFilter !== "all") {
      const bucket = getFollowupBucket(l.next_followup);
      if (followupFilter === "not_set" && bucket !== "not_set") return false;
      if (followupFilter === "overdue" && bucket !== "overdue") return false;
      if (followupFilter === "due_today" && bucket !== "due_today") return false;
    }

    if (
      categoryFilter.length > 0 &&
      !categoryFilter.includes(categoryKey(getLeadCategory(l)))
    ) {
      return false;
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const haystack = [l.name, l.business_name ?? "", l.phone ?? ""]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });

  const visibleLeads = filteredItems.filter((l) => l.stage === activeStage);

  const filtersActive =
    assignedToFilter !== "all" ||
    followupFilter !== "all" ||
    categoryFilter.length > 0 ||
    search.trim() !== "";

  const colors = STAGE_COLORS[activeStage];

  return (
    <div className="space-y-4">
      {/* Sticky bar: search and the 3-dot bulk menu. Stays pinned below
          the app header while scrolling. */}
      <div className="sticky top-14 z-20 -mx-4 space-y-3 border-b bg-background/95 px-4 pb-3 pt-3 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, business, phone"
            className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 sm:max-w-sm"
          />
          <BulkMenu
            selectionActive={selectionActive}
            selectedCount={selectedIds.size}
            pending={pending}
            stageOptions={stages.map((st) => ({ value: st, label: LEAD_STAGE_LABELS[st] }))}
            assignees={assignableUsers.map((u) => ({ id: u.id, name: u.name }))}
            canReassign={canReassign}
            onEnterSelect={enterSelectionMode}
            onExitSelect={exitSelectionMode}
            onMove={(v) => handleBulkMove(v as LeadStage)}
            onAssign={handleBulkAssign}
            onDelete={() => setConfirmBulkDelete(true)}
          />
        </div>
      </div>

      {/* Stage tabs */}
      <div className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {stages.map((stage) => {
          const count = filteredItems.filter((l) => l.stage === stage).length;
          const isActive = stage === activeStage;
          const c = STAGE_COLORS[stage];

          return (
            <button
              key={stage}
              onClick={() => setActiveStage(stage)}
              className={
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors " +
                (isActive
                  ? "border-primary bg-primary text-primary-foreground shadow-card"
                  : "border-border bg-card text-muted-foreground hover:text-foreground")
              }
            >
              {!isActive && <span className={"h-2 w-2 rounded-full " + c.dot} />}
              {LEAD_STAGE_LABELS[stage]}
              <span
                className={
                  "rounded-full px-1.5 text-[11px] " +
                  (isActive ? "bg-white/25" : "bg-muted")
                }
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active stage header */}
      <div className="flex items-center justify-between">
        <h2 className={"flex items-center gap-2 font-semibold " + colors.tab}>
          <span className={"h-2 w-2 rounded-full " + colors.dot} />
          {LEAD_STAGE_LABELS[activeStage]}
        </h2>
        <span className="text-sm text-muted-foreground">
          {visibleLeads.length +
            " lead" +
            (visibleLeads.length !== 1 ? "s" : "")}
        </span>
      </div>

      {/* Leads list */}
      {visibleLeads.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
          {filtersActive ? "No leads match these filters." : "No leads in this stage."}
        </div>
      ) : (
        <div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          onClick={(e) => {
            if (e.target === e.currentTarget) setFocusedId(null);
          }}
        >
          {visibleLeads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onStageChange={handleStageChange}
              onAssigneeChange={handleAssigneeChange}
              onDateChange={handleDateChange}
              onNoteChange={handleNoteChange}
              onToggleHot={handleToggleHot}
              onResearchSaved={handleResearchSaved}
              onToggleProspect={handleToggleProspect}
              onCategoryChange={handleCategoryChange}
              onRequestMeetingMove={(leadId) =>
                setMeetingModal({ leadId, mode: "schedule" })
              }
              onRequestReschedule={(leadId) =>
                setMeetingModal({ leadId, mode: "reschedule" })
              }
              stages={stages}
              pending={pending}
              assignableUsers={assignableUsers}
              canReassign={canReassign}
              canSelect={canSelectLead(lead)}
              canDelete={canSelectLead(lead)}
              onRequestDelete={(leadId) => setDeleteTarget(leadId)}
              selected={selectedIds.has(lead.id)}
              selectionActive={selectionActive}
              onToggleSelect={toggleSelect}
              focused={focusedId === lead.id}
              onFocus={setFocusedId}
            />
          ))}
        </div>
      )}

      <MeetingDialog
        open={meetingModal !== null}
        mode={meetingModal?.mode ?? "schedule"}
        initialDatetime={meetingModal?.mode === "reschedule" ? meetingModalLead?.meeting_datetime ?? null : null}
        initialNote={meetingModal?.mode === "reschedule" ? meetingModalLead?.meeting_note ?? null : null}
        pending={pending}
        onClose={() => setMeetingModal(null)}
        onConfirm={(isoDatetime, note) => {
          if (!meetingModal) return;
          if (meetingModal.mode === "schedule") {
            handleScheduleMeeting(meetingModal.leadId, isoDatetime, note);
          } else {
            handleRescheduleMeeting(meetingModal.leadId, isoDatetime, note);
          }
        }}
      />

      <DeleteConfirmModal
        open={deleteTarget !== null}
        leadName={deleteTargetLead?.business_name || deleteTargetLead?.name || null}
        pending={deletePending}
        error={deleteError}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={handleConfirmDelete}
      />

      <DeleteConfirmModal
        open={confirmBulkDelete}
        leadName={null}
        count={selectedIds.size}
        pending={bulkDeletePending}
        error={bulkDeleteError}
        onClose={() => {
          setConfirmBulkDelete(false);
          setBulkDeleteError(null);
        }}
        onConfirm={handleBulkDelete}
      />
    </div>
  );
}