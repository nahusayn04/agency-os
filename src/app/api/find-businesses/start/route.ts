import { NextResponse } from "next/server";
import { requireUserProfile } from "@/lib/auth/session";
import { getApifyUsage, startPlacesRun, type FindMode } from "@/lib/apify/places";

export const dynamic = "force-dynamic";

// Starts an Apify run and returns straight away (a Maps search can take longer
// than a serverless function is allowed to run). The page then polls /status.
export async function POST(req: Request) {
  const profile = await requireUserProfile();
  if (profile.role === "member") {
    return NextResponse.json({ error: "Only admins can use Find Businesses." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const mode: FindMode = body?.mode === "name" ? "name" : "category";
    const query = String(body?.query ?? "").trim().slice(0, 80);
    const city = String(body?.city ?? "").trim().slice(0, 80);

    if (query.length < 2) {
      return NextResponse.json({ error: "Enter what you want to find (e.g. dentist)." }, { status: 400 });
    }
    if (city.length < 2) {
      return NextResponse.json({ error: "Enter a city (e.g. Bhagalpur, Bihar, India)." }, { status: 400 });
    }

    // Monthly budget guard (Apify's own numbers). If Apify can't tell us, we still
    // go ahead: a free plan with no card cannot spend past its credit anyway.
    const usage = await getApifyUsage();
    if (usage && usage.remainingUsd < 0.15) {
      return NextResponse.json(
        { error: "This month's Apify credit is almost used up. Wait for the monthly reset.", usage },
        { status: 402 }
      );
    }

    const { runId } = await startPlacesRun({ mode, query, city });
    return NextResponse.json({ runId, usage });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not start the search." }, { status: 500 });
  }
}
