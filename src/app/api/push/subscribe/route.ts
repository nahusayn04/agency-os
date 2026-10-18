import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserProfile } from "@/lib/auth/session";

export async function POST(req: Request) {
  try {
    // Always use the logged-in user's own id — never trust a userId sent
    // from the client, or anyone could hijack someone else's push
    // subscription by simply sending a different id.
    const profile = await requireUserProfile();
    const { subscription } = await req.json();

    const endpoint: string | undefined = subscription?.endpoint;
    if (!subscription || !endpoint || typeof endpoint !== "string") {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    const admin = createAdminClient();

    // One row per device (endpoint). If this browser was previously used by
    // someone else, the row simply moves to the user who is logged in now.
    const { error } = await admin.from("push_subscriptions").upsert(
      {
        user_id: profile.id,
        endpoint,
        subscription: JSON.stringify(subscription),
        user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300),
      },
      { onConflict: "endpoint" }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
