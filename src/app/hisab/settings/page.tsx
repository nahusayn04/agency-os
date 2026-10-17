import { SettingsForm } from "@/components/hisab/settings-form";
import { getHisabData } from "@/lib/hisab/data";

export default async function SettingsPage() {
  const { settings } = await getHisabData();
  return <SettingsForm initial={settings} />;
}
