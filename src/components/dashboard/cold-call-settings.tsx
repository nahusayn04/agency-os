"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface ColdCallTargetRow {
  id: string;
  name: string;
  override: number | null;
  effectiveTarget: number;
  exempt: boolean;
}

export function ColdCallSettings({
  initialDefaultTarget,
  initialMembers,
}: {
  initialDefaultTarget: number;
  initialMembers: ColdCallTargetRow[];
}) {
  const [defaultTarget, setDefaultTarget] = useState(initialDefaultTarget);
  const [defaultInput, setDefaultInput] = useState(String(initialDefaultTarget));
  const [defaultPending, startDefaultTransition] = useTransition();
  const [defaultError, setDefaultError] = useState<string | null>(null);

  const [members, setMembers] = useState(initialMembers);
  const [overrideInputs, setOverrideInputs] = useState<Record<string, string>>(
    Object.fromEntries(initialMembers.map((m) => [m.id, m.override != null ? String(m.override) : ""]))
  );
  const [overridePending, setOverridePending] = useState<string | null>(null);
  const [overrideError, setOverrideError] = useState<Record<string, string>>({});
  const [exemptPending, setExemptPending] = useState<string | null>(null);

  function handleToggleExempt(userId: string, nextExempt: boolean) {
    setExemptPending(userId);
    fetch("/api/admin/cold-call-settings/exempt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, exempt: nextExempt }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.error) return;
        setMembers((cur) => cur.map((m) => (m.id === userId ? { ...m, exempt: nextExempt } : m)));
      })
      .finally(() => setExemptPending(null));
  }

  function handleSaveDefault() {
    const value = Number(defaultInput);
    if (!Number.isInteger(value) || value <= 0) {
      setDefaultError("Enter a positive whole number.");
      return;
    }
    setDefaultError(null);
    startDefaultTransition(async () => {
      const res = await fetch("/api/admin/cold-call-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultTarget: value }),
      });
      const data = await res.json();
      if (data?.error) {
        setDefaultError(data.error);
        return;
      }
      setDefaultTarget(value);
      // Members without an override now follow the new default.
      setMembers((cur) => cur.map((m) => (m.override == null ? { ...m, effectiveTarget: value } : m)));
    });
  }

  function handleSaveOverride(userId: string) {
    const raw = overrideInputs[userId] ?? "";
    const value = raw.trim() === "" ? null : Number(raw);

    if (value !== null && (!Number.isInteger(value) || value <= 0)) {
      setOverrideError((cur) => ({ ...cur, [userId]: "Enter a positive whole number or leave blank." }));
      return;
    }

    setOverrideError((cur) => ({ ...cur, [userId]: "" }));
    setOverridePending(userId);

    fetch("/api/admin/cold-call-settings/override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, target: value }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.error) {
          setOverrideError((cur) => ({ ...cur, [userId]: data.error }));
          return;
        }
        setMembers((cur) =>
          cur.map((m) =>
            m.id === userId
              ? { ...m, override: value, effectiveTarget: value ?? defaultTarget }
              : m
          )
        );
      })
      .finally(() => setOverridePending(null));
  }

  return (
    <div className="min-w-0 space-y-4 rounded-2xl border bg-card p-5 shadow-card lg:p-6">
      <div>
        <h2 className="text-base font-semibold">Cold Calls Target</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Daily target for the mandatory Cold Calls task. Members without a personal override use the default.
        </p>
      </div>

      <div className="rounded-xl bg-muted/50 p-3 lg:px-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="min-w-[110px] flex-1 text-sm font-medium">Default target</span>
          <Input
            type="number"
            min={1}
            value={defaultInput}
            onChange={(e) => setDefaultInput(e.target.value)}
            className="h-10 w-20 rounded-xl"
          />
          <Button className="rounded-xl" size="sm" disabled={defaultPending} onClick={handleSaveDefault}>
            {defaultPending ? "Saving…" : "Save default"}
          </Button>
        </div>
        {defaultError && <p className="mt-2 text-xs text-destructive">{defaultError}</p>}
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Per-member override</p>
        {members.map((m) => (
          <div key={m.id}>
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/50 px-3 py-2">
              <div className="grid h-8 w-8 flex-none place-items-center rounded-full bg-accent text-[13px] font-bold text-primary">
                {m.name.charAt(0).toUpperCase()}
              </div>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {m.name}
                {m.exempt && <span className="ml-2 text-xs font-normal text-muted-foreground">(off)</span>}
              </span>
              <Input
                type="number"
                min={1}
                placeholder={String(defaultTarget)}
                value={overrideInputs[m.id] ?? ""}
                disabled={m.exempt}
                onChange={(e) => setOverrideInputs((cur) => ({ ...cur, [m.id]: e.target.value }))}
                className="h-9 w-16 rounded-xl"
              />
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl"
                disabled={overridePending === m.id || m.exempt}
                onClick={() => handleSaveOverride(m.id)}
              >
                {overridePending === m.id ? "…" : "Save"}
              </Button>
              <button
                type="button"
                disabled={exemptPending === m.id}
                onClick={() => handleToggleExempt(m.id, !m.exempt)}
                className={`rounded-xl px-3 py-2 text-[13px] font-medium disabled:opacity-60 ${
                  m.exempt ? "bg-primary text-primary-foreground" : "bg-destructive/10 text-destructive"
                }`}
              >
                {exemptPending === m.id ? "…" : m.exempt ? "Turn on" : "Turn off"}
              </button>
            </div>
            {overrideError[m.id] && (
              <p className="mt-1 px-1 text-xs text-destructive">
                {m.name}: {overrideError[m.id]}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
