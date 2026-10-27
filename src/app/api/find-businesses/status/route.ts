import { NextResponse } from "next/server";
import { requireUserProfile } from "@/lib/auth/session";
import { getApifyUsage, getPlacesRun } from "@/lib/apify/places";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const profile = await requireUserProfile();
  if (profile.role === "member") {
    return NextResponse.json({ error: "Only admins can use Find Businesses." }, { status: 403 });
  }

  const runId = new URL(req.url).searchParams.get("runId") ?? "";
  if (!/^[A-Za-z0-9]{5,40}$/.test(runId)) {
    return NextResponse.json({ error: "Invalid run id." }, { status: 400 });
  }

  try {
    const state = await getPlacesRun(runId);
    if (state.state === "done") {
      const usage = await getApifyUsage();
      return NextResponse.json({ ...state, usage });
    }
    return NextResponse.json(state);
  } catch (e) {
    return NextResponse.json({ state: "failed", message: e instanceof Error ? e.message : "Search failed." });
  }
}
