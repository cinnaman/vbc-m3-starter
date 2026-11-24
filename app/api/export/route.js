import { NextResponse } from "next/server";
import { getAllRequests, toCsv } from "../../../lib/requests";

export const dynamic = "force-dynamic";

// GET /api/export — every request, newest first, as a downloadable CSV file.
export async function GET() {
  try {
    const requests = await getAllRequests();
    return new Response(toCsv(requests), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="morrowlane-requests.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/export failed:", error);
    return NextResponse.json(
      { error: "Could not export requests. Please try again." },
      { status: 500 }
    );
  }
}
