import Link from "next/link";
import { notFound } from "next/navigation";
import { DealCard } from "@/components/hisab/deal-card";
import { DocumentsSection } from "@/components/hisab/documents";
import { EditCustomerButton, NotesBox, PromiseRow, SaleAndPaymentButtons } from "@/components/hisab/customer-bits";
import { ReminderButton } from "@/components/hisab/reminder";
import { Avatar, Card, Pill, SectionLabel, btnSoft } from "@/components/hisab/ui";
import { addDays, dealName, fmtDate, inr, rel, daysAgo, shortDate, todayIST } from "@/lib/hisab/calc";
import { getHisabData } from "@/lib/hisab/data";

export default async function CustomerPage({ params }: { params: { id: string } }) {
  const { rows, settings } = await getHisabData();
  const c = rows.find((r) => r.id === params.id);
  if (!c) notFound();

  const today = todayIST();
  const newestFirstOpen = [...c.deals].sort(
    (a, b) => Number(b.left > 0) - Number(a.left > 0) || a.deal_date.localeCompare(b.deal_date)
  );
  const kv = (label: string, value: React.ReactNode, cls = "") => (
    <div className="flex justify-between gap-3 border-b py-2 text-[13px] last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-right font-medium ${cls}`}>{value}</span>
    </div>
  );

  return (
    <>
      <Link href="/hisab/customers" className="text-xs font-semibold text-primary">
        ‹ Customers
      </Link>

      <Card>
        <div className="flex items-center gap-3">
          <Avatar name={c.name} size={52} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold">{c.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {[c.business, c.city].filter(Boolean).join(" · ") || "—"}
            </p>
            <Pill tone={c.dues > 0 ? "due" : "ok"}>{c.dues > 0 ? `Dues ${inr(c.dues)}` : "Settled"}</Pill>
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
      </Card>

      <div className="grid grid-cols-2 gap-2">
        {c.phone ? (
          <a href={`tel:${c.phone}`} className={btnSoft}>
            Call
          </a>
        ) : (
          <span className={btnSoft + " opacity-45"}>Call</span>
        )}
        {c.dues > 0 ? (
          <ReminderButton
            wide
            customerId={c.id}
            contact={c.contact_person || c.name}
            phone={c.phone}
            amount={c.dues}
            template={settings.reminder_message}
            label="WhatsApp reminder"
          />
        ) : (
          <span className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-100 text-sm font-semibold text-emerald-700 opacity-45 dark:bg-emerald-950 dark:text-emerald-300">
            WhatsApp reminder
          </span>
        )}
        <SaleAndPaymentButtons customerId={c.id} />
      </div>

      <SectionLabel>Money</SectionLabel>
      <Card>
        {kv("Total sales", inr(c.sales))}
        {kv("Received", inr(c.received), "text-emerald-600")}
        {kv("Dues", inr(c.dues), c.dues > 0 ? "text-red-600" : "")}
        {kv("Last payment", c.lastPaid ? rel(daysAgo(c.lastPaid)) : "None yet")}
        {kv("Last reminder sent", c.last_reminder_at ? rel(daysAgo(c.last_reminder_at.slice(0, 10))) : "Never")}
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
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-accent">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${c.sales ? Math.round((c.received * 100) / c.sales) : 0}%` }}
          />
        </div>
      </Card>

      <SectionLabel>Deals ({c.deals.length})</SectionLabel>
      {newestFirstOpen.length === 0 && (
        <Card className="text-sm text-muted-foreground">No deals yet. Tap + Sale to add one.</Card>
      )}
      {newestFirstOpen.map((d) => (
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
            payments: d.payments.map((p) => ({
              id: p.id,
              date: shortDate(p.paid_on),
              amount: p.amount,
              note: p.note,
            })),
          }}
        />
      ))}

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
