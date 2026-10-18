import { requireUserProfile } from "@/lib/auth/session";
import { getNotificationsPageData } from "@/lib/notifications/actions";
import { NotificationsView } from "@/components/notifications/notifications-view";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const profile = await requireUserProfile();
  const { pending, recent } = await getNotificationsPageData();

  return <NotificationsView userId={profile.id} initialPending={pending} initialRecent={recent} />;
}
