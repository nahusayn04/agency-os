"use client";

import { Pill, btnMini } from "@/components/cashflow/ui";
import { useCashflow } from "@/components/cashflow/provider";
import { inr } from "@/lib/cashflow/calc";

export type DealCardData = {
  id: string;
  customerId: string;
  name: string;
  soldOn: string;
  note: string | null;
  total: number;
  paid: number;
  left: number;
};

export function DealCard({ d }: { d: DealCardData }) {
  const { openEntry } = useCashflow();
  const tone = d.left <= 0 ? "ok" : d.paid > 0 ? "warn" : "due";
  const word = d.left <= 0 ? "Paid" : d.paid > 0 ? "Partial" : "Pending";

  return (
    <div className="rounded-2xl border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{d.name}</p>
          <p className="text-xs text-muted-foreground">
            Billed {d.soldOn}
            {d.note ? ` · ${d.note}` : ""}
          </p>
        </div>
        <Pill tone={tone}>{word}</Pill>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-accent">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((d.paid * 100) / d.total)}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-[13px]">
        <span className="text-muted-foreground">
          Paid {inr(d.paid)} of {inr(d.total)}
        </span>
        <span className={d.left > 0 ? "font-medium text-red-600" : "font-medium text-emerald-600"}>
          {d.left > 0 ? `${inr(d.left)} balance` : "Paid in full"}
        </span>
      </div>
      {d.left > 0 && (
        <div className="mt-2">
          <button className={btnMini} onClick={() => openEntry({ type: "r", customerId: d.customerId, dealId: d.id })}>
            + Payment
          </button>
        </div>
      )}
    </div>
  );
}
