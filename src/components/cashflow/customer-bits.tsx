"use client";

import { useState, useTransition } from "react";
import { CustomerFormSheet, type CustomerFormValues } from "@/components/cashflow/customers-list";
import { Sheet } from "@/components/cashflow/sheet";
import { Field, btnMiniSoft, btnPrimary, btnSoft, inputCls, textareaCls } from "@/components/cashflow/ui";
import { saveNotesAction, setPromiseAction } from "@/lib/cashflow/actions";

export function EditCustomerButton({ customerId, initial }: { customerId: string; initial: CustomerFormValues }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={btnMiniSoft} onClick={() => setOpen(true)}>
        Edit
      </button>
      {open && <CustomerFormSheet open onClose={() => setOpen(false)} initial={initial} customerId={customerId} />}
    </>
  );
}

export function PromiseRow({
  customerId,
  amount,
  date,
  dateLabel,
  defaultAmount,
  tomorrow,
}: {
  customerId: string;
  amount: number | null;
  date: string | null;
  dateLabel: string | null;
  defaultAmount: number;
  tomorrow: string;
}) {
  const [open, setOpen] = useState(false);
  const [amt, setAmt] = useState(String(amount ?? defaultAmount));
  const [d, setD] = useState(date ?? tomorrow);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const run = (promise: { amount: number; date: string } | null) =>
    start(async () => {
      const res = await setPromiseAction(customerId, promise);
      if (res.ok) setOpen(false);
      else setError(res.error);
    });

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between gap-3 border-b py-2 text-[13px]"
      >
        <span className="text-muted-foreground">Promise to pay</span>
        <span className="font-medium text-primary">
          {amount && dateLabel ? `₹${amount.toLocaleString("en-IN")} on ${dateLabel}` : "Set date"}
        </span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Promise to pay">
        <Field label="Amount">
          <input className={inputCls} inputMode="numeric" value={amt} onChange={(e) => setAmt(e.target.value)} />
        </Field>
        <Field label="Date">
          <input type="date" className={inputCls} value={d} onChange={(e) => setD(e.target.value)} />
        </Field>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button className={btnPrimary} disabled={pending} onClick={() => run({ amount: Number(amt.replace(/\D/g, "")), date: d })}>
          Save
        </button>
        {amount && (
          <button className={btnSoft} disabled={pending} onClick={() => run(null)}>
            Remove promise
          </button>
        )}
      </Sheet>
    </>
  );
}

export function NotesBox({ customerId, initial }: { customerId: string; initial: string }) {
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [, start] = useTransition();
  return (
    <div>
      <textarea
        className={textareaCls + " h-24 resize-none"}
        aria-label="Notes"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (text !== saved) {
            setSaved(text);
            start(async () => {
              await saveNotesAction(customerId, text);
            });
          }
        }}
      />
      <p className="mt-1 text-[11px] text-muted-foreground">Saves when you tap outside the box.</p>
    </div>
  );
}
