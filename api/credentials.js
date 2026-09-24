// Coach credential intake and review. Six actions in one function.
//
// They were separate routes until the Hobby plan's 12-function ceiling refused
// the deploy; the split bought nothing, since the browser always calls them in
// sequence for the same submission. The project has been at 12 ever since, so
// anything new arrives here as another action.
//
//   start  — validate the answers, create the SharePoint folder and the list row
//            as Incomplete, and return one upload URL per file.
//   finish — called once the browser has uploaded every file directly to
//            SharePoint: resolve each file to a link, write those onto the row,
//            flip it to Submitted and email the submitter.
//   list   — every submission, for the admin table.
//   verify — move one submission between Submitted and Verified.
//   photo  — stream one submission's selfie back as image bytes, for the card
//            printer to draw onto a canvas.
//   printed — record that cards have been produced, in batches, because that is
//            how they come off the printer.
//
// Files never pass through this function. Vercel caps request bodies at 4.5MB
// and it cannot be raised, so base64-through-a-function (what the expense form
// does) fails on a couple of phone photos. Graph upload sessions have no such
// ceiling.
//
// The client never chooses a path or filename. It declares which field a file
// is for, its type and its size; everything else is decided here, so an open
// endpoint can't be used to write arbitrary files anywhere in the library.

import { randomUUID } from "crypto";
import {
  getMicrosoftToken, sendMail, requireAdmin, SITE_ID,
  EVENT_DOCS_DRIVE_ID, CREDENTIALS_FOLDER, CREDENTIALS_LIST_ID,
  sharePointUrl, LIST_TEXT_MAX,
} from "./_lib.js";

const G = "https://graph.microsoft.com/v1.0";

// Credential confirmations come from Zack rather than the accounting mailbox —
// a coach asked for their passport should recognise the sender. Overridable by
// env so it can be changed without a deploy.
const CREDENTIALS_FROM = (process.env.CREDENTIALS_FROM_EMAIL || "zack@canadiancheer.com").trim();

const ALLOWED = {
  "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png",
  "image/heic": "heic", "image/heif": "heif", "image/webp": "webp",
  "application/pdf": "pdf",
};
const MAX_BYTES = 25 * 1024 * 1024;

const FIELDS = {
  vsc:            "Vulnerable-Sector-Check",
  proofOfAge:     "Proof-of-Age",
  credential:     "Coaching-Credential",
  provincialCert: "Provincial-Certification",
  selfie:         "Selfie",
};
const URL_FIELD = {
  vsc: "VSCUrl", proofOfAge: "ProofOfAgeUrl",
  credential: "CredentialUrl", provincialCert: "ProvincialCertUrl",
  selfie: "SelfieUrl",
};

// Strips anything that could escape the folder or upset SharePoint.
const safe = (s, fallback = "unknown") => {
  const out = String(s || "").normalize("NFKD")
    .replace(/[^\w\s.-]/g, "").replace(/\s+/g, " ").trim().slice(0, 60);
  return out || fallback;
};

// Whole years — a birthday later this year must not round a 17-year-old up.
function ageOn(dob, on) {
  let age = on.getFullYear() - dob.getFullYear();
  const m = on.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && on.getDate() < dob.getDate())) age--;
  return age;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const action = req.body?.action;
  // start/finish are the public form. Everything else is the admin side and is
  // gated — those actions read personal data. It all shares one function
  // because the Hobby plan allows 12 and the project is at 12.
  if (action === "start") return start(req, res);
  if (action === "finish") return finish(req, res);
  if (action === "list" || action === "verify" || action === "photo" || action === "printed") {
    if (!await requireAdmin(req, res)) return;
    if (action === "list") return list(req, res);
    if (action === "verify") return verify(req, res);
    if (action === "printed") return printed(req, res);
    return photo(req, res);
  }
  return res.status(400).json({ error: "Unknown action" });
}

async function list(req, res) {
  try {
    const msToken = await getMicrosoftToken();
    const out = [];
    let url = `${G}/sites/${SITE_ID}/lists/${CREDENTIALS_LIST_ID}/items?$expand=fields&$top=200`;
    // Follow paging rather than trusting one page — a season's worth of coaches
    // will exceed any single response.
    while (url) {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${msToken}` } });
      if (!r.ok) throw new Error(await r.text());
      const d = await r.json();
      for (const i of d.value || []) {
        const f = i.fields || {};
        out.push({
          id: i.id,
          submissionId: f.SubmissionId || "",
          role: f.Role || "",
          program: f.Program || "",
          programUnlisted: !!f.ProgramUnlisted,
          firstName: f.FirstName || "",
          lastName: f.LastName || "",
          email: f.Email || "",
          birthdate: f.Birthdate || null,
          isMinor: !!f.IsMinor,
          hadCard: !!f.HadCard2526,
          needsSelfie: !!f.NeedsSelfie,
          credentialLevel: f.CredentialLevel || "",
          provincialCertified: !!f.ProvincialCertified,
          provincialCertUrl: sharePointUrl(f.ProvincialCertUrl),
          status: f.Status || "Incomplete",
          // Stored relative to the library; turned back into links here so the
          // UI does not need to know either form.
          folderUrl: f.FolderUrl || "",
          vscUrl: sharePointUrl(f.VSCUrl),
          proofOfAgeUrl: sharePointUrl(f.ProofOfAgeUrl),
          credentialUrl: sharePointUrl(f.CredentialUrl),
          selfieUrl: sharePointUrl(f.SelfieUrl),
          submittedAt: f.SubmittedAt || f.Created || i.createdDateTime || null,
          cardPrinted: !!f.CardPrinted,
          cardPrintedOn: f.CardPrintedOn || null,
        });
      }
      url = d["@odata.nextLink"] || null;
    }
    out.sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
    res.json(out);
  } catch (e) {
    console.error("credential list error:", e.message);
    res.status(500).json({ error: e.message });
  }
}

async function verify(req, res) {
  const { itemId, status } = req.body || {};
  if (!itemId || !["Submitted", "Verified"].includes(status)) {
    return res.status(400).json({ error: "itemId and a valid status are required" });
  }
  try {
    const msToken = await getMicrosoftToken();
    const r = await fetch(`${G}/sites/${SITE_ID}/lists/${CREDENTIALS_LIST_ID}/items/${itemId}/fields`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${msToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ Status: status }),
    });
    if (!r.ok) throw new Error(await r.text());
    res.json({ ok: true, status });
  } catch (e) {
    console.error("credential verify error:", e.message);
    res.status(500).json({ error: e.message });
  }
}


// The card printer needs the coach's photo as pixels, but the files sit in
// SharePoint behind app-only auth that the browser cannot reach.
//
// For formats a canvas can decode we hand back the original bytes — the card
// prints at 300dpi and every resample costs detail. HEIC is the exception:
// phones shoot it by default and no browser will decode it, so we ask Graph for
// a rendered thumbnail instead. Thumbnails also come back already rotated,
// which the camera original is not.
async function photo(req, res) {
  const { itemId } = req.body || {};
  if (!itemId) return res.status(400).json({ error: "itemId is required" });

  try {
    const msToken = await getMicrosoftToken();
    const H = { Authorization: `Bearer ${msToken}` };

    const rowRes = await fetch(
      `${G}/sites/${SITE_ID}/lists/${CREDENTIALS_LIST_ID}/items/${itemId}?$expand=fields`,
      { headers: H }
    );
    if (!rowRes.ok) throw new Error(`Row lookup failed: ${await rowRes.text()}`);
    const folderPath = (await rowRes.json()).fields?.FolderUrl || "";
    if (!folderPath) return res.status(404).json({ error: "No folder recorded for this submission" });

    // Found by listing the folder rather than rebuilding the filename, because
    // the extension depends on whatever the coach's phone produced.
    const kidsRes = await fetch(
      `${G}/drives/${EVENT_DOCS_DRIVE_ID}/root:/${encodeURI(folderPath)}:/children`,
      { headers: H }
    );
    if (!kidsRes.ok) throw new Error(`Folder listing failed: ${await kidsRes.text()}`);
    const selfie = ((await kidsRes.json()).value || [])
      .find((c) => c.name && c.name.startsWith(`${FIELDS.selfie} -`));
    if (!selfie) return res.status(404).json({ error: "No selfie on file" });

    const ext = String(selfie.name.split(".").pop() || "").toLowerCase();
    const canvasSafe = ["jpg", "jpeg", "png", "webp"].includes(ext);

    // A HEIC has to be rendered by SharePoint, and there are three ways to ask.
    // Measured against a 2400x3200 portrait, none of them crops:
    //
    //   1. content conversion. One request, keeps the aspect ratio, returns the
    //      bytes directly. width/height are mandatory - it 400s without them.
    //   2. the thumbnails QUERY form. The path form, /thumbnails/0/c1600x1600,
    //      makes SharePoint answer with malformed JSON, so it is not used.
    //   3. `large`, capped at 800px on the long edge. Still ample for a 390px
    //      card window, but last.
    //
    // A thumbnail's reported width/height describe the box that was requested,
    // not the image inside it: that 2400x3200 photo comes back 600x800 from a
    // box reported as 800x800.
    let fileRes = null;
    if (canvasSafe) {
      fileRes = await fetch(`${G}/drives/${EVENT_DOCS_DRIVE_ID}/items/${selfie.id}/content`, { headers: H });
    } else {
      const converted = await fetch(
        `${G}/drives/${EVENT_DOCS_DRIVE_ID}/items/${selfie.id}/content?format=jpg&width=1600&height=1600`,
        { headers: H }
      );
      if (converted.ok) fileRes = converted;

      for (const size of ["c1600x1600", "large"]) {
        if (fileRes) break;
        const t = await fetch(
          `${G}/drives/${EVENT_DOCS_DRIVE_ID}/items/${selfie.id}/thumbnails?$select=${size}`,
          { headers: H }
        );
        if (!t.ok) continue;
        const url = (await t.json()).value?.[0]?.[size]?.url;
        if (!url) continue;
        // Pre-signed already, so this one must NOT carry our bearer token.
        const got = await fetch(url);
        if (got.ok) fileRes = got;
      }

      if (!fileRes) {
        return res.status(415).json({ error: `SharePoint could not render this ${ext.toUpperCase()} photo` });
      }
    }
    if (!fileRes.ok) return res.status(fileRes.status).json({ error: "Photo download failed" });

    res.setHeader("Content-Type", fileRes.headers.get("content-type") || "image/jpeg");
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(Buffer.from(await fileRes.arrayBuffer()));
  } catch (e) {
    console.error("credential photo error:", e.message);
    res.status(500).json({ error: e.message });
  }
}


// Records that cards have come off the printer.
//
// Takes a batch, because that is how cards are produced: a stack goes through
// the Magicard and the whole run is marked at once. Each row is patched
// separately - Graph has no bulk field update for list items - so one failure
// is reported without discarding the rest. Printing a card is the expensive,
// physical step; losing the record of a successful one would mean printing it
// twice.
async function printed(req, res) {
  const { itemIds, printed: value = true } = req.body || {};
  const ids = (Array.isArray(itemIds) ? itemIds : []).map(String).filter(Boolean);
  if (!ids.length) return res.status(400).json({ error: "itemIds is required" });
  if (ids.length > 200) return res.status(400).json({ error: "Too many cards in one batch" });

  const on = value ? new Date().toISOString() : null;
  const fields = { CardPrinted: !!value, CardPrintedOn: on };

  try {
    const msToken = await getMicrosoftToken();
    const H = { Authorization: `Bearer ${msToken}`, "Content-Type": "application/json" };

    const results = await Promise.all(ids.map(async (id) => {
      try {
        const r = await fetch(
          `${G}/sites/${SITE_ID}/lists/${CREDENTIALS_LIST_ID}/items/${id}/fields`,
          { method: "PATCH", headers: H, body: JSON.stringify(fields) }
        );
        if (!r.ok) return { id, ok: false, error: (await r.text()).slice(0, 200) };
        return { id, ok: true };
      } catch (e) {
        return { id, ok: false, error: e.message };
      }
    }));

    const failed = results.filter((r) => !r.ok);
    if (failed.length) console.error("credential printed: %d of %d failed", failed.length, ids.length);
    res.status(failed.length ? 207 : 200).json({
      ok: !failed.length,
      printed: !!value,
      printedOn: on,
      updated: results.filter((r) => r.ok).map((r) => r.id),
      failed,
    });
  } catch (e) {
    console.error("credential printed error:", e.message);
    res.status(500).json({ error: e.message });
  }
}

async function start(req, res) {
  const {
    role, program, programUnlisted, firstName, lastName, email,
    birthdate, hadCard2526, credentialLevel, provincialCertified, files,
  } = req.body || {};

  if (!["coach", "gym_admin"].includes(role)) return res.status(400).json({ error: "Invalid role" });
  if (!program?.trim()) return res.status(400).json({ error: "Program is required" });
  if (!firstName?.trim() || !lastName?.trim()) return res.status(400).json({ error: "Name is required" });
  if (!email?.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
    return res.status(400).json({ error: "A valid email is required" });
  }

  const isCoach = role === "coach";
  let isMinor = false;
  if (isCoach) {
    if (!birthdate) return res.status(400).json({ error: "Birthdate is required" });
    const dob = new Date(`${birthdate}T00:00:00`);
    if (isNaN(dob)) return res.status(400).json({ error: "Invalid birthdate" });
    isMinor = ageOn(dob, new Date()) < 18;
  }
  // Gym admin cards start this season, so no admin holds a 2025-26 card and
  // every admin needs a selfie.
  const hadCard = isCoach ? !!hadCard2526 : false;
  const needsSelfie = !hadCard;

  // A provincial body (OCF, FCQ and the like) has already vetted the coach, so
  // their certificate stands in for both the coaching credential and the
  // vulnerable sector check. Which body issued it isn't recorded — the
  // certificate itself is the evidence. Proof of age is unaffected: it
  // establishes age, not competence, and a minor still has to evidence it.
  const viaProvincial = isCoach && provincialCertified === true;

  const required = new Set();
  if (isCoach) {
    if (viaProvincial) {
      required.add("provincialCert");
      if (isMinor) required.add("proofOfAge");
    } else {
      required.add("credential");
      required.add(isMinor ? "proofOfAge" : "vsc");
    }
  } else {
    required.add("vsc");
  }
  if (needsSelfie) required.add("selfie");

  const declared = Array.isArray(files) ? files : [];
  for (const f of declared) {
    if (!FIELDS[f.field]) return res.status(400).json({ error: `Unknown file field: ${f.field}` });
    if (!ALLOWED[String(f.mimeType || "").toLowerCase()]) {
      return res.status(400).json({ error: `${FIELDS[f.field]}: only images and PDFs are accepted` });
    }
    if (!(f.size > 0) || f.size > MAX_BYTES) {
      return res.status(400).json({ error: `${FIELDS[f.field]}: file must be under 25MB` });
    }
  }
  const provided = new Set(declared.map((f) => f.field));
  for (const need of required) {
    if (!provided.has(need)) return res.status(400).json({ error: `${FIELDS[need]} is required` });
  }

  try {
    const msToken = await getMicrosoftToken();
    const H = { Authorization: `Bearer ${msToken}`, "Content-Type": "application/json" };
    const submissionId = randomUUID();

    // One folder per submission, under the program, so the library stays
    // browsable and a re-submission never overwrites someone else's documents.
    const folderPath = `${CREDENTIALS_FOLDER}/${safe(program, "Unknown Program")}/${safe(lastName)}, ${safe(firstName)} - ${submissionId.slice(0, 8)}`;

    const fields = {
      Title: `${lastName.trim()}, ${firstName.trim()} — ${program.trim()}`,
      SubmissionId: submissionId,
      Role: isCoach ? "Coach" : "Gym Admin",
      Program: program.trim(),
      FirstName: firstName.trim(),
      LastName: lastName.trim(),
      Email: email.trim(),
      IsMinor: isMinor,
      HadCard2526: hadCard,
      NeedsSelfie: needsSelfie,
      Status: "Incomplete",
      FolderUrl: folderPath,
      // Typed by hand rather than picked from the list, so it needs a human to
      // confirm it is a real program and not a fourth spelling of an existing one.
      ProgramUnlisted: programUnlisted === true,
      ...(isCoach && birthdate ? { Birthdate: `${birthdate}T00:00:00Z` } : {}),
      ...(credentialLevel ? { CredentialLevel: String(credentialLevel).slice(0, 120) } : {}),
      ...(isCoach ? { ProvincialCertified: viaProvincial } : {}),
    };

    const created = await fetch(`${G}/sites/${SITE_ID}/lists/${CREDENTIALS_LIST_ID}/items`, {
      method: "POST", headers: H, body: JSON.stringify({ fields }),
    });
    if (!created.ok) throw new Error(`List item failed: ${await created.text()}`);
    const item = await created.json();

    const uploads = [];
    for (const f of declared) {
      const ext = ALLOWED[String(f.mimeType).toLowerCase()];
      const name = `${FIELDS[f.field]} - ${safe(lastName)} ${safe(firstName)}.${ext}`;
      const s = await fetch(
        `${G}/drives/${EVENT_DOCS_DRIVE_ID}/root:/${encodeURI(`${folderPath}/${name}`)}:/createUploadSession`,
        { method: "POST", headers: H, body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "replace" } }) }
      );
      if (!s.ok) throw new Error(`Upload session failed for ${f.field}: ${await s.text()}`);
      uploads.push({ field: f.field, name, uploadUrl: (await s.json()).uploadUrl });
    }

    res.json({ submissionId, itemId: item.id, folderPath, uploads });
  } catch (e) {
    console.error("credential start error:", e.message);
    res.status(500).json({ error: e.message });
  }
}

async function finish(req, res) {
  const { itemId, folderPath, files } = req.body || {};
  if (!itemId || !folderPath || !Array.isArray(files)) {
    return res.status(400).json({ error: "itemId, folderPath and files are required" });
  }

  try {
    const msToken = await getMicrosoftToken();
    const H = { Authorization: `Bearer ${msToken}`, "Content-Type": "application/json" };
    const patch = { Status: "Submitted", SubmittedAt: new Date().toISOString() };

    for (const f of files) {
      const col = URL_FIELD[f.field];
      if (!col || !f.name) continue;
      const rel = `${folderPath}/${f.name}`;
      const meta = await fetch(
        `${G}/drives/${EVENT_DOCS_DRIVE_ID}/root:/${encodeURI(rel)}`,
        { headers: { Authorization: `Bearer ${msToken}` } }
      );
      // A file that didn't land leaves its column empty rather than failing the
      // whole submission — the row still shows what did arrive.
      if (!meta.ok) { console.warn(`missing uploaded file ${f.name}: ${meta.status}`); continue; }
      // The path, not the absolute webUrl Graph just returned: see
      // EVENT_DOCS_WEB_BASE in _lib.js for why. list() turns it back into a link.
      if (rel.length > LIST_TEXT_MAX) { console.warn(`path too long for ${col}: ${rel.length}`); continue; }
      patch[col] = rel;
    }

    let r = await fetch(`${G}/sites/${SITE_ID}/lists/${CREDENTIALS_LIST_ID}/items/${itemId}/fields`, {
      method: "PATCH", headers: H, body: JSON.stringify(patch),
    });
    if (!r.ok) {
      // The documents are safely in SharePoint by this point. Rather than leave
      // the row on Incomplete — which is what a rejected field used to do, and
      // which means nobody is told their submission arrived — record the status
      // on its own and let the missing links be fixed later.
      const why = await r.text();
      console.error("credential finish: full patch rejected, retrying status only:", why.slice(0, 300));
      r = await fetch(`${G}/sites/${SITE_ID}/lists/${CREDENTIALS_LIST_ID}/items/${itemId}/fields`, {
        method: "PATCH", headers: H,
        body: JSON.stringify({ Status: patch.Status, SubmittedAt: patch.SubmittedAt }),
      });
      if (!r.ok) throw new Error(`Update failed: ${await r.text()}`);
    }
    const saved = await r.json();

    // The documents are already in SharePoint by now, so a failed email must
    // never fail the submission.
    if (saved.Email) {
      sendMail(msToken, {
        from: CREDENTIALS_FROM,
        to: saved.Email,
        subject: "Coach credential submission received — Canadian Cheer",
        html: confirmationHtml(saved),
      }).catch((e) => console.error("Credential confirmation email failed:", e.message));
    }

    res.json({ ok: true, status: "Submitted" });
  } catch (e) {
    console.error("credential finish error:", e.message);
    res.status(500).json({ error: e.message });
  }
}

function confirmationHtml(f) {
  const name = `${f.FirstName || ""} ${f.LastName || ""}`.trim() || "there";
  const next = f.NeedsSelfie
    ? "You'll collect your 2026-27 Coaching Credential Card at the first event you attend."
    : "We'll verify your existing credential card at the first event you attend.";
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.12);">
    <div style="background:#1a1a2e;padding:28px 32px;">
      <p style="margin:0;color:rgba(255,255,255,0.5);font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">Canadian Cheer</p>
      <h1 style="margin:6px 0 0;color:#fff;font-size:22px;font-weight:600;">Credentials Received</h1>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.55;">
        Hi ${name}, we've received your ${f.Role === "Gym Admin" ? "gym admin" : "coach"} credential submission for <strong>${f.Program || ""}</strong>.
      </p>
      <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.55;">${next}</p>
      <p style="margin:0;color:#9ca3af;font-size:12px;">If anything was missing we'll be in touch at this address.</p>
    </div>
  </div>
</body></html>`;
}
