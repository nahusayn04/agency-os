// Shared (client + server) types, defaults, URL helpers and sanitizers for the
// Prospect research panel (Online Presence / Competitors / Checklist).

export const MAX_COMPETITORS = 5;
export const DEFAULT_COMPETITOR_ROWS = 3;
export const MAX_CHECKLIST_ITEMS = 50;

const URL_MAX = 500;
const NAME_MAX = 100;
const HEADING_MAX = 100;
const QUESTION_MAX = 1500;
const ANSWER_MAX = 5000;

export interface OnlinePresence {
  existing_website: string;
  demo_website: string;
  instagram: string;
  facebook: string;
  linkedin: string;
  other: string;
  google_business: string;
  justdial: string;
}

export interface Competitor {
  id: string;
  name: string;
  link: string;
}

export interface ChecklistItem {
  id: string;
  heading: string;
  question: string;
  answer: string;
  done: boolean;
}

export const EMPTY_ONLINE_PRESENCE: OnlinePresence = {
  existing_website: "",
  demo_website: "",
  instagram: "",
  facebook: "",
  linkedin: "",
  other: "",
  google_business: "",
  justdial: "",
};

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function emptyCompetitors(): Competitor[] {
  return Array.from({ length: DEFAULT_COMPETITOR_ROWS }, (_, i) => ({
    id: "c" + (i + 1),
    name: "",
    link: "",
  }));
}

const DEFAULT_CHECKLIST: Array<Pick<ChecklistItem, "heading" | "question">> = [
  {
    heading: "Customer Funnel",
    question:
      "Business mein abhi sabse zyada customers kis source se aa rahe hain?",
  },
  {
    heading: "Sales Numbers",
    question:
      "Weekly aur monthly enquiries aur wo enquiries ki actual sales kitni hain? Business apni available market size opportunity ke comparison mein kitna achieve kar raha hai?",
  },
  {
    heading: "Customer Reach",
    question:
      "Aise bahut se log honge jinhe aapki services ya products ki zarurat hai, lekin woh abhi aapke business ko nahi jaante. Un tak pahunchne mein aapko sabse badi challenges kya lagti hain?",
  },
  {
    heading: "Brand Image & Positioning",
    question:
      "Jab koi pehli baar aapke business ke baare mein sunta ya online dekhta hai, toh aapko kya lagta hai ki pehli nazar mein aapke business ki image kitni professional aur bharosemand banti hai?\nAksar customers un businesses par jaldi bharosa karte hain jo Premium, Trustworthy aur Innovative nazar aate hain, chahe services ki quality sabki achhi hi kyun na ho.\nAap chahte hain ki log aapke business ko kis tarah dekhein aur yaad rakhein?",
  },
  {
    heading: "Operations & Automation",
    question:
      "Aapke business ka roz ka kaam, jaise enquiry lena, billing, records aur follow-up, abhi kaise chalta hai? Isme sabse zyada time aur mehnat kis kaam mein jaati hai?",
  },
  {
    heading: "Existing Customers & Retention",
    question:
      "Jo customers aapse pehle hi kuch le chuke hain, unme se kitne dobara aate hain? Unka record aur contact aap kahan rakhte hain? Kya unse referral, repeat sale ya naye offer ke liye kabhi dobara baat hoti hai?",
  },
  {
    heading: "Finance & Management Headache",
    question:
      "Roz ke kaam mein paisa, cashflow, hisaab-kitaab, payments aur team ko sambhalne mein sabse zyada sar-dard kis cheez ka rehta hai? Is sab mein aapka kitna time jaata hai, aur business badhane ke liye kitna time bachta hai?",
  },
];

export function defaultChecklist(): ChecklistItem[] {
  return DEFAULT_CHECKLIST.map((q) => ({
    id: newId(),
    heading: q.heading,
    question: q.question,
    answer: "",
    done: false,
  }));
}

// ---------- URL helpers ----------

/** Adds https:// when no scheme is typed. Leaves plain text (with spaces) alone. */
export function normalizeUrl(raw: string): string {
  const v = (raw ?? "").trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  if (/\s/.test(v)) return v;
  // Any other scheme (javascript:, data:, ...) is not allowed.
  if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(v)) return "";
  return "https://" + v.replace(/^\/+/, "");
}

/** Safe href for an <a>, or null when the value isn't a clickable http(s) URL. */
export function toHref(raw: string): string | null {
  const v = normalizeUrl(raw);
  if (!v || /\s/.test(v)) return null;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

// ---------- Sanitizers (used on read and on the server before saving) ----------

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

export function sanitizeOnlinePresence(input: unknown): OnlinePresence {
  const src = (input && typeof input === "object" ? input : {}) as Record<
    string,
    unknown
  >;
  const out = { ...EMPTY_ONLINE_PRESENCE };
  for (const key of Object.keys(out) as Array<keyof OnlinePresence>) {
    out[key] = normalizeUrl(str(src[key], URL_MAX));
  }
  return out;
}

export function sanitizeCompetitors(input: unknown): Competitor[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, MAX_COMPETITORS).map((raw, i) => {
    const c = (raw && typeof raw === "object" ? raw : {}) as Record<
      string,
      unknown
    >;
    return {
      id: str(c.id, 40) || "c" + (i + 1),
      name: str(c.name, NAME_MAX),
      link: normalizeUrl(str(c.link, URL_MAX)),
    };
  });
}

export function sanitizeChecklist(input: unknown): ChecklistItem[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, MAX_CHECKLIST_ITEMS).map((raw) => {
    const c = (raw && typeof raw === "object" ? raw : {}) as Record<
      string,
      unknown
    >;
    return {
      id: str(c.id, 40) || newId(),
      heading: str(c.heading, HEADING_MAX),
      question: str(c.question, QUESTION_MAX),
      answer: str(c.answer, ANSWER_MAX),
      done: c.done === true,
    };
  });
}

/** What the card/drawer should show when the DB has nothing saved yet. */
export function readOnlinePresence(v: unknown): OnlinePresence {
  return sanitizeOnlinePresence(v);
}

export function readCompetitors(v: unknown): Competitor[] {
  const list = sanitizeCompetitors(v);
  if (list.length === 0) return emptyCompetitors();
  return list;
}

export function readChecklist(v: unknown): ChecklistItem[] {
  if (!Array.isArray(v)) return defaultChecklist(); // never saved yet
  return sanitizeChecklist(v);
}
