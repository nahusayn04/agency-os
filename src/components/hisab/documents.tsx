"use client";

import { useRef, useState, useTransition } from "react";
import { Sheet } from "@/components/hisab/sheet";
import { Field, Pill, btnPrimary, btnSoft, btnWa, inputCls, textareaCls } from "@/components/hisab/ui";
import { createClient } from "@/lib/supabase/client";
import { fmtDate, inr, whatsappUrl } from "@/lib/hisab/calc";
import { buildDocText } from "@/lib/hisab/templates";
import {
  getDocumentUrlAction,
  recordUploadAction,
  saveDocumentAction,
  updateDocumentAction,
} from "@/lib/hisab/actions";
import type { DocKind, HisabItem } from "@/lib/hisab/types";

export type DocLite = {
  id: string;
  source: "made" | "pdf";
  content: string | null;
  file_path: string | null;
  file_name: string | null;
  doc_number: string | null;
};
export type DealLite = {
  id: string;
  label: string;
  items: HisabItem[];
  total: number;
  paid: number;
  left: number;
};

const NAMES: Record<DocKind, string> = { agreement: "Agreement", invoice: "Invoice", proof: "Payment proof" };

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function printDoc(title: string, text: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(
    `<html><head><title>${esc(title)}</title></head><body style="margin:32px;font-family:system-ui,sans-serif"><pre style="white-space:pre-wrap;font:14px/1.7 system-ui,sans-serif">${esc(text)}</pre></body></html>`
  );
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

export function DocumentsSection({
  customer,
  deals,
  docs,
  settings,
  today,
}: {
  customer: { id: string; name: string; contact_person: string | null; city: string | null; phone: string | null };
  deals: DealLite[];
  docs: Partial<Record<DocKind, DocLite>>;
  settings: { business: string; invoiceTemplate: string; agreementTemplate: string; nextInvoiceNo: number };
  today: string;
}) {
  const [kind, setKind] = useState<DocKind | null>(null);
  const [mode, setMode] = useState<"choose" | "form" | "preview">("choose");
  const [dealId, setDealId] = useState("");
  const [invNo, setInvNo] = useState("");
  const [date, setDate] = useState(today);
  const [start, setStart] = useState(today);
  const [days, setDays] = useState("30");
  const [terms, setTerms] = useState("50% advance, balance on delivery.");
  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, startT] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const doc = kind ? docs[kind] : undefined;
  const isTemplateKind = kind === "invoice" || kind === "agreement";
  const deal = deals.find((d) => d.id === dealId) ?? null;
  const close = () => {
    setKind(null);
    setError("");
  };

  const open = (k: DocKind) => {
    setKind(k);
    setMode("choose");
    setError("");
    setEditingId(null);
  };

  function startForm() {
    setDealId(deals[0]?.id ?? "");
    setInvNo(`INV-${String(settings.nextInvoiceNo).padStart(3, "0")}`);
    setMode("form");
  }

  function preview() {
    setText(
      buildDocText({
        template: kind === "invoice" ? settings.invoiceTemplate : settings.agreementTemplate,
        business: settings.business,
        customer,
        deal,
        invoiceNo: invNo,
        date,
        startDate: start,
        days,
        terms,
      })
    );
    setEditingId(null);
    setMode("preview");
  }

  function save() {
    if (!kind || kind === "proof") return;
    setError("");
    startT(async () => {
      const res = editingId
        ? await updateDocumentAction(editingId, text)
        : await saveDocumentAction({
            customerId: customer.id,
            kind,
            dealId: dealId || null,
            docNumber: kind === "invoice" ? invNo : null,
            content: text,
          });
      if (res.ok) close();
      else setError(res.error);
    });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !kind) return;
    if (file.size > 10 * 1024 * 1024) return setError("File is bigger than 10 MB");
    setError("");
    startT(async () => {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${customer.id}/${kind}-${Date.now()}-${safe}`;
      const { error: upErr } = await createClient().storage.from("hisab-docs").upload(path, file, { upsert: false });
      if (upErr) return setError(upErr.message);
      const res = await recordUploadAction({ customerId: customer.id, kind, filePath: path, fileName: file.name });
      if (res.ok) close();
      else setError(res.error);
    });
  }

  function viewFile() {
    if (!doc?.file_path) return;
    const w = window.open("", "_blank");
    startT(async () => {
      const res = await getDocumentUrlAction(doc.file_path as string);
      if (res.ok && w) w.location.href = res.data;
      else {
        w?.close();
        if (!res.ok) setError(res.error);
      }
    });
  }

  const sub = (k: DocKind) => {
    const d = docs[k];
    if (!d) return k === "proof" ? "Upload photo or PDF" : "Make from template or upload PDF";
    if (d.source === "made") return `Made in app${d.doc_number ? " · " + d.doc_number : ""}`;
    return `PDF uploaded${d.file_name ? " · " + d.file_name : ""}`;
  };

  return (
    <>
      <div className="divide-y rounded-2xl border bg-card px-3">
        {(["agreement", "invoice", "proof"] as DocKind[]).map((k) => (
          <button key={k} onClick={() => open(k)} className="flex w-full items-center justify-between gap-3 py-2.5 text-left">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{NAMES[k]}</p>
              <p className="truncate text-xs text-muted-foreground">{sub(k)}</p>
            </div>
            <Pill tone={docs[k] ? "ok" : "warn"}>{docs[k] ? "Added" : "Add"}</Pill>
          </button>
        ))}
      </div>

      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept={kind === "proof" ? "application/pdf,image/*" : "application/pdf"}
        onChange={onFile}
      />

      <Sheet open={!!kind} onClose={close}>
        {kind && mode === "choose" && (
          <>
            <p className="text-sm font-semibold">
              {NAMES[kind]}
              {doc ? ` · ${doc.source === "made" ? "made in app" : "PDF added"}` : ""}
            </p>
            {doc?.source === "made" && doc.content && (
              <button
                className={btnSoft}
                onClick={() => {
                  setText(doc.content as string);
                  setEditingId(doc.id);
                  setMode("preview");
                }}
              >
                View / edit
              </button>
            )}
            {doc?.source === "pdf" && (
              <button className={btnSoft} disabled={pending} onClick={viewFile}>
                View file
              </button>
            )}
            {isTemplateKind && (
              <button className={btnPrimary} onClick={startForm}>
                {doc ? "Make a new one from template" : "Make from template"}
              </button>
            )}
            <button className={isTemplateKind ? btnSoft : btnPrimary} disabled={pending} onClick={() => fileRef.current?.click()}>
              {pending ? "Uploading…" : `${doc ? "Replace with" : "Upload"} ${kind === "proof" ? "photo or PDF" : "PDF"}`}
            </button>
            {isTemplateKind && (
              <p className="text-xs text-muted-foreground">
                Edit the template in Settings. Upload a PDF if you already have one.
              </p>
            )}
            {error && <p className="text-xs text-red-600">{error}</p>}
          </>
        )}

        {kind && mode === "form" && isTemplateKind && (
          <>
            <p className="text-sm font-semibold">
              Make {kind === "invoice" ? "invoice" : "agreement"} for {customer.name}
            </p>
            {deals.length === 0 ? (
              <div className="rounded-xl bg-accent p-3 text-sm text-primary">
                Add a sale first. The items come from the deal.
              </div>
            ) : (
              <Field label="Which deal">
                <select className={inputCls} value={dealId} onChange={(e) => setDealId(e.target.value)}>
                  {deals.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label} · {inr(d.total)}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {kind === "invoice" ? (
              <>
                <Field label="Invoice number">
                  <input className={inputCls} value={invNo} onChange={(e) => setInvNo(e.target.value)} />
                </Field>
                <Field label="Date">
                  <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
                </Field>
              </>
            ) : (
              <>
                <Field label="Work starts">
                  <input type="date" className={inputCls} value={start} onChange={(e) => setStart(e.target.value)} />
                </Field>
                <Field label="Days to complete">
                  <input className={inputCls} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
                </Field>
                <Field label="Payment terms">
                  <input className={inputCls} value={terms} onChange={(e) => setTerms(e.target.value)} />
                </Field>
              </>
            )}
            <button className={btnPrimary} disabled={deals.length === 0} onClick={preview}>
              Preview
            </button>
          </>
        )}

        {kind && mode === "preview" && (
          <>
            <p className="text-sm font-semibold">
              {NAMES[kind]} · edit if needed ({fmtDate(today)})
            </p>
            <textarea
              className={textareaCls + " h-72 text-xs"}
              aria-label="Document text"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button className={btnPrimary} disabled={pending || !text.trim()} onClick={save}>
              {pending ? "Saving…" : `Save to ${customer.name}`}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                className={btnWa}
                onClick={() => window.open(whatsappUrl(customer.phone, text), "_blank", "noopener")}
              >
                WhatsApp
              </button>
              <button className={btnSoft} onClick={() => printDoc(`${NAMES[kind]} - ${customer.name}`, text)}>
                Download PDF
              </button>
            </div>
            {!editingId && (
              <button className={btnSoft} onClick={() => setMode("form")}>
                ‹ Back
              </button>
            )}
          </>
        )}
      </Sheet>
    </>
  );
}
