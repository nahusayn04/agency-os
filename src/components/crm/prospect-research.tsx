"use client";

import {
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ExternalLink, Plus, Trash2, X } from "lucide-react";
import { saveProspectResearchAction } from "@/lib/crm/actions";
import {
  MAX_CHECKLIST_ITEMS,
  MAX_COMPETITORS,
  newId,
  normalizeUrl,
  readChecklist,
  readCompetitors,
  readOnlinePresence,
  toHref,
  type ChecklistItem,
  type Competitor,
  type OnlinePresence,
} from "@/lib/crm/prospect-research";

export interface ProspectResearchSaved {
  online_presence?: OnlinePresence;
  competitors?: Competitor[];
  checklist?: ChecklistItem[];
}

interface Props {
  leadId: string;
  leadName: string;
  onlinePresence: unknown;
  competitors: unknown;
  checklist: unknown;
  /** Card sits on the coral "hot lead" background. */
  onCoral?: boolean;
  onSaved?: (saved: ProspectResearchSaved) => void;
}

type PanelKey = "presence" | "competitors" | "checklist";

const inputCls =
  "w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary";
const primaryBtn =
  "rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50";
const ghostBtn =
  "rounded-md border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50";

// ---------------------------------------------------------------------------
// Card buttons + drawer
// ---------------------------------------------------------------------------

export function ProspectResearch({
  leadId,
  leadName,
  onlinePresence,
  competitors,
  checklist,
  onCoral = false,
  onSaved,
}: Props) {
  const [open, setOpen] = useState<PanelKey | null>(null);
  const [presence, setPresence] = useState(() => readOnlinePresence(onlinePresence));
  const [comps, setComps] = useState(() => readCompetitors(competitors));
  const [items, setItems] = useState(() => readChecklist(checklist));
  const dirtyRef = useRef(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent | TouchEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [menuOpen]);

  const done = items.filter((i) => i.done).length;

  function requestClose() {
    if (
      dirtyRef.current &&
      !window.confirm("Unsaved changes hain. Band karein?")
    ) {
      return;
    }
    dirtyRef.current = false;
    setOpen(null);
  }

  function openPanel(key: PanelKey) {
    dirtyRef.current = false;
    setOpen(key);
  }

  const itemCls =
    "block w-full px-3 py-2 text-left text-xs font-semibold text-foreground transition-colors hover:bg-accent";

  function pick(key: PanelKey) {
    setMenuOpen(false);
    openPanel(key);
  }

  return (
    <>
      <div
        ref={menuRef}
        className={
          "relative " + (onCoral ? "rounded-xl bg-card p-1.5" : "")
        }
      >
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          className="flex w-full items-center justify-center gap-1 rounded-lg bg-accent px-2 py-2 text-xs font-semibold text-primary transition-colors hover:bg-accent/70"
        >
          Research
          <span className="font-normal text-muted-foreground">
            {done}/{items.length}
          </span>
          <ChevronDown
            size={14}
            className={"transition-transform " + (menuOpen ? "rotate-180" : "")}
          />
        </button>
        {menuOpen && (
          <div
            role="menu"
            className={
              "absolute z-20 mt-1 overflow-hidden rounded-lg border bg-card shadow-lg " +
              (onCoral ? "left-1.5 right-1.5" : "left-0 right-0")
            }
          >
            <button type="button" role="menuitem" onClick={() => pick("presence")} className={itemCls}>
              Online Presence
            </button>
            <button type="button" role="menuitem" onClick={() => pick("competitors")} className={itemCls + " border-t"}>
              Competitors
            </button>
            <button type="button" role="menuitem" onClick={() => pick("checklist")} className={itemCls + " border-t"}>
              Checklist{" "}
              <span className="font-normal text-muted-foreground">
                {done}/{items.length}
              </span>
            </button>
          </div>
        )}
      </div>

      {open && (
        <Drawer
          title={
            open === "presence"
              ? "Online Presence"
              : open === "competitors"
              ? "Competitors"
              : "Checklist"
          }
          subtitle={leadName}
          badge={open === "checklist" ? `${done}/${items.length} done` : undefined}
          onClose={requestClose}
        >
          {open === "presence" && (
            <PresencePanel
              leadId={leadId}
              value={presence}
              dirtyRef={dirtyRef}
              onSaved={(v) => {
                setPresence(v);
                onSaved?.({ online_presence: v });
              }}
            />
          )}
          {open === "competitors" && (
            <CompetitorsPanel
              leadId={leadId}
              value={comps}
              dirtyRef={dirtyRef}
              onSaved={(v) => {
                setComps(v);
                onSaved?.({ competitors: v });
              }}
            />
          )}
          {open === "checklist" && (
            <ChecklistPanel
              leadId={leadId}
              items={items}
              setItems={setItems}
              onSaved={(v) => onSaved?.({ checklist: v })}
            />
          )}
        </Drawer>
      )}
    </>
  );
}

function Drawer({
  title,
  subtitle,
  badge,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  badge?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeRef.current();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, []);

  // React events bubble through portals into the lead card, whose long-press
  // (delete) handlers must never see presses made inside the drawer.
  const isolate = (e: React.SyntheticEvent) => e.stopPropagation();

  return createPortal(
    <div
      className="fixed inset-0 z-50"
      onMouseDown={isolate}
      onMouseMove={isolate}
      onMouseUp={isolate}
      onTouchStart={isolate}
      onTouchMove={isolate}
      onTouchEnd={isolate}
      onTouchCancel={isolate}
      onClick={isolate}
    >
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute right-0 top-0 flex h-full w-full flex-col border-l bg-background shadow-2xl animate-in slide-in-from-right duration-200 sm:max-w-md"
      >
        <header className="flex items-start justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">
              {title}
              {badge && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {badge}
                </span>
              )}
            </h2>
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X size={18} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
      </aside>
    </div>,
    document.body
  );
}

function SaveBar({
  saving,
  error,
  savedAt,
  dirty,
  onSave,
}: {
  saving: boolean;
  error: string | null;
  savedAt: number | null;
  dirty: boolean;
  onSave: () => void;
}) {
  return (
    <div className="sticky bottom-0 -mx-4 -mb-4 mt-4 flex items-center justify-between gap-3 border-t bg-background px-4 py-3">
      <span
        className={
          "text-xs " + (error ? "text-destructive" : "text-muted-foreground")
        }
      >
        {error ?? (dirty ? "Unsaved changes" : savedAt ? "Saved ✓" : "")}
      </span>
      <button
        type="button"
        onClick={onSave}
        disabled={saving || !dirty}
        className={primaryBtn}
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Link field: input + clickable open icon
// ---------------------------------------------------------------------------

function LinkInput({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
}) {
  const href = toHref(value);
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="text"
        inputMode="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => onChange(normalizeUrl(value))}
        placeholder={placeholder}
        aria-label={label}
        className={inputCls}
      />
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title={"Open " + label}
          aria-label={"Open " + label}
          className="shrink-0 rounded-md border p-2 text-primary hover:bg-accent"
        >
          <ExternalLink size={16} />
        </a>
      ) : (
        <span className="shrink-0 rounded-md border border-dashed p-2 text-muted-foreground/40">
          <ExternalLink size={16} />
        </span>
      )}
    </div>
  );
}

function useSaver() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  return { saving, setSaving, error, setError, savedAt, setSavedAt };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium">{label}</label>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Online Presence
// ---------------------------------------------------------------------------

function PresencePanel({
  leadId,
  value,
  dirtyRef,
  onSaved,
}: {
  leadId: string;
  value: OnlinePresence;
  dirtyRef: MutableRefObject<boolean>;
  onSaved: (v: OnlinePresence) => void;
}) {
  const [draft, setDraft] = useState(value);
  const s = useSaver();
  const base = useRef(JSON.stringify(value));
  const dirty = JSON.stringify(draft) !== base.current;

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty, dirtyRef]);

  function set(key: keyof OnlinePresence) {
    return (v: string) => setDraft((d) => ({ ...d, [key]: v }));
  }

  async function save() {
    s.setSaving(true);
    s.setError(null);
    const next: OnlinePresence = Object.fromEntries(
      Object.entries(draft).map(([k, v]) => [k, normalizeUrl(v)])
    ) as unknown as OnlinePresence;
    const res = await saveProspectResearchAction(leadId, { online_presence: next });
    s.setSaving(false);
    if (res?.error) {
      s.setError(res.error);
      return;
    }
    setDraft(next);
    base.current = JSON.stringify(next);
    dirtyRef.current = false;
    s.setSavedAt(Date.now());
    onSaved(next);
  }

  return (
    <div className="space-y-6">
      <Section title="Website">
        <Field label="Existing Website URL">
          <LinkInput
            value={draft.existing_website}
            onChange={set("existing_website")}
            placeholder="example.com"
            label="existing website"
          />
        </Field>
        <Field label="Demo Website URL">
          <LinkInput
            value={draft.demo_website}
            onChange={set("demo_website")}
            placeholder="demo link"
            label="demo website"
          />
        </Field>
      </Section>

      <Section title="Social Media Profiles">
        <Field label="Instagram">
          <LinkInput
            value={draft.instagram}
            onChange={set("instagram")}
            placeholder="instagram.com/..."
            label="Instagram"
          />
        </Field>
        <Field label="Facebook">
          <LinkInput
            value={draft.facebook}
            onChange={set("facebook")}
            placeholder="facebook.com/..."
            label="Facebook"
          />
        </Field>
        <Field label="LinkedIn">
          <LinkInput
            value={draft.linkedin}
            onChange={set("linkedin")}
            placeholder="linkedin.com/..."
            label="LinkedIn"
          />
        </Field>
        <Field label="Other">
          <LinkInput
            value={draft.other}
            onChange={set("other")}
            placeholder="YouTube, X, etc."
            label="other profile"
          />
        </Field>
      </Section>

      <Section title="Business Listings">
        <Field label="Google Business Profile URL">
          <LinkInput
            value={draft.google_business}
            onChange={set("google_business")}
            placeholder="google.com/maps/..."
            label="Google Business Profile"
          />
        </Field>
        <Field label="Justdial Profile URL">
          <LinkInput
            value={draft.justdial}
            onChange={set("justdial")}
            placeholder="justdial.com/..."
            label="Justdial profile"
          />
        </Field>
      </Section>

      <SaveBar
        saving={s.saving}
        error={s.error}
        savedAt={s.savedAt}
        dirty={dirty}
        onSave={save}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Competitors
// ---------------------------------------------------------------------------

function CompetitorsPanel({
  leadId,
  value,
  dirtyRef,
  onSaved,
}: {
  leadId: string;
  value: Competitor[];
  dirtyRef: MutableRefObject<boolean>;
  onSaved: (v: Competitor[]) => void;
}) {
  const [rows, setRows] = useState(value);
  const s = useSaver();
  const base = useRef(JSON.stringify(value));
  const dirty = JSON.stringify(rows) !== base.current;

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty, dirtyRef]);

  function patch(id: string, p: Partial<Competitor>) {
    setRows((r) => r.map((c) => (c.id === id ? { ...c, ...p } : c)));
  }

  async function save() {
    s.setSaving(true);
    s.setError(null);
    const next = rows.map((c) => ({
      ...c,
      name: c.name.trim(),
      link: normalizeUrl(c.link),
    }));
    const res = await saveProspectResearchAction(leadId, { competitors: next });
    s.setSaving(false);
    if (res?.error) {
      s.setError(res.error);
      return;
    }
    setRows(next);
    base.current = JSON.stringify(next);
    dirtyRef.current = false;
    s.setSavedAt(Date.now());
    onSaved(next);
  }

  return (
    <div>
      <div className="grid grid-cols-[1fr_1.4fr_auto] gap-2 pb-2 text-xs font-semibold text-muted-foreground">
        <span>Competitor Name</span>
        <span>Website / Social Link</span>
        <span className="w-8" />
      </div>

      <div className="space-y-2">
        {rows.map((c, i) => (
          <div key={c.id} className="grid grid-cols-[1fr_1.4fr_auto] items-center gap-2">
            <input
              type="text"
              value={c.name}
              onChange={(e) => patch(c.id, { name: e.target.value })}
              placeholder={"Competitor " + String.fromCharCode(65 + i)}
              aria-label={"Competitor " + (i + 1) + " name"}
              className={inputCls}
            />
            <LinkInput
              value={c.link}
              onChange={(v) => patch(c.id, { link: v })}
              placeholder="Add Link"
              label={"competitor " + (i + 1) + " link"}
            />
            <button
              type="button"
              onClick={() => setRows((r) => r.filter((x) => x.id !== c.id))}
              aria-label="Remove competitor"
              className="w-8 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          disabled={rows.length >= MAX_COMPETITORS}
          onClick={() =>
            setRows((r) => [...r, { id: newId(), name: "", link: "" }])
          }
          className={ghostBtn + " inline-flex items-center gap-1"}
        >
          <Plus size={14} /> Add Competitor
        </button>
        <span className="text-xs text-muted-foreground">
          {rows.length}/{MAX_COMPETITORS}
        </span>
      </div>

      <SaveBar
        saving={s.saving}
        error={s.error}
        savedAt={s.savedAt}
        dirty={dirty}
        onSave={save}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------

function ChecklistPanel({
  leadId,
  items,
  setItems,
  onSaved,
}: {
  leadId: string;
  items: ChecklistItem[];
  setItems: (v: ChecklistItem[]) => void;
  onSaved: (v: ChecklistItem[]) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  // Only one question is open at a time; the rest are collapsed.
  const [activeId, setActiveId] = useState<string | null>(items[0]?.id ?? null);
  const latest = useRef(items);
  latest.current = items;

  /** Optimistic update; reverts if the save fails. */
  async function commit(next: ChecklistItem[]): Promise<boolean> {
    const prev = latest.current;
    setItems(next);
    latest.current = next;
    setError(null);
    const res = await saveProspectResearchAction(leadId, { checklist: next });
    if (res?.error) {
      setItems(prev);
      latest.current = prev;
      setError(res.error);
      return false;
    }
    onSaved(next);
    return true;
  }

  function update(id: string, p: Partial<ChecklistItem>) {
    return commit(
      latest.current.map((i) => (i.id === id ? { ...i, ...p } : i))
    );
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </p>
      )}

      {items.length === 0 && !adding && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Koi question nahi hai. Neeche se add karo.
        </p>
      )}

      {items.map((item) => (
        <ChecklistRow
          key={item.id}
          item={item}
          active={item.id === activeId}
          onActivate={() => setActiveId(item.id)}
          onToggle={() => update(item.id, { done: !item.done })}
          onSaveAnswer={(answer) => update(item.id, { answer })}
          onSaveQuestion={(heading, question) =>
            update(item.id, { heading, question })
          }
          onDelete={() => commit(latest.current.filter((i) => i.id !== item.id))}
        />
      ))}

      {adding ? (
        <QuestionForm
          submitLabel="Add Question"
          onCancel={() => setAdding(false)}
          onSubmit={async (heading, question) => {
            const nid = newId();
            const ok = await commit([
              ...latest.current,
              { id: nid, heading, question, answer: "", done: false },
            ]);
            if (ok) {
              setAdding(false);
              setActiveId(nid);
            }
            return ok;
          }}
        />
      ) : (
        <button
          type="button"
          disabled={items.length >= MAX_CHECKLIST_ITEMS}
          onClick={() => setAdding(true)}
          className={ghostBtn + " inline-flex w-full items-center justify-center gap-1"}
        >
          <Plus size={14} /> Add Question
        </button>
      )}
    </div>
  );
}

function QuestionForm({
  initialHeading = "",
  initialQuestion = "",
  submitLabel,
  onSubmit,
  onCancel,
  onDelete,
}: {
  initialHeading?: string;
  initialQuestion?: string;
  submitLabel: string;
  onSubmit: (heading: string, question: string) => Promise<boolean>;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [heading, setHeading] = useState(initialHeading);
  const [question, setQuestion] = useState(initialQuestion);
  const [busy, setBusy] = useState(false);
  const empty = !heading.trim() && !question.trim();

  return (
    <div className="space-y-2 rounded-xl border bg-card-soft p-3">
      <input
        type="text"
        value={heading}
        onChange={(e) => setHeading(e.target.value)}
        placeholder="Heading (optional)"
        aria-label="Heading"
        className={inputCls}
      />
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Question"
        aria-label="Question"
        rows={5}
        className={inputCls}
      />
      <div className="flex items-center justify-between gap-2">
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1 text-xs text-destructive hover:underline"
          >
            <Trash2 size={13} /> Delete
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className={ghostBtn}>
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || empty}
            onClick={async () => {
              setBusy(true);
              await onSubmit(heading.trim(), question.trim());
              setBusy(false);
            }}
            className={primaryBtn}
          >
            {busy ? "Saving…" : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChecklistRow({
  item,
  active,
  onActivate,
  onToggle,
  onSaveAnswer,
  onSaveQuestion,
  onDelete,
}: {
  item: ChecklistItem;
  active: boolean;
  onActivate: () => void;
  onToggle: () => void;
  onSaveAnswer: (answer: string) => Promise<boolean>;
  onSaveQuestion: (heading: string, question: string) => Promise<boolean>;
  onDelete: () => void;
}) {
  const [showAnswer, setShowAnswer] = useState(false);
  const [editing, setEditing] = useState(false);
  const [answer, setAnswer] = useState(item.answer);
  const [savingAnswer, setSavingAnswer] = useState(false);
  const answerDirty = answer !== item.answer;

  // Closing a row (another one opened) hides its answer box and edit form.
  useEffect(() => {
    if (!active) {
      setShowAnswer(false);
      setEditing(false);
    }
  }, [active]);

  if (!active) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onActivate}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onActivate();
          }
        }}
        className="flex cursor-pointer items-center gap-2.5 rounded-xl border bg-card-soft p-3 opacity-60 transition-opacity hover:opacity-100"
      >
        <input
          type="checkbox"
          checked={item.done}
          onClick={(e) => e.stopPropagation()}
          onChange={onToggle}
          aria-label={"Mark " + (item.heading || "question") + " as discussed"}
          className="h-4 w-4 shrink-0 cursor-pointer accent-[hsl(var(--primary))]"
        />
        <p
          className={
            "min-w-0 flex-1 truncate text-sm font-semibold " +
            (item.done ? "text-muted-foreground line-through" : "")
          }
        >
          {item.heading || item.question || "Question"}
        </p>
        <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
      </div>
    );
  }

  if (editing) {
    return (
      <QuestionForm
        initialHeading={item.heading}
        initialQuestion={item.question}
        submitLabel="Save"
        onCancel={() => setEditing(false)}
        onSubmit={async (h, q) => {
          const ok = await onSaveQuestion(h, q);
          if (ok) setEditing(false);
          return ok;
        }}
        onDelete={() => {
          if (window.confirm("Ye question delete karein?")) onDelete();
        }}
      />
    );
  }

  return (
    <div className="rounded-xl border bg-card-soft p-3">
      <div className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={item.done}
          onChange={onToggle}
          aria-label={"Mark " + (item.heading || "question") + " as discussed"}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[hsl(var(--primary))]"
        />
        <div className="min-w-0 flex-1">
          {item.heading && (
            <p
              className={
                "text-sm font-semibold " +
                (item.done ? "text-muted-foreground line-through" : "")
              }
            >
              {item.heading}
            </p>
          )}
          {item.question && (
            <p className="mt-0.5 whitespace-pre-wrap break-words text-xs text-muted-foreground">
              {item.question}
            </p>
          )}
          <div className="mt-2 flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={() => setShowAnswer((v) => !v)}
              aria-expanded={showAnswer}
              className="font-medium text-primary hover:underline"
            >
              {showAnswer ? "Hide Answer ↑" : "Show Answer ↓"}
              {!showAnswer && item.answer && (
                <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-green-500 align-middle" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-muted-foreground hover:text-foreground hover:underline"
            >
              Edit Question
            </button>
          </div>

          {showAnswer && (
            <div className="mt-2 space-y-2">
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Write prospect's answer here..."
                rows={4}
                className={inputCls}
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={savingAnswer || !answerDirty}
                  onClick={async () => {
                    setSavingAnswer(true);
                    await onSaveAnswer(answer);
                    setSavingAnswer(false);
                  }}
                  className={primaryBtn}
                >
                  {savingAnswer ? "Saving…" : answerDirty ? "Save Answer" : "Saved ✓"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
