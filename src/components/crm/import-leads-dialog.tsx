"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Sparkles, X } from "lucide-react";
import {
  findExistingPhonesAction,
  importLeadsAction,
} from "@/lib/crm/import-actions";

type Raw = { name: string; phone: string; address: string };
type Row = Raw & { id: number; selected: boolean; problem: "" | "Duplicate" | "Invalid" };

const MAX_ROWS = 200;
const PHONE_RE = /(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}/;
const PHONE_COL_RE = /^\+?[\d\s-]{10,16}$/;

const SAMPLE = `Dr. Neha Verma | Smile Care Dental | 98765 43210 | Boring Road, Patna
Ravi Traders | Trading firm | 91234 56789 | Station Road, Muzaffarpur
Anjali Boutique | Boutique | 99887 76655 | Kankarbagh, Patna`;

function last10(p: string) {
  const d = p.replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : d;
}

function parseText(text: string): Raw[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      if (/[|\t]/.test(line)) {
        const cols = line.split(/\s*[|\t]\s*/).map((c) => c.trim()).filter(Boolean);
        const pIdx = cols.findIndex((c) => PHONE_COL_RE.test(c));
        const rest = cols.filter((_, i) => i !== pIdx);
        return { name: rest[0] ?? "", phone: pIdx >= 0 ? cols[pIdx] : "", address: rest.slice(1).join(", ") };
      }
      const m = PHONE_RE.exec(line);
      const rest = (m ? line.replace(m[0], " ") : line)
        .split(/\s*[–—,]+\s*|\s+-\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
      return { name: rest[0] ?? "", phone: m ? m[0] : "", address: rest.slice(1).join(", ") };
    });
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; } else q = false;
      } else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

function parseCsv(text: string): Raw[] {
  const rows = parseCsvRows(text);
  if (rows.length === 0) return [];
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const hasHeader = head.some((h) => /name|phone|mobile|address/.test(h));
  const find = (re: RegExp, skip?: RegExp) =>
    head.findIndex((h) => re.test(h) && !(skip && skip.test(h)));
  const idx = hasHeader
    ? {
        name: find(/name|contact|person|lead/, /business|company|shop|clinic|firm/),
        biz: find(/business|company|shop|clinic|firm/),
        phone: find(/phone|mobile|number|whatsapp/),
        addr: find(/address|city|location/),
      }
    : { name: 0, biz: 1, phone: 2, addr: 3 };
  return (hasHeader ? rows.slice(1) : rows).map((c) => {
    const g = (i: number) => (i >= 0 ? (c[i] ?? "").trim() : "");
    return { name: g(idx.name), phone: g(idx.phone), address: [g(idx.biz), g(idx.addr)].filter(Boolean).join(", ") };
  });
}

export function ImportLeadsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [tab, setTab] = useState<"paste" | "csv">("paste");
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [checked, setChecked] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, startBusy] = useTransition();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function reset() {
    setRows([]);
    setChecked(false);
    setMessage(null);
  }

  function analyse(raw: Raw[]) {
    reset();
    if (raw.length === 0) {
      setMessage({ kind: "err", text: "No leads found. Check the format and try again." });
      return;
    }
    const capped = raw.slice(0, MAX_ROWS);
    startBusy(async () => {
      const existing = new Set(await findExistingPhonesAction(capped.map((r) => r.phone)));
      const seen = new Set<string>();
      const next: Row[] = capped.map((r, i) => {
        const p = last10(r.phone);
        let problem: Row["problem"] = "";
        if (!r.name.trim() || p.length !== 10) problem = "Invalid";
        else if (existing.has(p) || seen.has(p)) problem = "Duplicate";
        if (!problem) seen.add(p);
        return { ...r, id: i, selected: !problem, problem };
      });
      setRows(next);
      setChecked(true);
      if (raw.length > MAX_ROWS) {
        setMessage({ kind: "err", text: `Only the first ${MAX_ROWS} leads are shown. Import the rest in another batch.` });
      }
    });
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    analyse(parseCsv(await file.text()));
  }

  const selected = rows.filter((r) => r.selected);
  const dups = rows.filter((r) => r.problem === "Duplicate").length;

  function toggle(id: number) {
    setRows((rs) => rs.map((r) => (r.id === id && !r.problem ? { ...r, selected: !r.selected } : r)));
  }

  function toggleAll() {
    const all = rows.filter((r) => !r.problem).every((r) => r.selected);
    setRows((rs) => rs.map((r) => (r.problem ? r : { ...r, selected: !all })));
  }

  function doImport() {
    startBusy(async () => {
      const res = await importLeadsAction(selected.map(({ name, phone, address }) => ({ name, phone, address })));
      if (!res.ok) {
        setMessage({ kind: "err", text: res.error });
        return;
      }
      setMessage({
        kind: "ok",
        text: `${res.created} lead${res.created === 1 ? "" : "s"} imported${res.duplicates ? ` · ${res.duplicates} duplicate skipped` : ""}.`,
      });
      setRows([]);
      setChecked(false);
      setText("");
      router.refresh();
    });
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Import leads"
            className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-3xl border bg-card p-5 shadow-2xl"
            initial={{ y: 30, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 20, scale: 0.97, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Import Leads</h2>
                <p className="text-xs text-muted-foreground">
                  Add up to {MAX_ROWS} leads at once. Name, phone and address are filled in automatically.
                </p>
              </div>
              <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-muted-foreground hover:bg-accent">
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 flex gap-1 rounded-xl bg-muted p-1 text-xs font-medium">
              {([["paste", "Paste list"], ["csv", "CSV file"]] as const).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => { setTab(k); reset(); }}
                  className={`flex-1 rounded-lg px-3 py-2 transition-colors ${tab === k ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "paste" ? (
              <div className="mt-3 space-y-2">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={SAMPLE}
                  className="h-36 w-full resize-none rounded-xl border border-dashed bg-muted/40 p-3 text-xs outline-none focus:border-primary"
                />
                <div className="flex items-center gap-3">
                  <p className="flex-1 text-[11px] text-muted-foreground">
                    One lead per line: Name | Business | Phone | Address (any order works if a phone number is on the line).
                  </p>
                  <button
                    onClick={() => analyse(parseText(text))}
                    disabled={busy || !text.trim()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    <Sparkles size={14} /> Autofill
                  </button>
                </div>
              </div>
            ) : (
              <label className="mt-3 block cursor-pointer rounded-xl border border-dashed bg-muted/40 p-8 text-center text-xs text-muted-foreground">
                <span className="font-semibold text-primary">Choose a CSV file</span>
                <br />
                Columns: Name, Business, Phone, Address. For Excel, use Save as CSV first.
                <input type="file" accept=".csv,text/csv,.txt" hidden onChange={(e) => onFile(e.target.files?.[0])} />
              </label>
            )}

            {message && (
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-3 rounded-xl px-3 py-2 text-xs font-medium ${message.kind === "ok" ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"}`}
              >
                {message.text}
              </motion.p>
            )}

            {checked && rows.length > 0 && (
              <div className="mt-3">
                <div className="max-h-60 space-y-1.5 overflow-auto pr-1">
                  {rows.map((r, i) => (
                    <motion.button
                      key={r.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.03, 0.5) }}
                      onClick={() => toggle(r.id)}
                      className={`grid w-full grid-cols-[22px_1.2fr_1fr_1.5fr_auto] items-center gap-2 rounded-xl bg-muted/50 px-2.5 py-2 text-left text-[11px] ${r.problem ? "opacity-60" : ""}`}
                    >
                      <span className={`grid h-5 w-5 place-items-center rounded-md border-2 ${r.selected ? "border-primary bg-primary text-primary-foreground" : "border-primary/40"}`}>
                        {r.selected && <Check size={12} />}
                      </span>
                      <span className="truncate font-semibold">{r.name || "—"}</span>
                      <span className="truncate">{r.phone || "—"}</span>
                      <span className="truncate text-muted-foreground">{r.address || "—"}</span>
                      {r.problem ? (
                        <span className="rounded-md bg-destructive/10 px-2 py-0.5 text-[10px] text-destructive">{r.problem}</span>
                      ) : <span />}
                    </motion.button>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <p className="flex-1 text-[11px] text-muted-foreground">
                    {rows.length} found · {selected.length} selected · {dups} duplicate
                  </p>
                  <button onClick={toggleAll} className="rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-primary">
                    Select all
                  </button>
                  <button
                    onClick={doImport}
                    disabled={busy || selected.length === 0}
                    className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {busy ? "Importing…" : `Import ${selected.length} lead${selected.length === 1 ? "" : "s"}`}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
