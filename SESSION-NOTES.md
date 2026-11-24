# Session Notes — Morrowlane Service Request Portal (Module 3)

**Session date:** 2026-11-24
**Repo:** https://github.com/cinnaman/vbc-m3-starter (branch `main`)
**Live site:** https://uncc-vbc-module3.netlify.app/
**Where we stopped:** Step 6 — the "data vanishes on the live site" bug is reproduced and diagnosed. Next is moving storage to Supabase.

---

## Progress at a glance

| Build-path step (from README) | Status |
|---|---|
| 1. Read side — `GET /api/requests`, `GET /api/summary` | ✅ Done, tested locally and live |
| 2. Write side — `POST /api/requests` | ✅ Done |
| 3. Server-side validation | ✅ Done, 12 bad-input cases rejected |
| 4. CSV export + `PATCH /api/requests/[id]` | ✅ Done |
| 5. Deploy to Netlify | ✅ Live at uncc-vbc-module3.netlify.app |
| 6. Diagnose vanishing data, migrate to Supabase | 🟡 Diagnosed — Supabase migration not started |
| Fill in `SUBMISSION.md` | ⬜ Not started (notes for it are below) |

---

## What happened, step by step

### 1. Project setup
- Cloned the starter repo into `E:\UNCC-VibeCoding\Module3\playbook-assignment`.
- Ran `npm install` (20 packages).
- `npm audit` reported 4 issues (1 critical in Next.js, 3 high). Ran `npm audit fix`:
  - Fixed: `next` → 15.5.29, `sharp` → 0.35.5, `source-map-js` → 1.2.4.
  - **Still open:** one PostCSS advisory bundled inside Next.js 15. Fixing it needs a major upgrade to Next.js 16 (`npm audit fix --force`), which could break the starter. Left as is — low risk for a class project.

### 2. README review — key points
- The front end is finished; the job is to build five endpoints that match the README's API contract exactly.
- Validation must happen on the server, with plain-English errors that name the field.
- Every endpoint wraps its work in try/catch and returns `500 {"error": "..."}` on unexpected failures.
- Expected tile values with only the seed data: **9 open, 2 urgent open, 5 completed this month** (hand-checked from the CSV).

### 3. Endpoints built

| Endpoint | What it does | File |
|---|---|---|
| `GET /api/requests` | All requests, newest first | `app/api/requests/route.js` |
| `POST /api/requests` | Validates, saves with status "New", returns `201` | `app/api/requests/route.js` |
| `PATCH /api/requests/[id]` | Changes status; `400` bad status, `404` unknown id | `app/api/requests/[id]/route.js` |
| `GET /api/summary` | The three tile numbers | `app/api/summary/route.js` |
| `GET /api/export` | CSV download, `morrowlane-requests.csv` | `app/api/export/route.js` |

Shared code:
- **`lib/requests.js`** — reads/parses the seed CSV (handles commas inside quotes), keeps requests in server memory, assigns ids (oldest = 1), computes the summary, builds the CSV export.
- **`lib/validation.js`** — the allowed locations, priorities and statuses, and the validation rules.

### 4. Decisions made where the README was silent
- **Exact spelling required:** "denver" (lowercase) is rejected because the README says values must match "exactly".
- **500-character limit is measured after trimming** leading/trailing spaces.
- **Non-text values** (e.g. a number for a name) are rejected with "… must be text."
- **CSV export extras:**
  - Cells starting with `=`, `+`, `-` or `@` get a leading `'` so Excel doesn't run them as formulas (CSV injection protection). Side effect: a description that genuinely starts with "-" gets the apostrophe too.
  - The file starts with a UTF-8 byte-order mark so Excel shows "—" correctly.

### 5. Table layout fix
- **Problem:** a test request with a 500-character description and no spaces pushed the table outside its card.
- **Cause:** the browser won't break a single long "word", so the Description column grew wider than the card. Real data (long URLs, error codes) could do the same.
- **Fix (in `app/globals.css` and `app/page.js`):**
  1. Table cells break long words (`overflow-wrap: anywhere`).
  2. The table sits in a `table-scroll` wrapper that scrolls sideways on narrow screens; the table has a 640px minimum width.
  3. On desktop, Location and Priority (headers and values) never wrap; the Description column gives up the space. Phones may wrap. This rule targets columns 3 and 5 by position — update it if columns are reordered.

### 6. Commits (all on `main`, pushed to GitHub)

| Commit | What's in it |
|---|---|
| `8bbb706` | `npm audit fix` dependency updates |
| `a0a56ae` | All five API endpoints + `lib/` |
| `86c714b` | Table layout fixes |

The `backend-api` branch was merged into `main` (fast-forward) and can be deleted.

### 7. Live site check (Netlify)
All checks passed on the live site:
- `GET /api/requests` → 22 requests, newest first; `GET /api/summary` → 9 / 2 / 5.
- `GET /api/export` → correct CSV and download headers.
- Bad inputs rejected with `400`; unknown id → `404`.
- The layout fixes are in the deployed CSS.

### 8. Step 6 bug — reproduced and diagnosed
- **Symptom:** On the live site, a submitted request appeared in the table, then **vanished after refresh**. Locally it stays until the dev server restarts.
- **Evidence:** 8 back-to-back checks of the live API all showed only the 22 seed requests and a 9 / 2 / 5 summary.
- **Root cause:** new requests are stored in the server's memory. On Netlify the backend runs as serverless functions — short-lived copies of the server that start on demand and shut down when idle, each with its own memory. The request was saved only in the memory of the copy that handled it; the next copy started fresh from the seed CSV. Writing to the CSV isn't an option either, because Netlify's files are read-only.
- **Fix (next session):** store requests in a real database (Supabase) that every copy reads and writes.

---

## Notes for `SUBMISSION.md`

**Debug log — suggested three-part prompt** (for "What I asked Claude"):

> **What I did:** On the live Netlify site I submitted a valid request (name, location, description, priority) and got the "Request submitted" message, and it appeared in the table. **What I expected:** It should still be there after I refresh, like it is on my laptop with `npm run dev`. **What happened:** After refreshing, it was gone and the table showed only the 22 seed requests. Locally it persists until I restart the server.

**Test pass ideas:**
- **#4 Absurd values:** a 500-character description with no spaces passed validation but broke the table layout → fixed with CSS (see section 5).
- **#5 Hand-checked tile math:** with seed data the tiles should be 9 / 2 / 5 — verified by counting the CSV by hand.

**"Almost-right" moments for the Assessment:**
- A cross-check of "completed this month" first said 0, which looked like the endpoint was wrong. The check was wrong: PowerShell had turned dates into date objects, so a text match on "2026-08" never succeeded. Recounting the raw CSV gave 5.
- The "completed this month" tile drops to 0 as soon as a new request is submitted today (November becomes the newest month). It looks like a bug but follows the README's rule exactly.

**Known limitations ideas:**
- Data doesn't persist on the live site (until Supabase is in place).
- No login — anyone with the URL can submit requests or change statuses.
- If Supabase uses the public anon key with open access rules, someone could write directly to the database and skip the API's validation.
- One remaining PostCSS security advisory, bundled with Next.js 15.
- Export adds a `'` to descriptions starting with `=`, `+`, `-` or `@`.

---

## To resume next time

**Before the next session (in your browser):**
1. Create a project at supabase.com and keep the database password somewhere safe.
2. Copy the **Project URL** and **anon public key** from Project Settings → API.
3. Locally: `cp .env.example .env.local` and fill in both values. **Never commit `.env.local`** (it's already in `.gitignore`), and don't paste the keys into chat.
4. On Netlify: add the same two values under Site configuration → Environment variables.

**Then, together:**
1. Write the SQL to create the `requests` table and load the 22 seed rows; run it in Supabase's SQL editor.
2. Decide on access: public anon key with open rules (simplest, matches README, note as a limitation) vs. a private server-only key (safer).
3. Switch `lib/requests.js` from memory to Supabase — endpoints and responses stay the same.
4. Test locally, push to GitHub, let Netlify redeploy.
5. **Verify on the live site:** submit, refresh several times, wait a few minutes, refresh again, change a status and refresh — the data must still be there. Record this in the debug log's "Verification" field.
6. Run the five test-pass checks on the live site and fill in `SUBMISSION.md`.

**To start the local dev server again:** `npm run dev`, then open http://localhost:3000.
