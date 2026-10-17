"use client";

import { useState } from "react";
import { Pill, btnMini, btnMiniSoft } from "@/components/hisab/ui";
import { useHisab } from "@/components/hisab/provider";
import { inr } from "@/lib/hisab/calc";

export type DealCardData = {
  id: string;
  customerId: string;
  name: string;
  soldOn: string;
  note: string | null;
  total: number;
  paid: number;
  left: number;
  payments: { id: string; date: string; amount: number; note: string | null }[];
};

export function DealCard({ d }: { d: DealCardData }) {
  const { openEntry } = useHisab();
  const [open, setOpen] = useState(false);
  const tone = d.left <= 0 ? "ok" : d.paid > 0 ? "warn" : "due";
  const word = d.left <= 0 ? "Paid" : d.paid > 0 ? "Partial" : "Pending";

  return (
    <div className="rounded-2xl border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{d.name}</p>
          <p className="text-xs text-muted-foreground">
            Sold {d.soldOn}
            {d.note ? ` · ${d.note}` : ""}
          </p>
        </div>
        <Pill tone={tone}>{word}</Pill>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-accent">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.round((d.paid * 100) / d.total)}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-[13px]">
        <span className="text-muted-foreground">
          Paid {inr(d.paid)} of {inr(d.total)}
        </span>
        <span className={d.left > 0 ? "font-medium text-red-600" : "font-medium text-emerald-600"}>
          {d.left > 0 ? `${inr(d.left)} left` : "Settled"}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {d.left > 0 && (
          <button
            className={btnMini}
            onClick={() => openEntry({ type: "r", customerId: d.customerId, dealId: d.id })}
          >
            + Payment
          </button>
        )}
        <button className={btnMiniSoft} onClick={() => setOpen((o) => !o)}>
          {d.payments.length} {d.payments.length === 1 ? "payment" : "payments"} {open ? "▴" : "▾"}
        </button>
      </div>
      {open && (
        <div className="mt-2 divide-y">
          {d.payments.length === 0 && <p className="py-2 text-xs text-muted-foreground">No payments yet.</p>}
          {d.payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-semibold">Payment</p>
                <p className="text-xs text-muted-foreground">
                  {p.date}
                  {p.note ? ` · ${p.note}` : ""}
                </p>
              </div>
              <span className="text-sm font-semibold text-emerald-600">+{inr(p.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
