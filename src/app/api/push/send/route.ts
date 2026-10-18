import { NextResponse } from "next/server";
import { requireUserProfile } from "@/lib/auth/session";
import { sendPushToUser } from "@/lib/notifications/push";

// "Send test notification" button. It only ever sends to the logged-in user's
// own devices (never to another user), and it bypasses quiet hours on purpose
// so the person can check that it works.
export async function POST() {
  const profile = await requireUserProfile();

  const result = await sendPushToUser(
    profile.id,
    {
      title: "Test notification",
      message: "Notifications are working on this device.",
      link: "/notifications",
      tag: "test",
    },
    { force: true }
  );

  if (result.attempted === 0) {
    return NextResponse.json(
      { success: false, error: "No device is registered yet. Turn on notifications first." },
      { status: 400 }
    );
  }
  if (result.accepted === 0) {
    return NextResponse.json(
      { success: false, error: "The push service did not accept the message. Try turning notifications off and on again." },
      { status: 502 }
    );
  }
  return NextResponse.json({ success: true, devices: result.accepted });
}
