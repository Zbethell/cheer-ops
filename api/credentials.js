// Coach credential intake. Two actions in one function.
//
// They were separate routes until the Hobby plan's 12-function ceiling refused
// the deploy; the split bought nothing, since the browser always calls them in
// sequence for the same submission.
//
//   start  — validate the answers, create the SharePoint folder and the list row
//            as Incomplete, and return one upload URL per file.
//   finish — called once the browser has uploaded every file directly to
//            SharePoint: resolve each file to a link, write those onto the row,
//            flip it to Submitted and email the submitter.
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
  // start/finish are the public form. list/verify are the admin side and are
  // gated — they read personal data. Everything shares one function because the
  // Hobby plan allows 12 and the project is at 12.
  if (action === "start") return start(req, res);
  if (action === "finish") return finish(req, res);
  if (action === "list" || action === "verify") {
    if (!await requireAdmin(req, res)) return;
    return action === "list" ? list(req, res) : verify(req, res);
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
          firstName: f.FirstName || "",
          lastName: f.LastName || "",
          email: f.Email || "",
          birthdate: f.Birthdate || null,
          isMinor: !!f.IsMinor,
          hadCard: !!f.HadCard2526,
          needsSelfie: !!f.NeedsSelfie,
          credentialLevel: f.CredentialLevel || "",
          provincialCertified: !!f.ProvincialCertified,
          provincialCertUrl: f.ProvincialCertUrl || "",
          status: f.Status || "Incomplete",
          folderUrl: f.FolderUrl || "",
          vscUrl: f.VSCUrl || "",
          proofOfAgeUrl: f.ProofOfAgeUrl || "",
          credentialUrl: f.CredentialUrl || "",
          selfieUrl: f.SelfieUrl || "",
          submittedAt: f.SubmittedAt || f.Created || i.createdDateTime || null,
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

async function start(req, res) {
  const {
    role, program, firstName, lastName, email,
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
      const meta = await fetch(
        `${G}/drives/${EVENT_DOCS_DRIVE_ID}/root:/${encodeURI(`${folderPath}/${f.name}`)}`,
        { headers: { Authorization: `Bearer ${msToken}` } }
      );
      // A file that didn't land leaves its column empty rather than failing the
      // whole submission — the row still shows what did arrive.
      if (meta.ok) patch[col] = (await meta.json()).webUrl || "";
      else console.warn(`missing uploaded file ${f.name}: ${meta.status}`);
    }

    const r = await fetch(`${G}/sites/${SITE_ID}/lists/${CREDENTIALS_LIST_ID}/items/${itemId}/fields`, {
      method: "PATCH", headers: H, body: JSON.stringify(patch),
    });
    if (!r.ok) throw new Error(`Update failed: ${await r.text()}`);
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
