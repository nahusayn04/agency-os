import { ActivityList, type ActivityItem } from "@/components/cashflow/activity";
import { FeedCard } from "@/components/cashflow/feed-card";
import { HomeActions } from "@/components/cashflow/quick-actions";
import { Card, SectionLabel } from "@/components/cashflow/ui";
import { buildFeed, dealName, inr, todayIST } from "@/lib/cashflow/calc";
import { getCashflowData } from "@/lib/cashflow/data";

export default async function CashflowHome() {
  const { rows, payments, expenses, settings } = await getCashflowData();

  const month = todayIST().slice(0, 7);
  const totalDues = rows.reduce((a, c) => a + Math.max(0, c.dues), 0);
  const owing = rows.filter((c) => c.dues > 0).length;
  const received = payments.filter((p) => p.paid_on.startsWith(month)).reduce((a, p) => a + p.amount, 0);
  const spent = expenses.filter((e) => e.spent_on.startsWith(month)).reduce((a, e) => a + e.amount, 0);

  const { hot, soon } = buildFeed(rows, settings.alert_days);
  const byId = new Map(rows.map((c) => [c.id, c]));
  const card = (x: (typeof hot)[number], i: number) => {
    const c = byId.get(x.customerId)!;
    return (
      <FeedCard
        key={`${x.customerId}-${x.kind}-${i}`}
        x={x}
        contact={c.contact_person || c.name}
        phone={c.phone}
        template={settings.reminder_message}
      />
    );
  };

  const dealOf = new Map(rows.flatMap((c) => c.deals.map((d) => [d.id, { c, d }] as const)));
  const activity: ActivityItem[] = [
    ...payments.map((p) => {
      const x = dealOf.get(p.deal_id);
      return {
        id: p.id,
        date: p.paid_on,
        title: x?.c.name ?? "Payment",
        sub: `Payment${x ? " · " + dealName(x.d.items) : ""}`,
        amount: p.amount,
        kind: "in" as const,
      };
    }),
    ...expenses.map((e) => ({
      id: e.id,
      date: e.spent_on,
      title: e.description || e.category,
      sub: `Expense · ${e.category}`,
      amount: e.amount,
      kind: "out" as const,
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 12);

  return (
    <>
      <div className="rounded-3xl bg-primary p-5 text-primary-foreground shadow-card">
        <p className="text-xs opacity-80">Total outstanding</p>
        <p className="mt-1 text-3xl font-bold">{inr(totalDues)}</p>
        <p className="text-xs opacity-80">
          {owing} {owing === 1 ? "customer owes" : "customers owe"} you
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-primary-foreground/20 pt-3">
          <div>
            <p className="text-[11px] opacity-80">Received this month</p>
            <p className="text-lg font-semibold">{inr(received)}</p>
          </div>
          <div>
            <p className="text-[11px] opacity-80">Expenses this month</p>
            <p className="text-lg font-semibold">{inr(spent)}</p>
          </div>
        </div>
      </div>

      <HomeActions />

      <SectionLabel>Needs attention today ({hot.length})</SectionLabel>
      {hot.length ? hot.map(card) : <Card className="text-sm text-muted-foreground">All caught up.</Card>}

      {soon.length > 0 && (
        <>
          <SectionLabel>Coming up ({soon.length})</SectionLabel>
          {soon.map(card)}
        </>
      )}

      <SectionLabel>Recent activity</SectionLabel>
      <ActivityList
        items={activity}
        empty={rows.length === 0 ? "No customers yet. Open the Customers tab and add your first one." : "No payments or expenses yet."}
      />
    </>
  );
}
