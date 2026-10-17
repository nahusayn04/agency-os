import { CustomersList, type CustomerListItem } from "@/components/hisab/customers-list";
import { openDealsOf, rel, daysAgo } from "@/lib/hisab/calc";
import { getHisabData } from "@/lib/hisab/data";

export default async function CustomersPage() {
  const { rows } = await getHisabData();
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
