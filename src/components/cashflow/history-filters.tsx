"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Field, inputCls } from "@/components/cashflow/ui";
import { cn } from "@/lib/utils";

type Props = {
  tab: "deals" | "expenses";
  mode: "month" | "all" | "custom";
  month: string;
  from: string;
  to: string;
  products: string[];
  customers: { id: string; name: string }[];
  categories: string[];
};

export function HistoryFilters(p: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const get = (k: string) => sp.get(k) ?? "";

  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const chip = (active: boolean) =>
    cn(
      "whitespace-nowrap rounded-full border px-4 py-2 text-xs font-semibold",
      active ? "border-primary bg-primary text-primary-foreground" : "bg-card"
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-1.5">
        {([["deals", "Deals"], ["expenses", "Expenses"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => set({ tab: k })} className={cn("h-10 rounded-xl border text-sm font-semibold", p.tab === k ? "border-primary bg-primary text-primary-foreground" : "bg-card")}>
            {l}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        {([["month", "Month"], ["all", "All time"], ["custom", "Custom"]] as const).map(([k, l]) => (
          <button key={k} className={chip(p.mode === k)} onClick={() => set({ mode: k })}>
            {l}
          </button>
        ))}
      </div>

      {p.mode === "month" && (
        <Field label="Month">
          <input type="month" className={inputCls} value={p.month} onChange={(e) => e.target.value && set({ month: e.target.value })} />
        </Field>
      )}
      {p.mode === "custom" && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="From">
            <input type="date" className={inputCls} value={p.from} onChange={(e) => e.target.value && set({ from: e.target.value })} />
          </Field>
          <Field label="To">
            <input type="date" className={inputCls} value={p.to} onChange={(e) => e.target.value && set({ to: e.target.value })} />
          </Field>
        </div>
      )}

      {p.tab === "deals" ? (
        <>
          <div className="flex gap-2">
            {([["", "All"], ["pending", "Pending"], ["paid", "Paid"]] as const).map(([k, l]) => (
              <button key={l} className={chip(get("status") === k)} onClick={() => set({ status: k })}>
                {l}
              </button>
            ))}
          </div>
          <Field label="Product">
            <select className={inputCls} value={get("product")} onChange={(e) => set({ product: e.target.value })}>
              <option value="">All products</option>
              {p.products.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          <Field label="Customer">
            <select className={inputCls} value={get("customer")} onChange={(e) => set({ customer: e.target.value })}>
              <option value="">All customers</option>
              {p.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </>
      ) : (
        <Field label="Category">
          <select className={inputCls} value={get("category")} onChange={(e) => set({ category: e.target.value })}>
            <option value="">All categories</option>
            {p.categories.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>
      )}
    </div>
  );
}
