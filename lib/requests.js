import { readFile } from "node:fs/promises";
import path from "node:path";

const SEED_PATH = path.join(process.cwd(), "data", "seed-requests.csv");

// Parses CSV text into an array of rows (arrays of strings).
// Handles quoted fields containing commas, escaped quotes (""), and CRLF line endings.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((value) => value.trim() !== ""));
}

// Reads the seed CSV and returns request objects, oldest first.
// The CSV has no id column, so ids are assigned in chronological order (oldest = 1).
async function loadSeed() {
  const text = await readFile(SEED_PATH, "utf8");
  const [header, ...dataRows] = parseCsv(text.replace(/^﻿/, ""));
  const columns = header.map((name) => name.trim());

  return dataRows
    .map((values) =>
      Object.fromEntries(columns.map((name, i) => [name, (values[i] ?? "").trim()]))
    )
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map((row, index) => ({
      id: index + 1,
      created_at: row.created_at,
      requester_name: row.requester_name,
      location: row.location,
      description: row.description,
      priority: row.priority,
      status: row.status,
    }));
}

// In-memory store: seeded from the CSV the first time it's needed, then kept in server memory.
// It lives on globalThis so every API route shares the same list in the dev server.
// NOTE: memory is not durable storage — it resets whenever the server process restarts.
function getStore() {
  if (!globalThis.__morrowlaneStore) {
    globalThis.__morrowlaneStore = loadSeed().catch((error) => {
      globalThis.__morrowlaneStore = null; // let the next call retry
      throw error;
    });
  }
  return globalThis.__morrowlaneStore;
}

function newestFirst(a, b) {
  return new Date(b.created_at) - new Date(a.created_at) || b.id - a.id;
}

// Returns every request, newest first.
export async function getAllRequests() {
  const store = await getStore();
  return [...store].sort(newestFirst);
}

// Saves a new request with status "New" and returns it.
export async function createRequest({ requester_name, location, description, priority }) {
  const store = await getStore();
  const nextId = store.reduce((max, r) => Math.max(max, r.id), 0) + 1;

  const request = {
    id: nextId,
    created_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    requester_name,
    location,
    description,
    priority,
    status: "New",
  };

  store.push(request);
  return request;
}

// Changes one request's status. Returns the updated request, or null if the id doesn't exist.
export async function updateRequestStatus(id, status) {
  const store = await getStore();
  const request = store.find((r) => r.id === id);
  if (!request) return null;

  request.status = status;
  return { ...request };
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
