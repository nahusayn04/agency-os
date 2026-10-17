"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Sheet } from "@/components/cashflow/sheet";
import { Avatar, Field, Pill, btnPrimary, inputCls } from "@/components/cashflow/ui";
import { createCustomerAction, updateCustomerAction } from "@/lib/cashflow/actions";
import { inr } from "@/lib/cashflow/calc";
import { cn } from "@/lib/utils";

export type CustomerListItem = {
  id: string;
  name: string;
  products: string;
  openDeals: number;
  lastPaid: string;
  dues: number;
};

export type CustomerFormValues = {
  name: string;
  contact_person: string;
  phone: string;
  city: string;
};

export function CustomerFormSheet({
  open,
  onClose,
  initial,
  customerId,
}: {
  open: boolean;
  onClose: () => void;
  initial?: CustomerFormValues;
  customerId?: string;
}) {
  const router = useRouter();
  const [v, setV] = useState<CustomerFormValues>(
    initial ?? { name: "", contact_person: "", phone: "", city: "" }
  );
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const set = (k: keyof CustomerFormValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV((c) => ({ ...c, [k]: e.target.value }));

  function save() {
    setError("");
    start(async () => {
      if (customerId) {
        const res = await updateCustomerAction(customerId, v);
        if (res.ok) onClose();
        else setError(res.error);
      } else {
        const res = await createCustomerAction(v);
        if (res.ok) {
          onClose();
          router.push(`/cashflow/customers/${res.data.id}`);
        } else setError(res.error);
      }
    });
  }

  return (
    <Sheet open={open} onClose={onClose} title={customerId ? "Edit customer" : "New customer"}>
      <Field label="Business name">
        <input className={inputCls} value={v.name} onChange={set("name")} />
      </Field>
      <Field label="Contact person">
        <input className={inputCls} value={v.contact_person} onChange={set("contact_person")} />
      </Field>
      <Field label="Phone">
        <input className={inputCls} inputMode="tel" value={v.phone} onChange={set("phone")} />
      </Field>
      <Field label="City">
        <input className={inputCls} value={v.city} onChange={set("city")} />
      </Field>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button className={btnPrimary} disabled={!v.name.trim() || pending} onClick={save}>
        {pending ? "Saving…" : "Save"}
      </button>
    </Sheet>
  );
}

export function CustomersList({ items }: { items: CustomerListItem[] }) {
  const [q, setQ] = useState("");
  const [dueOnly, setDueOnly] = useState(false);
  const [adding, setAdding] = useState(false);

  const list = items
    .filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()) && (!dueOnly || c.dues > 0))
    .sort((a, b) => b.dues - a.dues || a.name.localeCompare(b.name));
  const withDues = list.filter((c) => c.dues > 0);
  const settled = list.filter((c) => c.dues <= 0);

  const row = (c: CustomerListItem) => (
    <Link
      key={c.id}
      href={`/cashflow/customers/${c.id}`}
      className="flex items-center gap-3 rounded-2xl border bg-card p-3"
    >
      <Avatar name={c.name} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{c.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {c.products || "No deals yet"}
          {c.openDeals ? ` · ${c.openDeals} open deal${c.openDeals > 1 ? "s" : ""}` : c.products ? " · all paid" : ""}
        </p>
        <p className="text-xs text-muted-foreground">Last payment: {c.lastPaid}</p>
      </div>
      <Pill tone={c.dues > 0 ? "due" : "ok"}>{c.dues > 0 ? `Outstanding ${inr(c.dues)}` : "Paid in full"}</Pill>
    </Link>
  );

  return (
    <div className="flex flex-col gap-3">
      <input
        className={inputCls}
        placeholder="Search customer by name"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="flex gap-2">
        {[
          [false, "All"],
          [true, "Outstanding"],
        ].map(([v, l]) => (
          <button
            key={String(l)}
            onClick={() => setDueOnly(v as boolean)}
            className={cn(
              "rounded-full border px-4 py-2 text-xs font-semibold",
              dueOnly === v ? "border-primary bg-primary text-primary-foreground" : "bg-card"
            )}
          >
            {l as string}
          </button>
        ))}
      </div>
      {withDues.length > 0 && (
        <p className="mt-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Outstanding ({withDues.length}) · highest first
        </p>
      )}
      {withDues.map(row)}
      {settled.length > 0 && (
        <p className="mt-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Paid in full ({settled.length})
        </p>
      )}
      {settled.map(row)}
      {list.length === 0 && (
        <div className="rounded-2xl border bg-card p-3 text-sm text-muted-foreground">
          No customers found.
        </div>
      )}
      <button
        onClick={() => setAdding(true)}
        className="h-11 rounded-xl bg-accent text-sm font-semibold text-primary"
      >
        + New customer
      </button>
      {adding && <CustomerFormSheet open={adding} onClose={() => setAdding(false)} />}
    </div>
  );
}
