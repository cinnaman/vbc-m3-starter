import { NextResponse } from "next/server";
import { createRequest, getAllRequests } from "../../../lib/requests";
import { validateNewRequest } from "../../../lib/validation";

export const dynamic = "force-dynamic";

// GET /api/requests — every request, newest first.
export async function GET() {
  try {
    const requests = await getAllRequests();
    return NextResponse.json({ requests }, { status: 200 });
  } catch (error) {
    console.error("GET /api/requests failed:", error);
    return NextResponse.json(
      { error: "Could not load service requests. Please try again." },
      { status: 500 }
    );
  }
}

// POST /api/requests — validate on the server, then create a new request with status "New".
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "The request body must be valid JSON." },
      { status: 400 }
    );
  }

  try {
    const { error, value } = validateNewRequest(body);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    const saved = await createRequest(value);
    return NextResponse.json({ request: saved }, { status: 201 });
  } catch (error) {
    console.error("POST /api/requests failed:", error);
    return NextResponse.json(
      { error: "Could not save the request. Please try again." },
      { status: 500 }
    );
  }
}
