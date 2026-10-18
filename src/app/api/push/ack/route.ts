import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Called by the service worker the moment a push lands on a device. The id is
// an unguessable UUID, and the only thing this does is record "delivered",
// so it is deliberately usable without a session (the user may be logged out
// on that device). If no ack arrives for an urgent notification, the cron
// sends an email instead.
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { id?: string };
    const id = body?.id;
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const admin = createAdminClient();
    await admin
      .from("notifications")
      .update({ push_acked_at: new Date().toISOString() })
      .eq("id", id)
      .is("push_acked_at", null);

    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
