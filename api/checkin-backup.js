// Nightly append-only backup of venue check-ins to SharePoint (IT library).
//
// Append-only is the point: a row that reaches this workbook is never removed,
// even if the check-in is later deleted in Cheer-Ops or the whole table is lost.
// A mirror-style full export would happily propagate a deletion and would not
// actually be a backup.
//
// Runs on the Vercel cron declared in vercel.json. Can also be triggered by
// hand with the admin key, which is how you'd test it.

import * as XLSX from "xlsx";
import { getMicrosoftToken, ADMIN_TOKEN, IT_DRIVE_ID } from "./_lib.js";

const FILE_NAME = "Staff Check-ins.xlsx";
const SHEET = "Check-ins";

// The anon key is already public (it ships in the browser bundle), so falling
// back to it keeps this working even if the Vercel env vars were never set for
// the server side — which they may not have been, since nothing else needed them.
// Whitespace is stripped because a JWT pasted into a dashboard can arrive with
// a line break folded into it, and a header value containing one throws before
// any request is made. The production SUPABASE_ANON_KEY had exactly that.
const clean = (v) => (v || "").replace(/\s+/g, "");
const SUPABASE_URL = clean(process.env.SUPABASE_URL) || "https://peylonukcwsqdknchxda.supabase.co";
const SUPABASE_KEY = clean(process.env.SUPABASE_ANON_KEY) || ADMIN_TOKEN;

const sb = async (path) => {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!r.ok) throw new Error(`Supabase ${path}: ${r.status} ${await r.text()}`);
  return r.json();
};

const fmtTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d) ? "" : d.toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit", hour12: false });
};

export default async function handler(req, res) {
  // Vercel sends `Authorization: Bearer $CRON_SECRET` on cron invocations when
  // that env var is set. Accept the admin key too so it can be run by hand.
  // If neither secret is configured the endpoint is open, which is noted in the
  // response so it doesn't go unnoticed — it only ever appends rows that are
  // already in the database to a private library, so the blast radius is small.
  const auth = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const cronSecret = process.env.CRON_SECRET;
  const authorised = cronSecret ? (auth === cronSecret || auth === ADMIN_TOKEN) : true;
  if (!authorised) return res.status(401).json({ error: "Unauthorized" });

  try {
    const msToken = await getMicrosoftToken();

    const [checkins, events, plans] = await Promise.all([
      sb("event_checkins?select=id,event_id,staff_id,staff_name,local_date,checked_in_at&order=checked_in_at"),
      sb("events?select=id,name"),
      // Optional: the table may not exist yet, and a backup should not stop for
      // the sake of an extra column.
      sb("event_attendance_plans?select=event_id,staff_id,attendance_type,half").catch(() => []),
    ]);
    const planFor = new Map(plans.map((p) => [`${p.event_id}|${p.staff_id}`, p]));
    const HALF = { morning: "morning", afternoon: "afternoon" };
    const TYPE = { setup: "Setup only", half_day: "Half day", full_day: "Full day", teardown: "Tear down only" };
    const hereFor = (c) => {
      const p = planFor.get(`${c.event_id}|${c.staff_id}`);
      if (!p) return "";
      const base = TYPE[p.attendance_type] || p.attendance_type || "";
      return p.attendance_type === "half_day" && HALF[p.half] ? `${base} — ${HALF[p.half]}` : base;
    };
    const eventName = Object.fromEntries(events.map((e) => [String(e.id), e.name || ""]));

    // Read whatever is already backed up. A missing file is the first run.
    const url = `https://graph.microsoft.com/v1.0/drives/${IT_DRIVE_ID}/root:/${encodeURIComponent(FILE_NAME)}:/content`;
    const existingRes = await fetch(url, { headers: { Authorization: `Bearer ${msToken}` } });

    let existing = [];
    if (existingRes.ok) {
      const wb = XLSX.read(Buffer.from(await existingRes.arrayBuffer()), { type: "buffer" });
      const ws = wb.Sheets[SHEET] || wb.Sheets[wb.SheetNames[0]];
      if (ws) existing = XLSX.utils.sheet_to_json(ws, { defval: "" });
    } else if (existingRes.status !== 404) {
      throw new Error(`Reading existing workbook failed: ${existingRes.status} ${await existingRes.text()}`);
    }

    // Dedupe on the check-in id, which is why it is written into the sheet.
    const seen = new Set(existing.map((r) => String(r["Check-in ID"] || "")));
    const added = checkins
      .filter((c) => !seen.has(String(c.id)))
      .map((c) => ({
        "Check-in ID": c.id,
        "Day": c.local_date || "",
        "Event": eventName[String(c.event_id)] || c.event_id || "",
        "Name": c.staff_name || "",
        "Here for": hereFor(c),
        "Arrived": fmtTime(c.checked_in_at),
        "Recorded (UTC)": c.checked_in_at || "",
        "Backed up": new Date().toISOString(),
      }));

    if (added.length === 0) {
      return res.json({ ok: true, added: 0, total: existing.length, note: "nothing new" });
    }

    const rows = [...existing, ...added];
    const wb = XLSX.utils.book_new();
    // Explicit header: rows written before a column existed simply get a blank
    // for it, rather than the sheet's columns depending on which row happened to
    // be first. Add new columns to the end of this list, never in the middle.
    const HEADERS = ["Check-in ID", "Day", "Event", "Name", "Here for", "Arrived", "Recorded (UTC)", "Backed up"];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows, { header: HEADERS }), SHEET);
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

    const put = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${msToken}`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
      body: buf,
    });
    if (!put.ok) throw new Error(`Upload failed: ${put.status} ${await put.text()}`);

    res.json({
      ok: true,
      added: added.length,
      total: rows.length,
      file: FILE_NAME,
      ...(cronSecret ? {} : { warning: "CRON_SECRET is not set, so this endpoint is unauthenticated" }),
    });
  } catch (e) {
    console.error("Check-in backup error:", e.message);
    res.status(500).json({ error: e.message });
  }
}
