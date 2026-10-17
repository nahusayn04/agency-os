"use client";

import { useState, useTransition } from "react";
import { Sheet } from "@/components/cashflow/sheet";
import { MessageCircle } from "lucide-react";
import { RoundLabel, btnMini, btnWa, roundBtn } from "@/components/cashflow/ui";
import { inr, whatsappUrl } from "@/lib/cashflow/calc";
import { fillTemplate } from "@/lib/cashflow/templates";
import { markReminderAction } from "@/lib/cashflow/actions";
import { cn } from "@/lib/utils";

export function ReminderButton({
  customerId,
  contact,
  phone,
  amount,
  template,
  label = "Send reminder",
  className,
  variant = "mini",
  disabled,
}: {
  customerId: string;
  contact: string;
  phone: string | null;
  amount: number;
  template: string;
  label?: string;
  className?: string;
  variant?: "mini" | "wide" | "round";
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const text = fillTemplate(template, { name: contact, amount: inr(amount) });

  return (
    <>
      {variant === "round" ? (
        <RoundLabel label={label}>
          <button
            type="button"
            aria-label={label}
            disabled={disabled}
            className={cn(roundBtn, "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300")}
            onClick={() => setOpen(true)}
          >
            <MessageCircle size={22} />
          </button>
        </RoundLabel>
      ) : (
        <button
          type="button"
          disabled={disabled}
          className={cn(variant === "wide" ? btnWa : btnMini, "relative z-10", className)}
          onClick={() => setOpen(true)}
        >
          {label}
        </button>
      )}
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
