import Header from "@/components/header";
import { CashflowProvider } from "@/components/cashflow/provider";
import { CashflowTabs } from "@/components/cashflow/tabs";
import { requireRole } from "@/lib/auth/session";
import { dealName } from "@/lib/cashflow/calc";
import { getCashflowData } from "@/lib/cashflow/data";

export default async function CashflowLayout({ children }: { children: React.ReactNode }) {
  await requireRole("super_admin");
  const { rows, settings } = await getCashflowData();

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
        <div className="mx-auto flex max-w-2xl flex-col gap-4 pb-28">
          <CashflowProvider
            customers={rows.map((c) => ({ id: c.id, name: c.name }))}
            openDeals={openDeals}
            products={settings.products}
            categories={settings.categories}
          >
            <div>
              <h1 className="mb-3 text-lg font-bold">Cashflow</h1>
              <CashflowTabs />
            </div>
            {children}
          </CashflowProvider>
        </div>
      </main>
    </div>
  );
}
