"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, Globe, Loader2, Mic, Phone, Search, Star } from "lucide-react";
import { findExistingPhonesAction } from "@/lib/crm/import-actions";
import { addFoundLeadsAction } from "@/lib/crm/find-actions";
import type { FoundPlace } from "@/lib/apify/places";

type Mode = "category" | "name";
type Usage = { usedUsd: number; budgetUsd: number; remainingUsd: number } | null;
type User = { id: string; name: string };

const DEFAULT_CITY = "Bhagalpur, Bihar, India";
const POLL_MS = 3000;
const POLL_MAX_MS = 180_000;
const COST_PER_PLACE = 0.004; // Apify Google Maps Scraper ≈ $4 / 1,000 places

const FIELD =
  "h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20";

// Minimal typing for the browser speech API (Chrome / Edge / Android Chrome / Safari).
type SpeechRec = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

function getSpeechCtor(): (new () => SpeechRec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function noteFor(p: FoundPlace, query: string, city: string): string {
  const parts = [
    `Source: Google Maps (${query}, ${city.split(",")[0].trim()})`,
    p.category ? p.category : "",
    p.rating !== null ? `Rating ${p.rating}${p.reviews ? ` (${p.reviews} reviews)` : ""}` : "No rating",
    p.website ? `Website: ${p.website}` : "No website on Maps",
    p.mapsUrl ? p.mapsUrl : "",
  ];
  return parts.filter(Boolean).join(" | ");
}

export function FindBusinesses({
  users,
  currentUserId,
  usage: initialUsage,
  hasToken,
}: {
  users: User[];
  currentUserId: string;
  usage: Usage;
  hasToken: boolean;
}) {
  const [mode, setMode] = useState<Mode>("category");
  const [query, setQuery] = useState("");
  const [city, setCity] = useState(DEFAULT_CITY);
  const [usage, setUsage] = useState<Usage>(initialUsage);

  const [searching, setSearching] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [places, setPlaces] = useState<FoundPlace[] | null>(null);
  const [lastSearch, setLastSearch] = useState({ query: "", city: "" });
  const [existing, setExisting] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [noWebsiteOnly, setNoWebsiteOnly] = useState(false);
  const [lowRatingOnly, setLowRatingOnly] = useState(false);
  const [sameCityOnly, setSameCityOnly] = useState(true);

  const [assignTo, setAssignTo] = useState(currentUserId);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [adding, startAdding] = useTransition();

  const [listening, setListening] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);
  const stopRef = useRef(false);

  useEffect(() => {
    setCanSpeak(Boolean(getSpeechCtor()));
    try {
      const saved = localStorage.getItem("fb_city");
      if (saved) setCity(saved);
    } catch {
      /* private mode — ignore */
    }
    return () => {
      stopRef.current = true;
      recRef.current?.stop();
    };
  }, []);

  /* ------------------------------ voice ------------------------------ */
  function toggleMic() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const Ctor = getSpeechCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "en-IN";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const text = e.results?.[0]?.[0]?.transcript ?? "";
      if (text) setQuery(text.replace(/[.,]+$/, "").trim());
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setError("Microphone access is blocked. Allow the mic in your browser settings.");
      }
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setError(null);
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }

  /* ----------------------------- searching ---------------------------- */
  const search = useCallback(async () => {
    const q = query.trim();
    const c = city.trim();
    if (searching) return;
    setError(null);
    setMessage(null);
    if (q.length < 2) return setError("Enter what you want to find (e.g. dentist).");
    if (c.length < 2) return setError("Enter a city (e.g. Bhagalpur, Bihar, India).");

    try {
      localStorage.setItem("fb_city", c);
    } catch {
      /* ignore */
    }

    setSearching(true);
    setElapsed(0);
    setPlaces(null);
    setSelected(new Set());
    setAdded(new Set());
    setExisting(new Set());

    const startedAt = Date.now();
    const tick = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);

    try {
      const res = await fetch("/api/find-businesses/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, query: q, city: c }),
      });
      const started = await res.json();
      if (!res.ok) throw new Error(started?.error ?? "Could not start the search.");
      if (started.usage) setUsage(started.usage);

      let result: { places: FoundPlace[]; usage?: Usage } | null = null;
      while (Date.now() - startedAt < POLL_MAX_MS) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        const sres = await fetch(`/api/find-businesses/status?runId=${encodeURIComponent(started.runId)}`, {
          cache: "no-store",
        });
        const s = await sres.json();
        if (!sres.ok) throw new Error(s?.error ?? "Could not check search status.");
        if (s.state === "failed") throw new Error(s.message ?? "Search failed.");
        if (s.state === "done") {
          result = s;
          break;
        }
      }
      if (!result) throw new Error("The search took too long. Please try again in a moment.");

      if (result.usage) setUsage(result.usage);
      setLastSearch({ query: q, city: c });
      setPlaces(result.places);

      const phones = result.places.map((p) => p.phone10).filter(Boolean);
      if (phones.length) {
        const found = await findExistingPhonesAction(phones);
        setExisting(new Set(found));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      clearInterval(tick);
      setSearching(false);
    }
  }, [query, city, mode, searching]);

  /* ----------------------------- filtering ---------------------------- */
  const cityToken = useMemo(() => lastSearch.city.split(",")[0].trim().toLowerCase(), [lastSearch.city]);

  const visible = useMemo(() => {
    if (!places) return [];
    return places.filter((p) => {
      if (noWebsiteOnly && p.website) return false;
      if (lowRatingOnly && !(p.rating !== null && p.rating < 4)) return false;
      if (sameCityOnly && cityToken && !`${p.city} ${p.address}`.toLowerCase().includes(cityToken)) return false;
      return true;
    });
  }, [places, noWebsiteOnly, lowRatingOnly, sameCityOnly, cityToken]);

  const hiddenByCity =
    places && sameCityOnly && cityToken
      ? places.filter((p) => !`${p.city} ${p.address}`.toLowerCase().includes(cityToken)).length
      : 0;

  function status(p: FoundPlace): "ok" | "exists" | "added" | "nophone" {
    if (added.has(p.placeId)) return "added";
    if (!p.phone10) return "nophone";
    if (existing.has(p.phone10)) return "exists";
    return "ok";
  }

  const selectable = visible.filter((p) => status(p) === "ok");
  const selectedPlaces = selectable.filter((p) => selected.has(p.placeId));

  function toggle(p: FoundPlace) {
    if (status(p) !== "ok") return;
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(p.placeId)) n.delete(p.placeId);
      else n.add(p.placeId);
      return n;
    });
  }

  function toggleAll() {
    const all = selectable.length > 0 && selectable.every((p) => selected.has(p.placeId));
    setSelected(all ? new Set() : new Set(selectable.map((p) => p.placeId)));
  }

  function addSelected() {
    const rows = selectedPlaces.map((p) => ({
      name: p.name,
      phone: p.phone10,
      address: p.address,
      note: noteFor(p, lastSearch.query, lastSearch.city),
    }));
    if (rows.length === 0) return;
    setMessage(null);
    startAdding(async () => {
      const res = await addFoundLeadsAction(rows, assignTo);
      if (!res.ok) {
        setMessage({ kind: "err", text: res.error });
        return;
      }
      setAdded((a) => {
        const n = new Set(a);
        selectedPlaces.forEach((p) => n.add(p.placeId));
        return n;
      });
      setSelected(new Set());
      setMessage({
        kind: "ok",
        text: `${res.created} lead${res.created === 1 ? "" : "s"} added${
          res.duplicates ? ` · ${res.duplicates} already existed` : ""
        }${res.warning ? ` · ${res.warning}` : ""}`,
      });
    });
  }

  const placesLeft = usage ? Math.floor(usage.remainingUsd / COST_PER_PLACE) : null;
  const usedPct = usage ? Math.min(100, (usage.usedUsd / usage.budgetUsd) * 100) : 0;

  /* ------------------------------- render ----------------------------- */
  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center gap-3">
        <Link
          href="/crm"
          aria-label="Back to CRM"
          className="grid h-9 w-9 place-items-center rounded-xl border bg-card text-muted-foreground shadow-card"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Find Businesses</h1>
          <p className="text-sm text-muted-foreground">Find new leads on Google Maps and add them in one click.</p>
        </div>
      </div>

      {!hasToken && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          APIFY_TOKEN is not set. Add it in Vercel → Environment Variables and redeploy.
        </p>
      )}

      <div className="rounded-2xl border bg-card p-4 shadow-card">
        <div className="flex gap-1 rounded-xl bg-muted p-1 text-xs font-medium">
          {([
            ["category", "Category (up to 20)"],
            ["name", "By name (up to 5)"],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setMode(k)}
              className={`flex-1 rounded-lg px-3 py-2 transition-colors ${
                mode === k ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-[1.4fr_1fr_auto]">
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder={mode === "category" ? "dentist, gym, coaching…" : "Business name, e.g. AMP Media"}
              className={`${FIELD} ${canSpeak ? "pr-11" : ""}`}
              maxLength={80}
              aria-label="What to find"
            />
            {canSpeak && (
              <button
                type="button"
                onClick={toggleMic}
                aria-label={listening ? "Stop listening" : "Search by voice"}
                className={`absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-lg transition-colors ${
                  listening ? "animate-pulse bg-red-500 text-white" : "bg-accent text-primary"
                }`}
              >
                <Mic size={16} />
              </button>
            )}
          </div>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="City"
            className={FIELD}
            maxLength={80}
            aria-label="City"
          />
          <button
            type="button"
            onClick={search}
            disabled={searching || !hasToken}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-card disabled:opacity-50"
          >
            {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Search
          </button>
        </div>

        {listening && <p className="mt-2 text-xs text-primary">Listening… say what you want (e.g. “dentist”), then press Search.</p>}

        {usage && (
          <div className="mt-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${usedPct}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              This month: ${usage.usedUsd.toFixed(2)} / ${usage.budgetUsd.toFixed(2)} · about {placesLeft?.toLocaleString("en-IN")} places left
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </p>
      )}

      {searching && (
        <div className="flex items-center gap-3 rounded-2xl border bg-card p-4 text-sm shadow-card">
          <Loader2 size={18} className="animate-spin text-primary" />
          <div>
            <p className="font-medium">Fetching data from Google Maps…</p>
            <p className="text-xs text-muted-foreground">{elapsed}s · usually takes 20–60 seconds. Please keep this page open.</p>
          </div>
        </div>
      )}

      {places && !searching && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {[
              ["No website", noWebsiteOnly, setNoWebsiteOnly],
              ["Rating below 4", lowRatingOnly, setLowRatingOnly],
              [`Only ${lastSearch.city.split(",")[0].trim() || "this city"}`, sameCityOnly, setSameCityOnly],
            ].map(([label, on, set]) => (
              <button
                key={label as string}
                type="button"
                onClick={() => (set as (v: boolean) => void)(!(on as boolean))}
                className={`rounded-full border px-3 py-1.5 font-medium transition-colors ${
                  on ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground"
                }`}
              >
                {label as string}
              </button>
            ))}
            <span className="ml-auto text-muted-foreground">
              {visible.length} shown
              {hiddenByCity > 0 && sameCityOnly ? ` · ${hiddenByCity} from other cities hidden` : ""}
            </span>
          </div>

          {visible.length === 0 ? (
            <p className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground shadow-card">
              {places.length === 0
                ? "Nothing found. Try a different name or city."
                : "No results match the filters. Try turning one off."}
            </p>
          ) : (
            <div className="space-y-2">
              {visible.map((p, i) => {
                const st = status(p);
                const isSel = selected.has(p.placeId);
                return (
                  <motion.div
                    key={p.placeId}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.4) }}
                    className={`flex gap-3 rounded-2xl border bg-card p-3 shadow-card ${st !== "ok" ? "opacity-70" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(p)}
                      disabled={st !== "ok"}
                      aria-label={isSel ? "Unselect" : "Select"}
                      className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 ${
                        isSel ? "border-primary bg-primary text-primary-foreground" : "border-primary/40"
                      } disabled:cursor-not-allowed disabled:border-muted`}
                    >
                      {isSel && <Check size={14} />}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="truncate text-sm font-semibold">{p.name}</p>
                        {st === "exists" && <Badge tone="warn">Already in leads</Badge>}
                        {st === "added" && <Badge tone="ok">Added</Badge>}
                        {st === "nophone" && <Badge tone="muted">No phone</Badge>}
                      </div>
                      {p.category && <p className="text-[11px] text-muted-foreground">{p.category}</p>}
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{p.address || "—"}</p>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                        {p.rating !== null ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5">
                            <Star size={11} className="fill-amber-400 text-amber-400" />
                            {p.rating}
                            {p.reviews !== null && <span className="text-muted-foreground">({p.reviews})</span>}
                          </span>
                        ) : (
                          <span className="rounded-md bg-muted px-2 py-0.5 text-muted-foreground">No rating</span>
                        )}
                        {p.website ? (
                          <a
                            href={p.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex max-w-[11rem] items-center gap-1 truncate rounded-md bg-muted px-2 py-0.5 text-primary"
                          >
                            <Globe size={11} /> Website
                          </a>
                        ) : (
                          <span className="rounded-md bg-red-500/10 px-2 py-0.5 font-medium text-red-600 dark:text-red-400">
                            No website
                          </span>
                        )}
                        {p.phone && (
                          <a
                            href={`tel:${p.phone.replace(/[^\d+]/g, "")}`}
                            className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 font-medium text-primary"
                          >
                            <Phone size={11} /> {p.phone}
                          </a>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {places && !searching && selectable.length > 0 && (
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            className="sticky bottom-20 z-20 rounded-2xl border bg-card p-3 shadow-2xl lg:bottom-4"
          >
            {message && (
              <p
                className={`mb-2 rounded-lg px-3 py-1.5 text-xs font-medium ${
                  message.kind === "ok" ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"
                }`}
              >
                {message.text}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={toggleAll}
                className="rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-primary"
              >
                {selectable.every((p) => selected.has(p.placeId)) ? "Clear" : "Select all"}
              </button>
              {users.length > 1 && (
                <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  Assign
                  <select
                    value={assignTo}
                    onChange={(e) => setAssignTo(e.target.value)}
                    className="h-9 rounded-lg border border-input bg-card px-2 text-xs text-foreground"
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.id === currentUserId ? `${u.name} (me)` : u.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button
                type="button"
                onClick={addSelected}
                disabled={adding || selectedPlaces.length === 0}
                className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-50"
              >
                {adding && <Loader2 size={14} className="animate-spin" />}
                {adding ? "Adding…" : `Add ${selectedPlaces.length} lead${selectedPlaces.length === 1 ? "" : "s"}`}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {places && !searching && selectable.length === 0 && message && (
        <p
          className={`rounded-xl px-3 py-2 text-xs font-medium ${
            message.kind === "ok" ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}

function Badge({ tone, children }: { tone: "ok" | "warn" | "muted"; children: React.ReactNode }) {
  const cls =
    tone === "ok"
      ? "bg-green-500/10 text-green-600"
      : tone === "warn"
        ? "bg-amber-500/15 text-amber-600"
        : "bg-muted text-muted-foreground";
  return <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{children}</span>;
}
