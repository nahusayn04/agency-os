import Link from "next/link";
import { Pill } from "@/components/hisab/ui";
import { ReminderButton } from "@/components/hisab/reminder";
import type { FeedItem } from "@/lib/hisab/calc";

export function FeedCard({
  x,
  contact,
  phone,
  template,
}: {
  x: FeedItem;
  contact: string;
  phone: string | null;
  template: string;
}) {
  return (
    <div className="relative rounded-2xl border bg-card p-3">
      <Link href={`/hisab/customers/${x.customerId}`} className="absolute inset-0 rounded-2xl" aria-label={`Open ${x.name}`} />
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Pill tone={x.kind === "Payment" ? "due" : "info"}>{x.kind}</Pill>
        <span>{x.name}</span>
      </div>
      <p className="mt-1.5 text-sm font-semibold">{x.headline}</p>
      <p className="text-xs text-muted-foreground">{x.detail}</p>
      {x.reminder && (
        <div className="mt-2">
          <ReminderButton customerId={x.customerId} contact={contact} phone={phone} amount={x.amountDue} template={template} />
        </div>
      )}
    </div>
  );
}
