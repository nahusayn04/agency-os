"use client";

import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { enablePush, getPushStatus, type PushStatus } from "@/lib/notifications/client-push";

const SNOOZE_KEY = "agencyos_push_prompt_until";
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Slim banner shown until notifications are allowed on this device. Tapping
 * "Turn on" is the user gesture the browser needs to show its permission box.
 */
export function PushPrompt() {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [hidden, setHidden] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const s = getPushStatus();
    setStatus(s);
    let until = 0;
    try {
      until = Number(localStorage.getItem(SNOOZE_KEY) ?? 0);
    } catch {
      /* storage blocked: just show it */
    }
    setHidden(s !== "default" || Date.now() < until);
  }, []);

  if (hidden || status !== "default") return null;

  async function turnOn() {
    setBusy(true);
    const result = await enablePush();
    setBusy(false);
    setStatus(result.status);
    if (result.ok || result.status !== "default") setHidden(true);
  }

  function later() {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    } catch {
      /* ignore */
    }
    setHidden(true);
  }

  return (
    <div className="border-b border-primary/20 bg-accent px-3 py-2 transition-[margin-left] duration-300 ease-in-out lg:ml-[var(--sidebar-w)]">
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        <BellRing size={16} className="shrink-0 text-primary" />
        <p className="min-w-0 flex-1 text-sm font-semibold text-foreground">
          Turn on notifications so no lead is missed
        </p>
        <button
          type="button"
          onClick={turnOn}
          disabled={busy}
          className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Working..." : "Turn on"}
        </button>
        <button
          type="button"
          onClick={later}
          aria-label="Remind me later"
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-card"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
