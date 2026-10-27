import { redirect } from "next/navigation";
import { requireUserProfile } from "@/lib/auth/session";
import { getAssignableUsers } from "@/lib/crm/actions";
import { getApifyUsage } from "@/lib/apify/places";
import { FindBusinesses } from "@/components/crm/find-businesses";

export const dynamic = "force-dynamic";

export default async function FindBusinessesPage() {
  const profile = await requireUserProfile();
  if (profile.role === "member") redirect("/crm");

  const [users, usage] = await Promise.all([getAssignableUsers(), getApifyUsage()]);
  const hasToken = Boolean(process.env.APIFY_TOKEN);

  return (
    <FindBusinesses
      users={users.map((u) => ({ id: u.id, name: u.name }))}
      currentUserId={profile.id}
      usage={usage}
      hasToken={hasToken}
    />
  );
}
