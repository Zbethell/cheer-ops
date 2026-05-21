const {
  AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET,
  DOC_INTEL_KEY,
  SUPABASE_URL, SUPABASE_ANON_KEY,
  EXPENSE_FROM_EMAIL, EXPENSE_NOTIFY_EMAIL,
  APP_URL,
} = process.env;

const DOC_INTEL_ENDPOINT = (process.env.DOC_INTEL_ENDPOINT || "").trim();

export const SITE_ID = "canadiancheer.sharepoint.com,3de101e2-cad1-4d01-b8f2-581326ad7ef2,b28c2a3b-2636-4279-9c6a-ba34c5edfcb9";
export const EXPENSES_LIST_ID = "33fd6b8c-b4df-47bd-af5b-b17ee2bfcf51";
export const SHAREPOINT_DRIVE_ID = "b!4gHhPdHKAU248lgTJq1-8jsqjLI2JnlCnGq6NMXt_LkVJJY25OMISagOm60QPCvf";

export async function getMicrosoftToken() {
  const res = await fetch(
    `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: AZURE_CLIENT_ID,
        client_secret: AZURE_CLIENT_SECRET,
        scope: "https://graph.microsoft.com/.default",
      }),
    }
  );
  const data = await res.json();
  if (!data.access_token) throw new Error(`Token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

export async function analyzeReceipt(fileBuffer, mimeType) {
  const analyzeRes = await fetch(
    `${DOC_INTEL_ENDPOINT}/documentintelligence/documentModels/prebuilt-receipt:analyze?api-version=2024-11-30`,
    {
      method: "POST",
      headers: { "Ocp-Apim-Subscription-Key": DOC_INTEL_KEY, "Content-Type": mimeType || "image/jpeg" },
      body: fileBuffer,
    }
  );
  if (!analyzeRes.ok) throw new Error(`Doc Intel submit failed: ${await analyzeRes.text()}`);
  const pollUrl = analyzeRes.headers.get("Operation-Location");
  if (!pollUrl) throw new Error("No Operation-Location header returned");

  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const pollRes = await fetch(pollUrl, { headers: { "Ocp-Apim-Subscription-Key": DOC_INTEL_KEY } });
    if (!pollRes.ok) throw new Error(`Polling failed: ${await pollRes.text()}`);
    const result = await pollRes.json();
    if (result.status === "failed") throw new Error("Document analysis failed");
    if (result.status !== "succeeded") continue;

    const doc = result.analyzeResult?.documents?.[0];
    if (!doc) return {};
    const f = doc.fields || {};
    const currency = (field) => field?.valueCurrency?.amount ?? field?.valueNumber ?? null;
    const items = (f.Items?.valueArray || []).map((item) => {
      const o = item.valueObject || {};
      return [o.Description?.valueString, o.TotalPrice ? `$${currency(o.TotalPrice)?.toFixed(2)}` : null]
        .filter(Boolean).join(" – ");
    }).filter(Boolean);

    return {
      merchantName:      f.MerchantName?.valueString || null,
      extractedTotal:    currency(f.Total),
      extractedSubtotal: currency(f.Subtotal),
      extractedTax:      currency(f.TotalTax),
      extractedItems:    items.join("\n") || null,
      extractedDate:     f.TransactionDate?.valueDate || null,
    };
  }
  throw new Error("Document analysis timed out");
}

// Verifies the Supabase JWT from the Authorization header.
// Returns the user object or sends a 401 and returns null.
const ADMIN_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBleWxvbnVrY3dzcWRrbmNoeGRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MDQxOTYsImV4cCI6MjA5MzQ4MDE5Nn0.fTgnQxWxBDcHk0Xq-4KQJZH9xi4bYwle27tdrjseQ3k";

export async function requireAdmin(req, res) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ") || auth.slice(7) !== ADMIN_TOKEN) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return { authenticated: true };
}

export async function sendMail(msToken, { to, subject, html }) {
  const from = EXPENSE_FROM_EMAIL;
  if (!from || !to) return;
  const r = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(from)}/sendMail`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${msToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: "HTML", content: html },
          toRecipients: [{ emailAddress: { address: to } }],
        },
        saveToSentItems: false,
      }),
    }
  );
  if (!r.ok) console.error("sendMail failed:", await r.text());
}

function row(label, value) {
  return `<tr>
    <td style="padding:10px 14px;background:#f8f9fb;font-weight:600;color:#374151;width:36%;vertical-align:top;">${label}</td>
    <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;color:#1a1a2e;">${value}</td>
  </tr>`;
}

export function accountantEmailHtml({ submitterName, submitterEmail, amount, category, company, expenseDate, description, dashboardUrl }) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.12);">
    <div style="background:#1a1a2e;padding:28px 32px;">
      <p style="margin:0;color:rgba(255,255,255,0.5);font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">CheerOps Expenses</p>
      <h1 style="margin:6px 0 0;color:#fff;font-size:22px;font-weight:600;">New Expense Submitted</h1>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.5;">A new expense has been submitted and is awaiting your review.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
        ${row("Submitted By", `${submitterName}<br><span style="color:#6b7280;font-size:12px;">${submitterEmail}</span>`)}
        ${row("Amount", `<strong style="font-size:16px;">$${parseFloat(amount).toFixed(2)}</strong>`)}
        ${row("Category", category)}
        ${company ? row("Company", company) : ""}
        ${row("Expense Date", expenseDate)}
        ${description ? row("Description", `<span style="color:#6b7280;">${description}</span>`) : ""}
      </table>
      <div style="margin-top:28px;">
        <a href="${dashboardUrl}" style="display:inline-block;background:#1a1a2e;color:#fff;padding:13px 26px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">Review in CheerOps →</a>
      </div>
      <p style="margin:28px 0 0;color:#9ca3af;font-size:12px;">Sent by CheerOps expense portal. Log in to approve or mark as paid.</p>
    </div>
  </div>
</body></html>`;
}

export function submitterConfirmationHtml({ submitterName, amount, category, expenseDate, description, trackingUrl }) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.12);">
    <div style="background:#1a1a2e;padding:28px 32px;">
      <p style="margin:0;color:rgba(255,255,255,0.5);font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">CheerOps Expenses</p>
      <h1 style="margin:6px 0 0;color:#fff;font-size:22px;font-weight:600;">Expense Submitted</h1>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.5;">Hi ${submitterName}, your expense has been received and is pending review. You can check the status at any time using the link below.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
        ${row("Amount", `<strong style="font-size:16px;">$${parseFloat(amount).toFixed(2)}</strong>`)}
        ${row("Category", category)}
        ${row("Expense Date", expenseDate)}
        ${description ? row("Description", `<span style="color:#6b7280;">${description}</span>`) : ""}
        ${row("Status", `<span style="background:#fef3c7;color:#92400e;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:600;">Pending</span>`)}
      </table>
      <div style="margin-top:28px;">
        <a href="${trackingUrl}" style="display:inline-block;background:#1a1a2e;color:#fff;padding:13px 26px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">Track Your Expense →</a>
      </div>
      <p style="margin:20px 0 0;color:#9ca3af;font-size:12px;">Keep this link to check your reimbursement status. You'll receive another email when payment is processed.</p>
    </div>
  </div>
</body></html>`;
}

export function paidNotificationHtml({ submitterName, amount, category, expenseDate }) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.12);">
    <div style="background:#065f46;padding:28px 32px;">
      <p style="margin:0;color:rgba(255,255,255,0.5);font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">CheerOps Expenses</p>
      <h1 style="margin:6px 0 0;color:#fff;font-size:22px;font-weight:600;">Expense Approved</h1>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.5;">Hi ${submitterName}, your expense has been reviewed and payment has been processed.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
        ${row("Amount", `<strong style="font-size:16px;">$${parseFloat(amount).toFixed(2)}</strong>`)}
        ${row("Category", category)}
        ${row("Expense Date", expenseDate)}
        ${row("Status", `<span style="background:#d1fae5;color:#065f46;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:600;">Paid</span>`)}
      </table>
      <p style="margin:28px 0 0;color:#9ca3af;font-size:12px;">If you have any questions about this payment, please contact the accounting team.</p>
    </div>
  </div>
</body></html>`;
}

export function appBaseUrl(req) {
  return APP_URL || `https://${req.headers["x-forwarded-host"] || req.headers.host}`;
}
