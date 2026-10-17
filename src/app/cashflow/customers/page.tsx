import { CustomersList, type CustomerListItem } from "@/components/cashflow/customers-list";
import { openDealsOf, rel, daysAgo } from "@/lib/cashflow/calc";
import { getCashflowData } from "@/lib/cashflow/data";

export default async function CustomersPage() {
  const { rows } = await getCashflowData();
  const items: CustomerListItem[] = rows.map((c) => ({
    id: c.id,
    name: c.name,
    products: Array.from(new Set(c.deals.flatMap((d) => d.items.map((i) => i.product)))).join(", "),
    openDeals: openDealsOf(c).length,
    lastPaid: c.lastPaid ? rel(daysAgo(c.lastPaid)) : "none yet",
    dues: c.dues,
  }));
  return <CustomersList items={items} />;
}
