import Header from "@/components/header";

export default function AppSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <Header />
      <div className="min-w-0 transition-[margin-left] duration-300 ease-in-out lg:ml-[var(--sidebar-w)]">
        <main className="mx-auto w-full max-w-7xl px-4 py-8">{children}</main>
      </div>
    </div>
  );
}