import Header from "@/components/header";
import { HisabProvider } from "@/components/hisab/provider";
import { HisabTabs } from "@/components/hisab/tabs";
import { requireRole } from "@/lib/auth/session";
import { dealName } from "@/lib/hisab/calc";
import { getHisabData } from "@/lib/hisab/data";

export default async function HisabLayout({ children }: { children: React.ReactNode }) {
  await requireRole("super_admin");
  const { rows, settings } = await getHisabData();

  const openDeals = rows.flatMap((c) =>
    c.deals
      .filter((d) => d.left > 0)
      .map((d) => ({
        id: d.id,
        customerId: c.id,
        label: dealName(d.items),
        date: d.deal_date,
        left: d.left,
        total: d.total,
      }))
  );

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-6 transition-[margin-left] duration-300 ease-in-out lg:ml-[var(--sidebar-w)]">
        <div className="mx-auto flex max-w-2xl flex-col gap-4 pb-40">
          <HisabProvider
            customers={rows.map((c) => ({ id: c.id, name: c.name }))}
            openDeals={openDeals}
            products={settings.products}
            categories={settings.categories}
          >
            <div>
              <h1 className="mb-3 text-lg font-bold">{settings.business_name}</h1>
              <HisabTabs />
            </div>
            {children}
          </HisabProvider>
        </div>
      </main>
    </div>
  );
}
