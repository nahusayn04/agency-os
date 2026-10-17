"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateLeadAction, updateLeadStageAction } from "@/lib/crm/actions";
import { LEAD_STAGES, LEAD_STAGE_LABELS, type LeadStage } from "@/lib/types/crm";
import {
  CallbackDialog,
  MeetingDialog,
  MoveDialog,
  appendNote,
  formatCallbackLabel,
} from "@/components/crm/crm-dialogs";
import { CallLink } from "@/components/crm/call-link";
import { toWhatsappNumber } from "@/lib/crm/call-tracking";

export interface TodayRowLead {
  id: string;
  name: string;
  business_name: string | null;
  phone: string | null;
  stage: string;
  next_followup: string | null;
  meeting_datetime: string | null;
  notes: string | null;
  assignee_name: string | null;
}

const BTN = "flex items-center justify-center rounded-lg py-2 text-xs font-semibold";

export function TodayCallRow({
  lead,
  kind,
  showAssignee,
}: {
  lead: TodayRowLead;
  kind: "overdue" | "callback" | "meeting";
  showAssignee: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [cbOpen, setCbOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const when =
    kind === "meeting"
      ? "Meeting " + formatCallbackLabel(lead.meeting_datetime)
      : "Callback " + formatCallbackLabel(lead.next_followup);

  const lastNote = lead.notes?.trim().split("\n").filter(Boolean).pop() ?? "";

  function run(fn: () => Promise<{ error?: string } | undefined | void>) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (r && "error" in r && r.error) {
        setError(r.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-2xl border bg-card p-3 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={"/crm/" + lead.id} className="block truncate text-sm font-semibold">
            {lead.name}
          </Link>
          {lead.business_name && (
            <p className="truncate text-xs text-muted-foreground">{lead.business_name}</p>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-medium text-primary">
          {LEAD_STAGE_LABELS[lead.stage as LeadStage] ?? lead.stage}
        </span>
      </div>

      <p
        className={
          "text-xs font-medium " +
          (kind === "overdue" ? "text-red-600 dark:text-red-400" : "text-muted-foreground")
        }
      >
        {when}
        {showAssignee && lead.assignee_name ? " · " + lead.assignee_name : ""}
      </p>

      {lastNote && (
        <p className="line-clamp-2 text-xs text-muted-foreground">{lastNote}</p>
      )}

      <div className="grid grid-cols-4 gap-1.5 text-center">
        {lead.phone ? (
          <CallLink
            leadId={lead.id}
            name={lead.name}
            phone={lead.phone}
            className={BTN + " bg-accent text-primary"}
          >
            Call
          </CallLink>
        ) : (
          <span className={BTN + " bg-muted text-muted-foreground/50"}>Call</span>
        )}
        {lead.phone ? (
          <a
            href={"https://wa.me/" + toWhatsappNumber(lead.phone)}
            target="_blank"
            rel="noopener noreferrer"
            className={BTN + " bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"}
          >
            WhatsApp
          </a>
        ) : (
          <span className={BTN + " bg-muted text-muted-foreground/50"}>WhatsApp</span>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => setCbOpen(true)}
          className={BTN + " bg-accent text-primary disabled:opacity-50"}
        >
          Callback
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setMoveOpen(true)}
          className={BTN + " border text-muted-foreground disabled:opacity-50"}
        >
          Stage
        </button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <CallbackDialog
        open={cbOpen}
        onOpenChange={setCbOpen}
        initialIso={lead.next_followup}
        pending={pending}
        onSave={(iso, note) => {
          setCbOpen(false);
          run(() =>
            updateLeadAction(lead.id, {
              next_followup: iso,
              ...(note
                ? {
                    notes: appendNote(
                      lead.notes,
                      `Callback ${formatCallbackLabel(iso)}`,
                      note
                    ),
                  }
                : {}),
            })
          );
        }}
      />

      <MoveDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        currentStage={lead.stage as LeadStage}
        stages={LEAD_STAGES}
        pending={pending}
        onPick={(stage) => {
          if (stage === "meeting") {
            setMeetingOpen(true);
          } else {
            run(() => updateLeadStageAction(lead.id, stage));
          }
        }}
      />

      <MeetingDialog
        open={meetingOpen}
        mode="schedule"
        initialDatetime={lead.meeting_datetime}
        initialNote={null}
        pending={pending}
        onClose={() => setMeetingOpen(false)}
        onConfirm={(iso, note) => {
          setMeetingOpen(false);
          run(() => updateLeadStageAction(lead.id, "meeting", { datetime: iso, note }));
        }}
      />
    </div>
  );
}
