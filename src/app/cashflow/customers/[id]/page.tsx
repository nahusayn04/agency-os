import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityList, type ActivityItem } from "@/components/cashflow/activity";
import { DealCard } from "@/components/cashflow/deal-card";
import { DocumentsSection } from "@/components/cashflow/documents";
import { EditCustomerButton, NotesBox, PromiseRow } from "@/components/cashflow/customer-bits";
import { CustomerActions } from "@/components/cashflow/quick-actions";
import { Card, SectionLabel } from "@/components/cashflow/ui";
import { addDays, dealName, fmtDate, inr, rel, daysAgo, shortDate, todayIST } from "@/lib/cashflow/calc";
import { getCashflowData } from "@/lib/cashflow/data";

export default async function CustomerPage({ params }: { params: { id: string } }) {
  const { rows, settings } = await getCashflowData();
  const c = rows.find((r) => r.id === params.id);
  if (!c) notFound();

  const today = todayIST();
  const deals = [...c.deals].sort(
    (a, b) => Number(b.left > 0) - Number(a.left > 0) || a.deal_date.localeCompare(b.deal_date)
  );

  const statement: ActivityItem[] = [
    ...c.deals.map((d) => ({
      id: "d" + d.id,
      date: d.deal_date,
      title: dealName(d.items),
      sub: "Billed",
      amount: d.total,
      kind: "bill" as const,
    })),
    ...c.deals.flatMap((d) =>
      d.payments.map((p) => ({
        id: "p" + p.id,
        date: p.paid_on,
        title: "Payment received",
        sub: dealName(d.items) + (p.note ? ` · ${p.note}` : ""),
        amount: p.amount,
        kind: "in" as const,
      }))
    ),
  ].sort((a, b) => b.date.localeCompare(a.date) || Number(a.kind === "bill") - Number(b.kind === "bill"));

  const kv = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between gap-3 border-b py-2 text-[13px] last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );

  return (
    <>
      <Link href="/cashflow/customers" className="text-xs font-semibold text-primary">
        ‹ Customers
      </Link>

      <div className="rounded-3xl bg-primary p-5 text-primary-foreground shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">{c.name}</p>
            <p className="truncate text-xs opacity-80">{[c.business, c.city].filter(Boolean).join(" · ") || "—"}</p>
          </div>
          <EditCustomerButton
            customerId={c.id}
            initial={{
              name: c.name,
              contact_person: c.contact_person ?? "",
              phone: c.phone ?? "",
              city: c.city ?? "",
            }}
          />
        </div>
        <p className="mt-4 text-xs opacity-80">Outstanding</p>
        <p className="text-3xl font-bold">{inr(c.dues)}</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-primary-foreground/25">
          <div
            className="h-full rounded-full bg-primary-foreground"
            style={{ width: `${c.sales ? Math.round((c.received * 100) / c.sales) : 0}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs opacity-90">
          <span>Billed {inr(c.sales)}</span>
          <span>Received {inr(c.received)}</span>
        </div>
      </div>

      <CustomerActions
        customerId={c.id}
        phone={c.phone}
        contact={c.contact_person || c.name}
        outstanding={c.dues}
        template={settings.reminder_message}
      />

      <Card>
        {kv("Last payment", c.lastPaid ? rel(daysAgo(c.lastPaid)) : "None yet")}
        {kv("Last reminder", c.last_reminder_at ? rel(daysAgo(c.last_reminder_at.slice(0, 10))) : "Never")}
        {c.dues > 0 && (
          <PromiseRow
            customerId={c.id}
            amount={c.promise_amount}
            date={c.promise_date}
            dateLabel={c.promise_date ? shortDate(c.promise_date) : null}
            defaultAmount={c.dues}
            tomorrow={addDays(today, 3)}
          />
        )}
      </Card>

      <SectionLabel>Deals ({deals.length})</SectionLabel>
      {deals.length === 0 && <Card className="text-sm text-muted-foreground">No deals yet. Tap Sale to add one.</Card>}
      {deals.map((d) => (
        <DealCard
          key={d.id}
          d={{
            id: d.id,
            customerId: c.id,
            name: dealName(d.items),
            soldOn: shortDate(d.deal_date),
            note: d.note,
            total: d.total,
            paid: d.paid,
            left: d.left,
          }}
        />
      ))}

      <SectionLabel>Statement</SectionLabel>
      <ActivityList items={statement} empty="Nothing here yet." />

      <SectionLabel>Documents</SectionLabel>
      <DocumentsSection
        customer={{ id: c.id, name: c.name, contact_person: c.contact_person, city: c.city, phone: c.phone }}
        deals={[...c.deals]
          .sort((a, b) => b.deal_date.localeCompare(a.deal_date))
          .map((d) => ({
            id: d.id,
            label: dealName(d.items),
            items: d.items,
            total: d.total,
            paid: d.paid,
            left: d.left,
          }))}
        docs={Object.fromEntries(
          Object.entries(c.docs).map(([k, v]) => [
            k,
            {
              id: v!.id,
              source: v!.source,
              content: v!.content,
              file_path: v!.file_path,
              file_name: v!.file_name,
              doc_number: v!.doc_number,
            },
          ])
        )}
        settings={{
          business: settings.business_name,
          invoiceTemplate: settings.invoice_template,
          agreementTemplate: settings.agreement_template,
          nextInvoiceNo: settings.next_invoice_no,
        }}
        today={today}
      />

      <SectionLabel>Contact</SectionLabel>
      <Card>
        {kv("Contact person", c.contact_person || "—")}
        {kv("Phone", c.phone || "—")}
        {kv("City", c.city || "—")}
        {kv("Customer since", fmtDate(c.created_at.slice(0, 10)))}
      </Card>

      <SectionLabel>Notes</SectionLabel>
      <NotesBox customerId={c.id} initial={c.notes} />
    </>
  );
}
