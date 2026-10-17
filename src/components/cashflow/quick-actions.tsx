"use client";

import { ArrowDownLeft, ArrowUpRight, FilePlus, Phone } from "lucide-react";
import { useCashflow } from "@/components/cashflow/provider";
import { ReminderButton } from "@/components/cashflow/reminder";
import { RoundLabel, roundBtn } from "@/components/cashflow/ui";
import { cn } from "@/lib/utils";

export function HomeActions() {
  const { openEntry } = useCashflow();
  return (
    <div className="grid grid-cols-3 gap-2">
      <RoundLabel label="Add sale">
        <button className={roundBtn} aria-label="Add sale" onClick={() => openEntry({ type: "s" })}>
          <FilePlus size={22} />
        </button>
      </RoundLabel>
      <RoundLabel label="Add payment">
        <button className={roundBtn} aria-label="Add payment" onClick={() => openEntry({ type: "r" })}>
          <ArrowDownLeft size={22} />
        </button>
      </RoundLabel>
      <RoundLabel label="Add expense">
        <button className={roundBtn} aria-label="Add expense" onClick={() => openEntry({ type: "x" })}>
          <ArrowUpRight size={22} />
        </button>
      </RoundLabel>
    </div>
  );
}

export function CustomerActions({
  customerId,
  phone,
  contact,
  outstanding,
  template,
}: {
  customerId: string;
  phone: string | null;
  contact: string;
  outstanding: number;
  template: string;
}) {
  const { openEntry } = useCashflow();
  return (
    <div className="grid grid-cols-4 gap-2">
      <RoundLabel label="Call">
        {phone ? (
          <a href={`tel:${phone}`} className={roundBtn} aria-label="Call">
            <Phone size={22} />
          </a>
        ) : (
          <span className={cn(roundBtn, "opacity-45")} aria-label="Call (no phone saved)">
            <Phone size={22} />
          </span>
        )}
      </RoundLabel>
      <ReminderButton
        variant="round"
        label="Remind"
        customerId={customerId}
        contact={contact}
        phone={phone}
        amount={outstanding}
        template={template}
        disabled={outstanding <= 0}
      />
      <RoundLabel label="Sale">
        <button className={roundBtn} aria-label="Add sale" onClick={() => openEntry({ type: "s", customerId })}>
          <FilePlus size={22} />
        </button>
      </RoundLabel>
      <RoundLabel label="Payment">
        <button className={roundBtn} aria-label="Add payment" onClick={() => openEntry({ type: "r", customerId })}>
          <ArrowDownLeft size={22} />
        </button>
      </RoundLabel>
    </div>
  );
}
