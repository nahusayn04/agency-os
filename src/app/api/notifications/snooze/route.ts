import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { snoozeLeadReminder, type SnoozeMode } from "@/lib/notifications/snooze";

// Used by the Snooze buttons on push notifications (service worker) and by
// the notifications page.
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { leadId?: string; mode?: string } | null;
  if (!body?.leadId || (body.mode !== "1h" && body.mode !== "tomorrow")) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin.from("users").select("role").eq("id", user.id).single();

  const result = await snoozeLeadReminder({
    leadId: body.leadId,
    mode: body.mode as SnoozeMode,
    userId: user.id,
    role: profile?.role ?? "member",
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true, until: result.until });
}
