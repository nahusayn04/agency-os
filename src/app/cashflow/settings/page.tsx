import { SettingsForm } from "@/components/cashflow/settings-form";
import { getCashflowData } from "@/lib/cashflow/data";

export default async function SettingsPage() {
  const { settings } = await getCashflowData();
  return <SettingsForm initial={settings} />;
}
