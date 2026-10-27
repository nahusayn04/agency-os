import "server-only";

/**
 * Apify "Google Maps Scraper" helpers (server only — the token never reaches the browser).
 *
 * Env:
 *   APIFY_TOKEN                 required
 *   APIFY_ACTOR_ID              optional, default "compass~crawler-google-places"
 *   APIFY_MONTHLY_BUDGET_USD    optional, default 5 (free plan credit)
 */

const API = "https://api.apify.com/v2";
const DEFAULT_ACTOR = "compass~crawler-google-places";

export type FindMode = "category" | "name";

export type FoundPlace = {
  placeId: string;
  name: string;
  category: string;
  address: string;
  city: string;
  phone: string; // as shown on Maps
  phone10: string; // last 10 digits, "" when unusable
  website: string; // "" when none
  rating: number | null;
  reviews: number | null;
  mapsUrl: string;
};

export type ApifyUsage = { usedUsd: number; budgetUsd: number; remainingUsd: number };

function token(): string {
  const t = process.env.APIFY_TOKEN;
  if (!t) throw new Error("APIFY_TOKEN is not set. Add it in Vercel → Environment Variables and redeploy.");
  return t;
}

function actorId(): string {
  return (process.env.APIFY_ACTOR_ID || DEFAULT_ACTOR).trim();
}

function budget(): number {
  const n = Number(process.env.APIFY_MONTHLY_BUDGET_USD);
  return Number.isFinite(n) && n > 0 ? n : 5;
}

async function apify(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token()}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  return res;
}

/** This month's Apify spend. Returns null if Apify's limits endpoint can't be read. */
export async function getApifyUsage(): Promise<ApifyUsage | null> {
  try {
    const res = await apify("/users/me/limits");
    if (!res.ok) return null;
    const json = await res.json();
    const d = json?.data ?? json;
    const used = Number(d?.current?.monthlyUsageUsd);
    if (!Number.isFinite(used)) return null;
    const apifyMax = Number(d?.limits?.maxMonthlyUsageUsd);
    const cap = Math.min(budget(), Number.isFinite(apifyMax) && apifyMax > 0 ? apifyMax : budget());
    return { usedUsd: used, budgetUsd: cap, remainingUsd: Math.max(0, cap - used) };
  } catch {
    return null;
  }
}

const RUN_CAPS: Record<FindMode, { places: number; maxChargeUsd: number }> = {
  // Apify rejects a per-run cap below $0.50. The real spend is bounded by the
  // places limit (20 places ≈ $0.08, 5 places ≈ $0.02), this is just a ceiling.
  category: { places: 20, maxChargeUsd: 0.5 },
  name: { places: 5, maxChargeUsd: 0.5 },
};

export async function startPlacesRun(opts: { mode: FindMode; query: string; city: string }) {
  const cap = RUN_CAPS[opts.mode];
  const input = {
    searchStringsArray: [opts.query],
    locationQuery: opts.city,
    maxCrawledPlacesPerSearch: cap.places,
    language: "en",
    // keep every paid add-on off — we only need basic listing data
    scrapeContacts: false,
    scrapePlaceDetailPage: false,
    maxReviews: 0,
    maxImages: 0,
    maximumLeadsEnrichmentRecords: 0,
  };
  const res = await apify(
    `/acts/${encodeURIComponent(actorId())}/runs?maxTotalChargeUsd=${cap.maxChargeUsd}`,
    { method: "POST", body: JSON.stringify(input) }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Apify could not start the search (${res.status}). ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  const run = json?.data;
  if (!run?.id) throw new Error("Apify did not return a run id.");
  return { runId: String(run.id) as string };
}

export type RunState =
  | { state: "running" }
  | { state: "failed"; message: string }
  | { state: "done"; places: FoundPlace[]; costUsd: number | null };

function last10(p: string): string {
  const d = p.replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : "";
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function normalise(raw: Record<string, unknown>): FoundPlace | null {
  const name = str(raw.title);
  if (!name) return null;
  if (raw.permanentlyClosed === true) return null;
  const phone = str(raw.phone) || str(raw.phoneUnformatted);
  return {
    placeId: str(raw.placeId) || `${name}|${str(raw.address)}`,
    name,
    category: str(raw.categoryName),
    address: str(raw.address) || [str(raw.street), str(raw.city), str(raw.state)].filter(Boolean).join(", "),
    city: str(raw.city),
    phone,
    phone10: last10(str(raw.phoneUnformatted) || phone),
    website: str(raw.website),
    rating: num(raw.totalScore),
    reviews: num(raw.reviewsCount),
    mapsUrl: str(raw.url),
  };
}

export async function getPlacesRun(runId: string): Promise<RunState> {
  const res = await apify(`/actor-runs/${encodeURIComponent(runId)}`);
  if (!res.ok) return { state: "failed", message: `Apify run not found (${res.status}).` };
  const run = (await res.json())?.data;
  const status = String(run?.status ?? "");

  if (status === "READY" || status === "RUNNING" || status === "TIMING-OUT") {
    return { state: "running" };
  }
  if (status !== "SUCCEEDED") {
    return {
      state: "failed",
      message:
        status === "ABORTED"
          ? "Search was stopped."
          : "Search failed. If this keeps happening, check your Apify credit or try again later.",
    };
  }

  const datasetId = String(run?.defaultDatasetId ?? "");
  if (!datasetId) return { state: "done", places: [], costUsd: null };

  const dres = await apify(`/datasets/${encodeURIComponent(datasetId)}/items?format=json&clean=true&limit=60`);
  if (!dres.ok) return { state: "failed", message: `Could not read results (${dres.status}).` };
  const items = (await dres.json()) as Record<string, unknown>[];

  const seen = new Set<string>();
  const places: FoundPlace[] = [];
  for (const it of Array.isArray(items) ? items : []) {
    const p = normalise(it);
    if (!p || seen.has(p.placeId)) continue;
    seen.add(p.placeId);
    places.push(p);
  }

  const cost = Number(run?.usageTotalUsd);
  return { state: "done", places, costUsd: Number.isFinite(cost) ? cost : null };
}
