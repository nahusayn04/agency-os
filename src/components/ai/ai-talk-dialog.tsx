"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Mic, SendHorizontal, Sparkles, X } from "lucide-react";

type Confirm = { title: string; rows: [string, string][] };
type Msg = {
  id: number;
  role: "user" | "ai";
  text?: string;
  confirm?: Confirm;
  status?: "pending" | "done" | "cancelled";
};

const CHIPS = [
  "Naya lead add karo",
  "Aaj ke follow-ups kaun se hain?",
  "Atki hui deals dikhao",
  "Task banao",
];

const WELCOME: Msg = {
  id: 0,
  role: "ai",
  text: "Namaste! Main AI Talk hoon. Bolo, lead add karna ho, follow-up set karna ho ya kuch poochna ho. Hinglish mein likho, main samajh lunga.",
};

// TODO(backend): replace this stub with a real call to /api/ai/talk
// (server route + function calling). The UI only needs { text?, confirm? } back.
async function askAi(text: string): Promise<{ text?: string; confirm?: Confirm }> {
  await new Promise((r) => setTimeout(r, 900));
  if (/lead|add|naya/i.test(text)) {
    return {
      text: "Ye lead bana dun? Details check kar lo:",
      confirm: {
        title: "New lead",
        rows: [
          ["Name", "Rahul Sharma"],
          ["Phone", "98765 43210"],
          ["Follow-up", "Kal, 5:00 PM"],
        ],
      },
    };
  }
  return {
    text: "AI abhi connect nahi hua hai, ye sirf preview hai. Connect hone ke baad main lead add, follow-up set aur sawaalon ke jawab yahin se kar dunga.",
  };
}

export function AiTalkDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;
    const userId = nextId.current++;
    const aiId = nextId.current++;
    setInput("");
    if (areaRef.current) areaRef.current.style.height = "auto";
    setMsgs((m) => [...m, { id: userId, role: "user", text }]);
    setBusy(true);
    try {
      const r = await askAi(text);
      setMsgs((m) => [
        ...m,
        { id: aiId, role: "ai", text: r.text, confirm: r.confirm, status: r.confirm ? "pending" : undefined },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function resolve(id: number, status: "done" | "cancelled") {
    setMsgs((m) => m.map((x) => (x.id === id ? { ...x, status } : x)));
  }

  const onlyWelcome = msgs.length === 1;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="AI Talk"
            className="flex h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border bg-card shadow-2xl sm:h-[80vh] sm:rounded-3xl"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3 border-b px-4 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Sparkles size={17} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold leading-tight">AI Talk</h2>
                <p className="text-xs text-muted-foreground">Bolo, entry ho jayegi</p>
              </div>
              <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-muted-foreground hover:bg-accent">
                <X size={18} />
              </button>
            </div>

            <div className="bg-muted px-4 py-1.5 text-center text-[11px] text-muted-foreground">
              Preview: AI abhi connect nahi hai, jawab demo hain.
            </div>

            {/* Messages */}
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {msgs.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[85%] ${m.role === "user" ? "" : "space-y-2"}`}>
                    {m.text && (
                      <div
                        className={
                          m.role === "user"
                            ? "rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-primary-foreground"
                            : "rounded-2xl rounded-bl-md bg-muted px-3.5 py-2 text-sm"
                        }
                      >
                        {m.text}
                      </div>
                    )}
                    {m.confirm && (
                      <div className="rounded-2xl border bg-card p-3 shadow-card">
                        <p className="text-xs font-semibold uppercase tracking-wide text-primary">{m.confirm.title}</p>
                        <dl className="mt-2 space-y-1 text-sm">
                          {m.confirm.rows.map(([k, v]) => (
                            <div key={k} className="flex justify-between gap-4">
                              <dt className="text-muted-foreground">{k}</dt>
                              <dd className="font-medium">{v}</dd>
                            </div>
                          ))}
                        </dl>
                        {m.status === "pending" ? (
                          <div className="mt-3 flex gap-2">
                            <button
                              onClick={() => resolve(m.id, "cancelled")}
                              className="flex-1 rounded-xl border px-3 py-2 text-xs font-semibold text-muted-foreground"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => resolve(m.id, "done")}
                              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                            >
                              <Check size={14} /> Confirm
                            </button>
                          </div>
                        ) : (
                          <p className="mt-3 text-xs text-muted-foreground">
                            {m.status === "done" ? "Confirmed (demo, kuch save nahi hua)" : "Cancelled"}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}

              {busy && (
                <div className="flex justify-start">
                  <div className="flex gap-1 rounded-2xl rounded-bl-md bg-muted px-4 py-3" aria-label="AI is typing">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {onlyWelcome && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {CHIPS.map((c) => (
                    <button
                      key={c}
                      onClick={() => send(c)}
                      className="rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-primary shadow-card"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
              <div ref={endRef} />
            </div>

            {/* Input */}
            <div className="border-t px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
              <div className="flex items-end gap-2 rounded-2xl border bg-card p-1.5">
                <button
                  type="button"
                  disabled
                  title="Voice: jald aayega"
                  aria-label="Voice input (coming soon)"
                  className="rounded-full p-2 text-muted-foreground opacity-50"
                >
                  <Mic size={18} />
                </button>
                <textarea
                  ref={areaRef}
                  rows={1}
                  value={input}
                  placeholder="Kuch bhi likho..."
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.currentTarget.style.height = "auto";
                    e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 112)}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  className="max-h-28 flex-1 resize-none bg-transparent px-1 py-2 text-sm outline-none placeholder:text-muted-foreground"
                />
                <button
                  type="button"
                  onClick={() => send(input)}
                  disabled={!input.trim() || busy}
                  aria-label="Send"
                  className="rounded-full bg-primary p-2 text-primary-foreground disabled:opacity-40"
                >
                  <SendHorizontal size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
