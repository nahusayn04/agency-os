import type {
  DocKind,
  HisabCustomer,
  HisabDeal,
  HisabDoc,
  HisabItem,
  HisabPayment,
} from "@/lib/hisab/types";

// ---------- dates (India time, as YYYY-MM-DD strings) ----------
export const todayIST = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

const dayNum = (s: string) =>
  Math.floor(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 864e5);

/** days between today and the given date. positive = in the past */
export const daysAgo = (s: string) => dayNum(todayIST()) - dayNum(s);

export const fmtDate = (s: string) =>
  new Date(s + "T00:00:00Z").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

export const shortDate = (s: string) =>
  new Date(s + "T00:00:00Z").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

export const monthLabel = (s: string) =>
  new Date(s.slice(0, 7) + "-01T00:00:00Z").toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

export const rel = (d: number) =>
  d < 0
    ? `in ${-d} ${d === -1 ? "day" : "days"}`
    : d === 0
      ? "today"
      : `${d} ${d === 1 ? "day" : "days"} ago`;

export const inr = (n: number) => "₹" + Math.abs(n).toLocaleString("en-IN");

export const dealName = (items: HisabItem[]) =>
  items.map((i) => (i.qty > 1 ? `${i.qty} × ` : "") + i.product).join(", ");

// ---------- ledger ----------
export type DealRow = HisabDeal & {
  paid: number;
  left: number;
  payments: HisabPayment[];
};

export type CustomerRow = HisabCustomer & {
  deals: DealRow[];
  sales: number;
  received: number;
  dues: number;
  lastPaid: string | null;
  docs: Partial<Record<DocKind, HisabDoc>>;
};

export function buildLedger(
  customers: HisabCustomer[],
  deals: HisabDeal[],
  payments: HisabPayment[],
  docs: HisabDoc[]
): CustomerRow[] {
  const payByDeal = new Map<string, HisabPayment[]>();
  for (const p of payments) {
    const list = payByDeal.get(p.deal_id) ?? [];
    list.push(p);
    payByDeal.set(p.deal_id, list);
  }
  const dealsByCustomer = new Map<string, DealRow[]>();
  for (const d of deals) {
    const ps = (payByDeal.get(d.id) ?? []).sort((a, b) => a.paid_on.localeCompare(b.paid_on));
    const paid = ps.reduce((a, p) => a + p.amount, 0);
    const row: DealRow = { ...d, paid, left: d.total - paid, payments: ps };
    const list = dealsByCustomer.get(d.customer_id) ?? [];
    list.push(row);
    dealsByCustomer.set(d.customer_id, list);
  }
  const docsByCustomer = new Map<string, Partial<Record<DocKind, HisabDoc>>>();
  for (const doc of docs) {
    // docs arrive newest first, so the first one per kind wins
    const m = docsByCustomer.get(doc.customer_id) ?? {};
    if (!m[doc.kind]) m[doc.kind] = doc;
    docsByCustomer.set(doc.customer_id, m);
  }
  return customers.map((c) => {
    const ds = (dealsByCustomer.get(c.id) ?? []).sort((a, b) =>
      a.deal_date.localeCompare(b.deal_date)
    );
    const sales = ds.reduce((a, d) => a + d.total, 0);
    const received = ds.reduce((a, d) => a + d.paid, 0);
    const paidDates = ds.flatMap((d) => d.payments.map((p) => p.paid_on)).sort();
    return {
      ...c,
      deals: ds,
      sales,
      received,
      dues: sales - received,
      lastPaid: paidDates.length ? paidDates[paidDates.length - 1] : null,
      docs: docsByCustomer.get(c.id) ?? {},
    };
  });
}

export const openDealsOf = (c: CustomerRow) =>
  c.deals.filter((d) => d.left > 0);

export const pendingText = (c: CustomerRow) =>
  openDealsOf(c)
    .map((d) => `${dealName(d.items)} ${inr(d.left)}`)
    .join(", ");

/** days since last payment; if none yet, days since the oldest deal */
export const idleDays = (c: CustomerRow) => {
  if (c.lastPaid) return daysAgo(c.lastPaid);
  return c.deals.length ? daysAgo(c.deals[0].deal_date) : 0;
};

// ---------- home feed ----------
export type FeedItem = {
  kind: "Payment" | "Document";
  customerId: string;
  name: string;
  headline: string;
  detail: string;
  reminder: boolean;
  amountDue: number;
  priority: number;
};

export function buildFeed(rows: CustomerRow[], alertDays: number) {
  const hot: FeedItem[] = [];
  const soon: FeedItem[] = [];
  for (const c of rows) {
    if (c.dues > 0) {
      const promiseGap = c.promise_date ? daysAgo(c.promise_date) : null; // >0 = missed
      if (c.promise_date && c.promise_amount && promiseGap! > 0) {
        hot.push({
          kind: "Payment",
          customerId: c.id,
          name: c.name,
          headline: `${c.name} missed a payment promise`,
          detail: `Promised ${inr(c.promise_amount)} on ${fmtDate(c.promise_date)}. Pending: ${pendingText(c)}.`,
          reminder: true,
          amountDue: c.dues,
          priority: 1,
        });
      } else if (idleDays(c) >= alertDays) {
        hot.push({
          kind: "Payment",
          customerId: c.id,
          name: c.name,
          headline: `No payment from ${c.name} for ${idleDays(c)} days`,
          detail: `Pending: ${pendingText(c)}. ${
            c.last_reminder_at
              ? "Last reminder was " +
                rel(daysAgo(c.last_reminder_at.slice(0, 10))) +
                "."
              : "No reminder sent yet."
          }`,
          reminder: true,
          amountDue: c.dues,
          priority: 2,
        });
      }
      if (c.promise_date && c.promise_amount && promiseGap! <= 0) {
        soon.push({
          kind: "Payment",
          customerId: c.id,
          name: c.name,
          headline: `${c.name} will pay ${rel(promiseGap!)}`,
          detail: `Promised ${inr(c.promise_amount)} for ${fmtDate(c.promise_date)}.`,
          reminder: false,
          amountDue: c.dues,
          priority: 10 + -promiseGap!,
        });
      }
    }
    const missing: string[] = [];
    if (!c.docs.agreement) missing.push("agreement");
    if (!c.docs.invoice) missing.push("invoice");
    if (!c.docs.proof && c.received > 0) missing.push("payment proof");
    if (missing.length) {
      const text = missing.join(", ");
      soon.push({
        kind: "Document",
        customerId: c.id,
        name: c.name,
        headline: `${text.charAt(0).toUpperCase() + text.slice(1)} missing for ${c.name}`,
        detail: "Tap to open and add it.",
        reminder: false,
        amountDue: 0,
        priority: 100,
      });
    }
  }
  hot.sort((a, b) => a.priority - b.priority || b.amountDue - a.amountDue);
  soon.sort((a, b) => a.priority - b.priority);
  return { hot, soon };
}

// ---------- helpers ----------
export function groupByMonth<T>(list: T[], dateOf: (x: T) => string) {
  const groups: { key: string; items: T[] }[] = [];
  for (const item of list) {
    const key = dateOf(item).slice(0, 7);
    let g = groups.find((x) => x.key === key);
    if (!g) groups.push((g = { key, items: [] }));
    g.items.push(item);
  }
  return groups;
}

export function whatsappUrl(phone: string | null, text: string) {
  let digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length === 10) digits = "91" + digits;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function addDays(s: string, n: number) {
  const t = Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) + n * 864e5;
  return new Date(t).toISOString().slice(0, 10);
}
