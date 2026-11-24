import { NextResponse } from "next/server";
import { getAllRequests, summarize } from "../../../lib/requests";

export const dynamic = "force-dynamic";

// GET /api/summary — numbers for the three tiles at the top of the page.
export async function GET() {
  try {
    const requests = await getAllRequests();
    return NextResponse.json(summarize(requests), { status: 200 });
  } catch (error) {
    console.error("GET /api/summary failed:", error);
    return NextResponse.json(
      { error: "Could not load the summary. Please try again." },
      { status: 500 }
    );
  }
}
