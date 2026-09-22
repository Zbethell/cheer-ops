// Step 1 of a coach credential submission.
//
// Validates the answers, creates the SharePoint folder and list row, and hands
// back one pre-authenticated upload URL per file. The browser then PUTs each
// file straight to SharePoint — nothing passes through this function, which is
// the whole point: Vercel caps request bodies at 4.5MB and cannot be raised, so
// a base64 upload (what the expense form does) would fail on a phone photo or
// two. Graph upload sessions have no such ceiling.
//
// The client never chooses a path or filename. It says which field a file is
// for and how big it is; everything else is decided here, so an open endpoint
// can't be used to write arbitrary files anywhere in the library.

import { randomUUID } from "crypto";
import {
  getMicrosoftToken, SITE_ID,
  EVENT_DOCS_DRIVE_ID, CREDENTIALS_FOLDER, CREDENTIALS_LIST_ID,
} from "./_lib.js";

const G = "https://graph.microsoft.com/v1.0";

// Documents and photos only, and a ceiling well above a phone photo or a
// scanned PDF but low enough that the folder can't be used as free storage.
const ALLOWED = {
  "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png",
  "image/heic": "heic", "image/heif": "heif", "image/webp": "webp",
  "application/pdf": "pdf",
};
const MAX_BYTES = 25 * 1024 * 1024;

const FIELDS = {
  vsc:        "Vulnerable-Sector-Check",
  proofOfAge: "Proof-of-Age",
  credential: "Coaching-Credential",
  selfie:     "Selfie",
};

// Anything that could escape the folder or upset SharePoint.
const safe = (s, fallback = "unknown") => {
  const out = String(s || "").normalize("NFKD")
    .replace(/[^\w\s.-]/g, "").replace(/\s+/g, " ").trim().slice(0, 60);
  return out || fallback;
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const {
    role, program, firstName, lastName, email,
    birthdate, hadCard2526, credentialLevel, files,
  } = req.body || {};

  // ── Validate the answers ────────────────────────────────────────────────
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
  // Gym admin cards start this season, so no admin can hold a 2025-26 card and
  // every admin needs a selfie.
  const hadCard = isCoach ? !!hadCard2526 : false;
  const needsSelfie = !hadCard;

  // ── Which files this branch must include ────────────────────────────────
  const required = new Set();
  if (isCoach) {
    required.add("credential");
    required.add(isMinor ? "proofOfAge" : "vsc");
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
    const shortId = submissionId.slice(0, 8);

    // One folder per submission, under the program, so the library stays
    // browsable and a re-submission never overwrites someone else's documents.
    const folderPath = `${CREDENTIALS_FOLDER}/${safe(program, "Unknown Program")}/${safe(lastName)}, ${safe(firstName)} - ${shortId}`;

    const mk = await fetch(
      `${G}/drives/${EVENT_DOCS_DRIVE_ID}/root:/${encodeURI(folderPath)}:/children`,
      { method: "POST", headers: H, body: JSON.stringify({ name: ".keep", file: {}, "@microsoft.graph.conflictBehavior": "replace" }) }
    ).catch(() => null);
    // A missing .keep is harmless — the upload sessions below create the path.
    if (mk && !mk.ok) console.warn("folder placeholder failed:", await mk.text());

    const title = `${lastName.trim()}, ${firstName.trim()} — ${program.trim()}`;
    const fields = {
      Title: title,
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
      FolderUrl: `${folderPath}`,
      ...(isCoach && birthdate ? { Birthdate: `${birthdate}T00:00:00Z` } : {}),
      ...(credentialLevel ? { CredentialLevel: String(credentialLevel).slice(0, 120) } : {}),
    };

    const created = await fetch(`${G}/sites/${SITE_ID}/lists/${CREDENTIALS_LIST_ID}/items`, {
      method: "POST", headers: H, body: JSON.stringify({ fields }),
    });
    if (!created.ok) throw new Error(`List item failed: ${await created.text()}`);
    const item = await created.json();

    // One upload session per declared file. The name is derived here.
    const uploads = [];
    for (const f of declared) {
      const ext = ALLOWED[String(f.mimeType).toLowerCase()];
      const name = `${FIELDS[f.field]} - ${safe(lastName)} ${safe(firstName)}.${ext}`;
      const s = await fetch(
        `${G}/drives/${EVENT_DOCS_DRIVE_ID}/root:/${encodeURI(`${folderPath}/${name}`)}:/createUploadSession`,
        { method: "POST", headers: H, body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "replace" } }) }
      );
      if (!s.ok) throw new Error(`Upload session failed for ${f.field}: ${await s.text()}`);
      const { uploadUrl } = await s.json();
      uploads.push({ field: f.field, name, uploadUrl });
    }

    res.json({ submissionId, itemId: item.id, folderPath, uploads });
  } catch (e) {
    console.error("credential-start error:", e.message);
    res.status(500).json({ error: e.message });
  }
}

// Whole years, not a millisecond division — a birthday that hasn't happened yet
// this year must not round someone up to 18.
function ageOn(dob, on) {
  let age = on.getFullYear() - dob.getFullYear();
  const m = on.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && on.getDate() < dob.getDate())) age--;
  return age;
}
