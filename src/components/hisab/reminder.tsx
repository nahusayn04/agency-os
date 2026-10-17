"use client";

import { useState, useTransition } from "react";
import { Sheet } from "@/components/hisab/sheet";
import { btnMini, btnWa } from "@/components/hisab/ui";
import { inr, whatsappUrl } from "@/lib/hisab/calc";
import { fillTemplate } from "@/lib/hisab/templates";
import { markReminderAction } from "@/lib/hisab/actions";
import { cn } from "@/lib/utils";

export function ReminderButton({
  customerId,
  contact,
  phone,
  amount,
  template,
  label = "Send reminder",
  className,
  wide,
}: {
  customerId: string;
  contact: string;
  phone: string | null;
  amount: number;
  template: string;
  label?: string;
  className?: string;
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const text = fillTemplate(template, { name: contact, amount: inr(amount) });

  return (
    <>
      <button
        type="button"
        className={cn(wide ? btnWa : btnMini, "relative z-10", className)}
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="WhatsApp reminder">
        <div className="whitespace-pre-wrap rounded-xl bg-emerald-100 p-3 text-sm leading-relaxed text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
          {text}
        </div>
        {!phone && (
          <p className="text-xs text-red-600">No phone number saved for this customer. Edit the customer first.</p>
        )}
        <button
          className={btnWa}
          disabled={!phone}
          onClick={() => {
            window.open(whatsappUrl(phone, text), "_blank", "noopener");
            start(async () => {
              await markReminderAction(customerId);
            });
            setOpen(false);
          }}
        >
          Open WhatsApp
        </button>
      </Sheet>
    </>
  );
}
