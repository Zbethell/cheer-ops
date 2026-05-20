import { randomUUID } from "crypto";
import {
  getMicrosoftToken, analyzeReceipt, sendMail,
  accountantEmailHtml, submitterConfirmationHtml,
  SITE_ID, EXPENSES_LIST_ID, SHAREPOINT_DRIVE_ID,
  appBaseUrl,
} from "./_lib.js";

const { EXPENSE_NOTIFY_EMAIL } = process.env;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const {
    submitterName, submitterEmail, amount, category, company, expenseDate,
    description, receiptBase64, receiptMimeType, receiptFileName,
    startLocation, endLocation, totalKMs, mileageRate,
  } = req.body;

  if (!submitterName || !submitterEmail || !amount || !category || !expenseDate) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const token = await getMicrosoftToken();
    const expenseToken = randomUUID();
    const base = appBaseUrl(req);

    let receiptURL = "";
    let extracted = {};
    if (receiptBase64 && receiptFileName) {
      const fileBuffer = Buffer.from(receiptBase64, "base64");
      const safeName = `${Date.now()}-${receiptFileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const [uploadRes] = await Promise.all([
        fetch(
          `https://graph.microsoft.com/v1.0/drives/${SHAREPOINT_DRIVE_ID}/root:/Expense%20Receipts/${encodeURIComponent(safeName)}:/content`,
          {
            method: "PUT",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": receiptMimeType || "application/octet-stream" },
            body: fileBuffer,
          }
        ),
        analyzeReceipt(fileBuffer, receiptMimeType)
          .then((r) => { extracted = r; })
          .catch((e) => console.error("Receipt analysis failed:", e.message)),
      ]);
      if (uploadRes.ok) {
        receiptURL = (await uploadRes.json()).webUrl || "";
      } else {
        console.error("Receipt upload failed:", await uploadRes.text());
      }
    }

    const createRes = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${EXPENSES_LIST_ID}/items`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: {
            Title: `${submitterName} – ${new Date().toLocaleDateString("en-CA")}`,
            SubmitterName: submitterName,
            SubmitterEmail: submitterEmail,
            Amount: parseFloat(amount),
            Category: category,
            Company: company || "",
            ExpenseDate: expenseDate,
            Description: description || "",
            ReceiptURL: receiptURL,
            Status: "Pending",
            Token: expenseToken,
            ...(extracted.merchantName      != null && { MerchantName:      extracted.merchantName }),
            ...(extracted.extractedTotal    != null && { ExtractedTotal:    extracted.extractedTotal }),
            ...(extracted.extractedSubtotal != null && { ExtractedSubtotal: extracted.extractedSubtotal }),
            ...(extracted.extractedTax      != null && { ExtractedTax:      extracted.extractedTax }),
            ...(extracted.extractedItems    != null && { ExtractedItems:    extracted.extractedItems }),
            ...(extracted.extractedDate     != null && { ExtractedDate:     extracted.extractedDate }),
            ...(startLocation && { StartLocation: startLocation }),
            ...(endLocation   && { EndLocation:   endLocation }),
            ...(totalKMs      != null && { TotalKMs:    parseFloat(totalKMs) }),
            ...(mileageRate   != null && { MileageRate: parseFloat(mileageRate) }),
          },
        }),
      }
    );
    if (!createRes.ok) throw new Error(await createRes.text());

    const trackingUrl = `${base}/expenses-status?token=${expenseToken}`;
    const dashboardUrl = `${base}/`;
    const emailData = { submitterName, submitterEmail, amount, category, company, expenseDate, description };

    await Promise.all([
      EXPENSE_NOTIFY_EMAIL
        ? sendMail(token, {
            to: EXPENSE_NOTIFY_EMAIL,
            subject: `New Expense: ${submitterName} – $${parseFloat(amount).toFixed(2)} (${category})`,
            html: accountantEmailHtml({ ...emailData, dashboardUrl }),
          })
        : Promise.resolve(),
      sendMail(token, {
        to: submitterEmail,
        subject: `Expense Submitted – $${parseFloat(amount).toFixed(2)} (${category})`,
        html: submitterConfirmationHtml({ submitterName, amount, category, expenseDate, description, trackingUrl }),
      }),
    ]).catch((e) => console.error("Email send error:", e.message));

    res.json({ success: true, token: expenseToken });
  } catch (e) {
    console.error("Submit expense error:", e.message);
    res.status(500).json({ error: e.message });
  }
}
