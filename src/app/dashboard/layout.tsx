import Header from "@/components/header";
import { PushInit } from "@/components/push-init";
import { requireUserProfile } from "@/lib/auth/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireUserProfile();

  return (
    <div className="min-h-screen">
      <Header />
      <PushInit userId={profile.id} />
      <div className="min-w-0 transition-[margin-left] duration-300 ease-in-out lg:ml-[var(--sidebar-w)]">
        <main className="mx-auto w-full max-w-7xl px-4 py-8">{children}</main>
      </div>
    </div>
  );
}