import { NextResponse } from "next/server";
import { updateRequestStatus } from "../../../../lib/requests";
import { STATUSES } from "../../../../lib/validation";

export const dynamic = "force-dynamic";

// PATCH /api/requests/[id] — update one request's status (the dropdown in each table row).
export async function PATCH(request, { params }) {
  try {
    // In Next.js 15, route params must be awaited.
    const { id: rawId } = await params;
    const id = /^\d+$/.test(rawId) ? Number(rawId) : NaN;

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "The request body must be valid JSON." },
        { status: 400 }
      );
    }

    const status = body?.status;
    if (typeof status !== "string" || !STATUSES.includes(status)) {
      return NextResponse.json(
        { error: "Status must be New, In Progress, or Complete." },
        { status: 400 }
      );
    }

    const updated = Number.isSafeInteger(id) ? await updateRequestStatus(id, status) : null;
    if (!updated) {
      return NextResponse.json(
        { error: `No service request found with id ${rawId}.` },
        { status: 404 }
      );
    }

    return NextResponse.json({ request: updated }, { status: 200 });
  } catch (error) {
    console.error("PATCH /api/requests/[id] failed:", error);
    return NextResponse.json(
      { error: "Could not update the status. Please try again." },
      { status: 500 }
    );
  }
}
