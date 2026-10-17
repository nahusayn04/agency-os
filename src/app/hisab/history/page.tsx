import Link from "next/link";
import { HistoryFilters } from "@/components/hisab/history-filters";
import { Card, Pill } from "@/components/hisab/ui";
import { dealName, groupByMonth, inr, monthLabel, shortDate, todayIST } from "@/lib/hisab/calc";
import { getHisabData } from "@/lib/hisab/data";

type SP = Record<string, string | undefined>;

export default async function HistoryPage({ searchParams }: { searchParams: SP }) {
  const { rows, payments, expenses, settings } = await getHisabData();

  const today = todayIST();
  const tab = searchParams.tab === "expenses" ? "expenses" : "deals";
  const mode = searchParams.mode === "all" || searchParams.mode === "custom" ? searchParams.mode : "month";
  const month = /^\d{4}-\d{2}$/.test(searchParams.month ?? "") ? (searchParams.month as string) : today.slice(0, 7);
  const from = searchParams.from || `${today.slice(0, 7)}-01`;
  const to = searchParams.to || today;
  const inRange = (d: string) =>
    mode === "all" || (mode === "custom" ? d >= from && d <= to : d.startsWith(month));

  const filters = (
    <HistoryFilters
      tab={tab}
      mode={mode}
      month={month}
      from={from}
      to={to}
      products={settings.products.map((p) => p.name)}
      customers={rows.map((c) => ({ id: c.id, name: c.name }))}
      categories={settings.categories}
    />
  );

  if (tab === "deals") {
    const status = searchParams.status;
    const list = rows
      .flatMap((c) => c.deals.map((d) => ({ c, d })))
      .filter(
        ({ c, d }) =>
          inRange(d.deal_date) &&
          (!searchParams.product || d.items.some((i) => i.product === searchParams.product)) &&
          (!searchParams.customer || c.id === searchParams.customer) &&
          (!status || (status === "pending") === d.left > 0)
      )
      .sort((a, b) => b.d.deal_date.localeCompare(a.d.deal_date));
    const sold = list.reduce((a, x) => a + x.d.total, 0);
    const left = list.reduce((a, x) => a + x.d.left, 0);

    return (
      <>
        {filters}
        <div className="grid grid-cols-2 gap-2">
          <Card>
            <p className="text-xs text-muted-foreground">Total sold</p>
            <p className="mt-0.5 text-xl font-bold">{inr(sold)}</p>
          </Card>
          <Card>
            <p className="text-xs text-muted-foreground">Still to receive</p>
            <p className={`mt-0.5 text-xl font-bold ${left > 0 ? "text-red-600" : "text-emerald-600"}`}>{inr(left)}</p>
          </Card>
        </div>
        <p className="text-xs text-muted-foreground">
          {list.length} {list.length === 1 ? "deal" : "deals"} · newest first
        </p>
        {list.length === 0 && <Card className="text-sm text-muted-foreground">Nothing in this range.</Card>}
        {groupByMonth(list, (x) => x.d.deal_date).map((g) => (
          <div key={g.key}>
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {monthLabel(g.key)} · Sold {inr(g.items.reduce((a, x) => a + x.d.total, 0))} · Left{" "}
              {inr(g.items.reduce((a, x) => a + x.d.left, 0))}
            </p>
            <div className="divide-y rounded-2xl border bg-card px-3">
              {g.items.map(({ c, d }) => (
                <Link key={d.id} href={`/hisab/customers/${c.id}`} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {dealName(d.items)} · {shortDate(d.deal_date)} · Paid {inr(d.paid)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm font-semibold">{inr(d.total)}</span>
                    <Pill tone={d.left <= 0 ? "ok" : d.paid > 0 ? "warn" : "due"}>
                      {d.left <= 0 ? "Paid" : `${inr(d.left)} left`}
                    </Pill>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </>
    );
  }

  const list = expenses
    .filter((e) => inRange(e.spent_on) && (!searchParams.category || e.category === searchParams.category))
    .sort((a, b) => b.spent_on.localeCompare(a.spent_on));
  const spent = list.reduce((a, e) => a + e.amount, 0);
  const received = payments.filter((p) => inRange(p.paid_on)).reduce((a, p) => a + p.amount, 0);
  const byCat = new Map<string, number>();
  list.forEach((e) => byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount));
  const cats = Array.from(byCat.entries()).sort((a, b) => b[1] - a[1]);
  const net = received - spent;

  return (
    <>
      {filters}
      <div className="grid grid-cols-2 gap-2">
        <Card>
          <p className="text-xs text-muted-foreground">Received</p>
          <p className="mt-0.5 text-xl font-bold text-emerald-600">{inr(received)}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted-foreground">Expenses</p>
          <p className="mt-0.5 text-xl font-bold">{inr(spent)}</p>
        </Card>
      </div>
      <Card>
        <p className="text-xs text-muted-foreground">Left after expenses</p>
        <p className={`mt-0.5 text-xl font-bold ${net < 0 ? "text-red-600" : ""}`}>
          {net < 0 ? "−" : ""}
          {inr(net)}
        </p>
      </Card>
      <p className="mb-[-4px] mt-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        By category · highest first
      </p>
      <Card>
        {cats.length === 0 && <p className="text-xs text-muted-foreground">Nothing in this range.</p>}
        {cats.map(([k, v]) => (
          <div key={k} className="mb-3 last:mb-0">
            <div className="flex items-center justify-between text-sm font-semibold">
              <span>{k}</span>
              <span>{inr(v)}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-accent">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((v * 100) / spent)}%` }} />
            </div>
          </div>
        ))}
      </Card>
      <p className="text-xs text-muted-foreground">
        {list.length} {list.length === 1 ? "expense" : "expenses"} · newest first
      </p>
      {groupByMonth(list, (e) => e.spent_on).map((g) => (
        <div key={g.key}>
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {monthLabel(g.key)} · {inr(g.items.reduce((a, e) => a + e.amount, 0))}
          </p>
          <div className="divide-y rounded-2xl border bg-card px-3">
            {g.items.map((e) => (
              <div key={e.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm font-semibold">{e.description || e.category}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.category} · {shortDate(e.spent_on)}
                  </p>
                </div>
                <span className="text-sm font-semibold">{inr(e.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
