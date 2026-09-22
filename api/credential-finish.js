// Step 2 of a coach credential submission: called once the browser has finished
// uploading every file directly to SharePoint.
//
// Resolves each uploaded file to a link, writes those onto the list row and
// flips it to Submitted. Until this runs the row stays "Incomplete", so a
// half-finished submission is visible in the list rather than silently lost.

import {
  getMicrosoftToken, sendMail, SITE_ID,
  EVENT_DOCS_DRIVE_ID, CREDENTIALS_LIST_ID,
} from "./_lib.js";

const G = "https://graph.microsoft.com/v1.0";

const URL_FIELD = {
  vsc: "VSCUrl",
  proofOfAge: "ProofOfAgeUrl",
  credential: "CredentialUrl",
  selfie: "SelfieUrl",
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

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

    // Confirmation to the submitter. Never fails the submission — the documents
    // are already in SharePoint by this point.
    if (saved.Email) {
      sendMail(msToken, {
        to: saved.Email,
        subject: "Coach credential submission received — Canadian Cheer",
        html: confirmationHtml(saved),
      }).catch((e) => console.error("Credential confirmation email failed:", e.message));
    }

    res.json({ ok: true, status: "Submitted" });
  } catch (e) {
    console.error("credential-finish error:", e.message);
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
