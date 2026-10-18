import { NextResponse } from "next/server";
import { runNotificationSweeps } from "@/lib/notifications/lead-reminders";

// Point cron-job.org here every 5 minutes:
//   GET https://<your-domain>/api/cron/notifications
//   Header  Authorization: Bearer <CRON_SECRET>
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runNotificationSweeps();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
