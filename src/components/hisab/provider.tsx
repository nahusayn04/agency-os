"use client";

import { createContext, useContext, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { Sheet } from "@/components/hisab/sheet";
import { Field, btnPrimary, btnMiniSoft, inputCls } from "@/components/hisab/ui";
import { inr, shortDate } from "@/lib/hisab/calc";
import {
  createDealAction,
  createExpenseAction,
  createPaymentAction,
} from "@/lib/hisab/actions";
import type { HisabItem, HisabProduct } from "@/lib/hisab/types";
import { cn } from "@/lib/utils";

type Opts = { type?: "s" | "r" | "x"; customerId?: string; dealId?: string };
export type OpenDeal = {
  id: string;
  customerId: string;
  label: string;
  date: string;
  left: number;
  total: number;
};

const Ctx = createContext<{ openEntry: (o?: Opts) => void }>({ openEntry: () => {} });
export const useHisab = () => useContext(Ctx);

const digits = (v: string) => Number(v.replace(/\D/g, "")) || 0;

export function HisabProvider({
  customers,
  openDeals,
  products,
  categories,
  children,
}: {
  customers: { id: string; name: string }[];
  openDeals: OpenDeal[];
  products: HisabProduct[];
  categories: string[];
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const pathCustomer = pathname.match(/\/hisab\/customers\/([0-9a-f-]{36})/)?.[1] ?? "";
  const hideFab = pathname.startsWith("/hisab/settings") || !!pathCustomer;

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"s" | "r" | "x">("s");
  const [customerId, setCustomerId] = useState("");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<HisabItem[]>([]);
  const [advance, setAdvance] = useState("");
  const [note, setNote] = useState("");
  const [dealId, setDealId] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [pending, start] = useTransition();

  const dealsFor = (cid: string) =>
    openDeals.filter((d) => d.customerId === cid).sort((a, b) => a.date.localeCompare(b.date));

  function pickDefaultDeal(cid: string, wanted?: string) {
    const ds = dealsFor(cid);
    const d = ds.find((x) => x.id === wanted) ?? ds[0];
    setDealId(d?.id ?? "");
    setAmount(d ? String(d.left) : "");
  }

  function openEntry(o?: Opts) {
    const cid = o?.customerId ?? pathCustomer;
    const t = o?.type ?? "s";
    setType(t);
    setCustomerId(cid);
    setQ("");
    setItems([]);
    setAdvance("");
    setNote("");
    setError("");
    setCategory(categories[0] ?? "Other");
    if (t === "r") pickDefaultDeal(cid, o?.dealId);
    else {
      setDealId("");
      setAmount("");
    }
    setOpen(true);
  }

  function changeType(t: "s" | "r" | "x") {
    setType(t);
    setError("");
    setAmount("");
    setDealId("");
    if (t === "r") pickDefaultDeal(customerId);
  }

  function pickCustomer(id: string) {
    setCustomerId(id);
    if (type === "r") pickDefaultDeal(id);
  }

  const total = items.reduce((a, i) => a + i.qty * i.rate, 0);
  const deal = openDeals.find((d) => d.id === dealId);
  const amt = digits(amount);
  const canSave =
    type === "x"
      ? amt > 0 && !!category
      : type === "s"
        ? !!customerId && items.length > 0 && total > 0
        : !!deal && amt > 0 && amt <= deal.left;

  const shown = customers.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()));
  const options = customerId && !shown.some((c) => c.id === customerId)
    ? [customers.find((c) => c.id === customerId)!, ...shown].filter(Boolean)
    : shown;

  function toggleProduct(p: HisabProduct) {
    setItems((cur) =>
      cur.some((i) => i.product === p.name)
        ? cur.filter((i) => i.product !== p.name)
        : [...cur, { product: p.name, qty: 1, rate: p.rate }]
    );
  }
  const patchItem = (name: string, patch: Partial<HisabItem>) =>
    setItems((cur) => cur.map((i) => (i.product === name ? { ...i, ...patch } : i)));

  function save() {
    setError("");
    start(async () => {
      const res =
        type === "x"
          ? await createExpenseAction({ category, amount: amt, description: note })
          : type === "s"
            ? await createDealAction({ customerId, items, note, advance: digits(advance) })
            : await createPaymentAction({ dealId, amount: amt, note });
      if (res.ok) {
        setOpen(false);
        setToast("Saved");
        setTimeout(() => setToast(""), 1800);
      } else setError(res.error);
    });
  }

  return (
    <Ctx.Provider value={{ openEntry }}>
      {children}

      {!hideFab && (
        <button
          onClick={() => openEntry({ type: pathname.startsWith("/hisab/history") ? undefined : "s" })}
          className="fixed bottom-24 right-4 z-40 flex h-12 items-center gap-1.5 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg lg:bottom-8"
        >
          <Plus size={18} /> Entry
        </button>
      )}

      {toast && (
        <div className="fixed bottom-40 left-1/2 z-[70] -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background">
          {toast}
        </div>
      )}

      <Sheet open={open} onClose={() => setOpen(false)}>
        <div className="grid grid-cols-3 gap-1.5">
          {([["s", "Sale"], ["r", "Payment"], ["x", "Expense"]] as const).map(([k, l]) => (
            <button
              key={k}
              onClick={() => changeType(k)}
              className={cn(
                "h-10 rounded-xl border text-sm font-semibold",
                type === k ? "border-primary bg-primary text-primary-foreground" : "bg-card"
              )}
            >
              {l}
            </button>
          ))}
        </div>

        {type !== "x" && (
          <Field label="Customer">
            <input
              className={inputCls}
              placeholder="Search customer by name"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              className={inputCls}
              value={customerId}
              onChange={(e) => pickCustomer(e.target.value)}
            >
              <option value="">Choose customer</option>
              {options.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        {type === "s" && customerId && (
          <>
            <Field label="Products (tap to select)">
              <div className="flex flex-wrap gap-2">
                {products.map((p) => {
                  const on = items.some((i) => i.product === p.name);
                  return (
                    <button
                      key={p.name}
                      onClick={() => toggleProduct(p)}
                      className={cn(
                        "rounded-full border px-3.5 py-2 text-xs font-medium",
                        on ? "border-primary bg-primary text-primary-foreground" : "bg-card"
                      )}
                    >
                      {on ? "✓ " : ""}
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </Field>
            {items.map((i) => (
              <div key={i.product} className="rounded-2xl border p-2.5">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span>{i.product}</span>
                  <span>{inr(i.qty * i.rate)}</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button className={cn(btnMiniSoft, "w-10 px-0")} onClick={() => patchItem(i.product, { qty: Math.max(1, i.qty - 1) })}>−</button>
                  <span className="min-w-6 text-center text-sm font-semibold">{i.qty}</span>
                  <button className={cn(btnMiniSoft, "w-10 px-0")} onClick={() => patchItem(i.product, { qty: i.qty + 1 })}>+</button>
                  <span className="text-xs text-muted-foreground">× ₹</span>
                  <input
                    className={cn(inputCls, "flex-1")}
                    inputMode="numeric"
                    placeholder="Rate"
                    value={i.rate || ""}
                    onChange={(e) => patchItem(i.product, { rate: digits(e.target.value) })}
                  />
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold">{inr(total)}</span>
            </div>
            <Field label="Advance received now (optional)">
              <input className={inputCls} inputMode="numeric" placeholder="0" value={advance} onChange={(e) => setAdvance(e.target.value)} />
            </Field>
          </>
        )}

        {type === "r" && customerId && (
          dealsFor(customerId).length === 0 ? (
            <div className="rounded-xl bg-emerald-100 p-3 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              No pending deals for this customer. Add a sale first.
            </div>
          ) : (
            <>
              <Field label="Payment for">
                <select
                  className={inputCls}
                  value={dealId}
                  onChange={(e) => {
                    setDealId(e.target.value);
                    const d = openDeals.find((x) => x.id === e.target.value);
                    setAmount(d ? String(d.left) : "");
                  }}
                >
                  {dealsFor(customerId).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label} · {shortDate(d.date)} · {inr(d.left)} left
                    </option>
                  ))}
                </select>
              </Field>
              <input
                className={inputCls}
                inputMode="numeric"
                placeholder="Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {deal && (
                <p className="text-xs text-muted-foreground">
                  Left on this deal: {inr(deal.left)}
                  {amt > deal.left ? " · amount is more than what is left" : ""}
                </p>
              )}
            </>
          )
        )}

        {type === "x" && (
          <>
            <input className={inputCls} inputMode="numeric" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Field label="Category">
              <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
          </>
        )}

        <input
          className={inputCls}
          placeholder={type === "x" ? "What was it for? (optional)" : "Note (optional)"}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button className={btnPrimary} disabled={!canSave || pending} onClick={save}>
          {pending ? "Saving…" : "Save"}
        </button>
      </Sheet>
    </Ctx.Provider>
  );
}
