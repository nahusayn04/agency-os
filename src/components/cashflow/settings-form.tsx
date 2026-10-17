"use client";

import { useState, useTransition } from "react";
import { Card, Field, SectionLabel, btnPrimary, btnMiniSoft, inputCls, textareaCls } from "@/components/cashflow/ui";
import { saveSettingsAction } from "@/lib/cashflow/actions";
import type { CashflowProduct, CashflowSettings } from "@/lib/cashflow/types";
import { cn } from "@/lib/utils";

export function SettingsForm({ initial }: { initial: CashflowSettings }) {
  const [biz, setBiz] = useState(initial.business_name);
  const [products, setProducts] = useState<CashflowProduct[]>(initial.products);
  const [categories, setCategories] = useState<string[]>(initial.categories);
  const [alertDays, setAlertDays] = useState(initial.alert_days);
  const [msg, setMsg] = useState(initial.reminder_message);
  const [invT, setInvT] = useState(initial.invoice_template);
  const [agT, setAgT] = useState(initial.agreement_template);
  const [newProd, setNewProd] = useState("");
  const [newRate, setNewRate] = useState("");
  const [newCat, setNewCat] = useState("");
  const [status, setStatus] = useState("");
  const [pending, start] = useTransition();

  const addProduct = () => {
    const name = newProd.trim();
    if (!name || products.some((p) => p.name === name)) return;
    setProducts([...products, { name, rate: Number(newRate.replace(/\D/g, "")) || 0 }]);
    setNewProd("");
    setNewRate("");
  };
  const addCategory = () => {
    const c = newCat.trim();
    if (!c || categories.includes(c)) return;
    setCategories([...categories, c]);
    setNewCat("");
  };

  function save() {
    setStatus("");
    start(async () => {
      const res = await saveSettingsAction({
        business_name: biz,
        alert_days: alertDays,
        reminder_message: msg,
        products,
        categories,
        invoice_template: invT,
        agreement_template: agT,
      });
      setStatus(res.ok ? "Saved" : res.error);
    });
  }

  const tag = "inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-primary";

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <Field label="Business name">
          <input className={inputCls} value={biz} onChange={(e) => setBiz(e.target.value)} />
        </Field>
        <p className="mt-1 text-xs text-muted-foreground">Shown on your invoices and agreements.</p>
      </Card>

      <SectionLabel>What I sell (name and default rate)</SectionLabel>
      <Card className="flex flex-col gap-2">
        {products.map((p, i) => (
          <div key={p.name} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
            <input
              className={cn(inputCls, "w-28")}
              inputMode="numeric"
              placeholder="Rate"
              value={p.rate || ""}
              onChange={(e) =>
                setProducts(products.map((x, j) => (j === i ? { ...x, rate: Number(e.target.value.replace(/\D/g, "")) || 0 } : x)))
              }
            />
            <button className={btnMiniSoft} aria-label={`Remove ${p.name}`} onClick={() => setProducts(products.filter((_, j) => j !== i))}>
              ×
            </button>
          </div>
        ))}
        <div className="flex gap-2">
          <input className={inputCls} placeholder="Add a product or service" value={newProd} onChange={(e) => setNewProd(e.target.value)} />
          <input className={cn(inputCls, "w-28")} inputMode="numeric" placeholder="Rate" value={newRate} onChange={(e) => setNewRate(e.target.value)} />
          <button className={btnMiniSoft + " h-11"} onClick={addProduct}>
            Add
          </button>
        </div>
      </Card>

      <SectionLabel>Expense categories</SectionLabel>
      <Card>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <span key={c} className={tag}>
              {c}
              <button aria-label={`Remove ${c}`} className="px-1 text-base leading-none" onClick={() => setCategories(categories.filter((x) => x !== c))}>
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input className={inputCls} placeholder="Add a category" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
          <button className={btnMiniSoft + " h-11"} onClick={addCategory}>
            Add
          </button>
        </div>
      </Card>

      <SectionLabel>Alerts</SectionLabel>
      <Card>
        <p className="mb-2 text-xs text-muted-foreground">Warn when a customer has not paid for</p>
        <div className="flex gap-2">
          {[15, 30, 45, 60].map((n) => (
            <button
              key={n}
              onClick={() => setAlertDays(n)}
              className={cn(
                "rounded-full border px-4 py-2 text-xs font-semibold",
                alertDays === n ? "border-primary bg-primary text-primary-foreground" : "bg-card"
              )}
            >
              {n} days
            </button>
          ))}
        </div>
      </Card>

      <SectionLabel>Reminder message</SectionLabel>
      <Card>
        <textarea className={textareaCls + " h-24 resize-none"} value={msg} onChange={(e) => setMsg(e.target.value)} />
        <p className="mt-1 text-xs text-muted-foreground">Use {"{name}"} and {"{amount}"}. They fill in automatically.</p>
      </Card>

      <SectionLabel>Invoice template</SectionLabel>
      <Card>
        <textarea className={textareaCls + " h-56 text-xs"} value={invT} onChange={(e) => setInvT(e.target.value)} />
        <p className="mt-1 text-xs text-muted-foreground">
          Words inside {"{ }"} fill in by themselves: {"{business} {customer} {contact} {city} {phone} {invoice_no} {date} {items} {total} {paid} {due}"}
        </p>
      </Card>

      <SectionLabel>Agreement template</SectionLabel>
      <Card>
        <textarea className={textareaCls + " h-64 text-xs"} value={agT} onChange={(e) => setAgT(e.target.value)} />
        <p className="mt-1 text-xs text-muted-foreground">
          Also: {"{start_date} {days} {terms}"}, plus the ones above.
        </p>
      </Card>

      <button className={btnPrimary} disabled={pending} onClick={save}>
        {pending ? "Saving…" : "Save settings"}
      </button>
      {status && (
        <p className={cn("text-center text-xs", status === "Saved" ? "text-emerald-600" : "text-red-600")}>{status}</p>
      )}
    </div>
  );
}
