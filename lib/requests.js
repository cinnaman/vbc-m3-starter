import { createClient } from "@supabase/supabase-js";

// Requests live in the Supabase table `requests` (see supabase/schema.sql).
// Every serverless copy of the app reads and writes the same database, so data survives
// refreshes, cold starts and redeploys — unlike the old in-memory list.

const COLUMNS = "id, created_at, requester_name, location, description, priority, status";

// Creates the Supabase client once per server copy. The keys are read from environment
// variables (.env.local locally, Netlify's environment variables live) and are only used
// on the server — they are never sent to the browser.
function getClient() {
  if (!globalThis.__morrowlaneSupabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be set (see .env.example).");
    }
    globalThis.__morrowlaneSupabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return globalThis.__morrowlaneSupabase;
}

// Supabase returns timestamps like "2026-07-16T14:20:00+00:00".
// The API contract uses "2026-07-16T14:20:00Z", so convert to that shape.
function toApiRequest(row) {
  return {
    ...row,
    id: Number(row.id),
    created_at: new Date(row.created_at).toISOString().replace(/\.\d{3}Z$/, "Z"),
  };
}

// Turns a Supabase error into a thrown Error so each route's try/catch returns a 500.
function check({ data, error }, action) {
  if (error) {
    throw new Error(`Supabase could not ${action}: ${error.message}`);
  }
  return data;
}

// Returns every request, newest first.
export async function getAllRequests() {
  const rows = check(
    await getClient()
      .from("requests")
      .select(COLUMNS)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false }),
    "load requests"
  );
  return rows.map(toApiRequest);
}

// Saves a new request with status "New" and returns it. The database assigns the id.
export async function createRequest({ requester_name, location, description, priority }) {
  const row = check(
    await getClient()
      .from("requests")
      .insert({
        created_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
        requester_name,
        location,
        description,
        priority,
        status: "New",
      })
      .select(COLUMNS)
      .single(),
    "save the request"
  );
  return toApiRequest(row);
}

// Changes one request's status. Returns the updated request, or null if the id doesn't exist.
export async function updateRequestStatus(id, status) {
  const row = check(
    await getClient()
      .from("requests")
      .update({ status })
      .eq("id", id)
      .select(COLUMNS)
      .maybeSingle(),
    "update the status"
  );
  return row ? toApiRequest(row) : null;
}

// --- CSV export ---

const EXPORT_COLUMNS = [
  "id",
  "created_at",
  "requester_name",
  "location",
  "description",
  "priority",
  "status",
];

// Formats one value as a CSV cell.
// - Cells starting with = + - @ (or tab/CR) get a leading apostrophe so spreadsheet apps
//   show them as text instead of running them as formulas (CSV/formula injection).
// - Cells containing commas, quotes, or line breaks are wrapped in quotes, with quotes doubled.
function toCsvCell(value) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) {
    text = "'" + text;
  }
  if (/[",\r\n]/.test(text)) {
    text = '"' + text.replace(/"/g, '""') + '"';
  }
  return text;
}

// Builds the export file: a header row plus one row per request, in the order given.
// Starts with a UTF-8 byte-order mark so Excel shows characters like "—" correctly.
export function toCsv(requests) {
  const lines = [EXPORT_COLUMNS.join(",")];
  for (const request of requests) {
    lines.push(EXPORT_COLUMNS.map((column) => toCsvCell(request[column])).join(","));
  }
  return "﻿" + lines.join("\r\n") + "\r\n";
}

// Computes the three tile numbers from a list of requests.
// "This month" means the calendar month (UTC) of the most recent request in the data,
// not today's month, so the tile stays meaningful whenever the app is run.
export function summarize(requests) {
  const open = requests.filter((r) => r.status !== "Complete");

  let completedThisMonth = 0;
  if (requests.length > 0) {
    const latest = requests.reduce((max, r) =>
      new Date(r.created_at) > new Date(max.created_at) ? r : max
    );
    const latestDate = new Date(latest.created_at);
    const year = latestDate.getUTCFullYear();
    const month = latestDate.getUTCMonth();

    completedThisMonth = requests.filter((r) => {
      const d = new Date(r.created_at);
      return (
        r.status === "Complete" &&
        d.getUTCFullYear() === year &&
        d.getUTCMonth() === month
      );
    }).length;
  }

  return {
    open_requests: open.length,
    urgent_open: open.filter((r) => r.priority === "Urgent").length,
    completed_this_month: completedThisMonth,
  };
}
