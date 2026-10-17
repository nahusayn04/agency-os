import { FeedCard } from "@/components/hisab/feed-card";
import { Card, SectionLabel } from "@/components/hisab/ui";
import { buildFeed, inr, todayIST } from "@/lib/hisab/calc";
import { getHisabData } from "@/lib/hisab/data";

export default async function HisabHome() {
  const { rows, payments, settings } = await getHisabData();

  const totalDues = rows.reduce((a, c) => a + Math.max(0, c.dues), 0);
  const owing = rows.filter((c) => c.dues > 0).length;
  const month = todayIST().slice(0, 7);
  const receivedThisMonth = payments
    .filter((p) => p.paid_on.startsWith(month))
    .reduce((a, p) => a + p.amount, 0);

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

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Card>
          <p className="text-xs text-muted-foreground">Total dues</p>
          <p className="mt-0.5 text-xl font-bold text-red-600">{inr(totalDues)}</p>
          <p className="text-xs text-muted-foreground">
            {owing} {owing === 1 ? "customer owes" : "customers owe"} you
          </p>
        </Card>
        <Card>
          <p className="text-xs text-muted-foreground">Received this month</p>
          <p className="mt-0.5 text-xl font-bold text-emerald-600">{inr(receivedThisMonth)}</p>
          <p className="text-xs text-muted-foreground">Since the 1st of this month</p>
        </Card>
      </div>

      <SectionLabel>Needs attention today ({hot.length})</SectionLabel>
      {hot.length ? hot.map(card) : <Card className="text-sm text-muted-foreground">All caught up.</Card>}

      <SectionLabel>Coming up ({soon.length})</SectionLabel>
      {soon.map(card)}
      {rows.length === 0 && (
        <Card className="text-sm text-muted-foreground">
          No customers yet. Open the Customers tab and add your first one.
        </Card>
      )}
    </>
  );
}
