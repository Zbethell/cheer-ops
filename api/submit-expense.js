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

  const { submitterName, submitterEmail, company, lineItems, eventId, eventName } = req.body;

  if (!submitterName || !submitterEmail || !company || !Array.isArray(lineItems) || lineItems.length === 0) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  for (const item of lineItems) {
    if (!item.category || !item.expenseDate || item.amount == null) {
      return res.status(400).json({ error: "Each line item requires category, expenseDate, and amount" });
    }
  }

  try {
    const msToken = await getMicrosoftToken();
    const base = appBaseUrl(req);

    // Reuse existing pending token if this submitter already has an open report
    let expenseToken = randomUUID();
    try {
      const filter = `fields/SubmitterEmail eq '${submitterEmail.replace(/'/g, "''")}' and fields/Company eq '${company.replace(/'/g, "''")}' and fields/Status eq 'Pending'`;
      const checkUrl = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${EXPENSES_LIST_ID}/items?$expand=fields&$filter=${encodeURIComponent(filter)}&$orderby=fields/Created desc&$top=1`;
      const checkRes = await fetch(checkUrl, {
        headers: { Authorization: `Bearer ${msToken}`, Prefer: "HonorNonIndexedQueriesWarningMayFailRandomly" },
      });
      if (checkRes.ok) {
        const { value } = await checkRes.json();
        if (value?.length > 0 && value[0].fields?.Token) {
          expenseToken = value[0].fields.Token;
        }
      }
    } catch (e) {
      console.warn("Pending token lookup failed, using new token:", e.message);
    }
    const submittedDate = new Date().toLocaleDateString("en-CA");

    const processedItems = await Promise.all(
      lineItems.map(async (item, i) => {
        let receiptURL = "";
        let extracted = {};

        if (item.receiptBase64 && item.receiptFileName) {
          const fileBuffer = Buffer.from(item.receiptBase64, "base64");
          const ext = item.receiptFileName.split(".").pop().replace(/[^a-zA-Z0-9]/g, "") || "jpg";
          const namePart = submitterName.trim().replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");
          const categoryPart = item.category.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");
          const amountPart = parseFloat(item.amount).toFixed(2);
          const dateStr = item.expenseDate || new Date().toISOString().split("T")[0];
          const suffix = lineItems.length > 1 ? `_${i + 1}of${lineItems.length}` : "";
          const safeName = `${dateStr}_${namePart}_${categoryPart}_$${amountPart}${suffix}.${ext}`;

          const [uploadRes] = await Promise.all([
            fetch(
              `https://graph.microsoft.com/v1.0/drives/${SHAREPOINT_DRIVE_ID}/root:/Expense%20Receipts/${encodeURIComponent(safeName)}:/content`,
              {
                method: "PUT",
                headers: { Authorization: `Bearer ${msToken}`, "Content-Type": item.receiptMimeType || "application/octet-stream" },
                body: fileBuffer,
              }
            ),
            analyzeReceipt(fileBuffer, item.receiptMimeType)
              .then((r) => { extracted = r; })
              .catch((e) => console.error(`Receipt analysis failed (item ${i + 1}):`, e.message)),
          ]);

          if (uploadRes.ok) {
            receiptURL = (await uploadRes.json()).webUrl || "";
          } else {
            console.error(`Receipt upload failed (item ${i + 1}):`, await uploadRes.text());
          }
        }

        const titleSuffix = lineItems.length > 1 ? ` (${i + 1}/${lineItems.length})` : "";
        const createRes = await fetch(
          `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${EXPENSES_LIST_ID}/items`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${msToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              fields: {
                Title: `${submitterName} – ${submittedDate}${titleSuffix}`,
                SubmitterName: submitterName,
                SubmitterEmail: submitterEmail,
                Amount: parseFloat(item.amount),
                Category: item.category,
                Company: company,
                ExpenseDate: item.expenseDate,
                Description: item.description || "",
                ReceiptURL: receiptURL,
                Status: "Pending",
                Token: expenseToken,
                ...(extracted.merchantName      != null && { MerchantName:      extracted.merchantName }),
                ...(extracted.extractedTotal    != null && { ExtractedTotal:    extracted.extractedTotal }),
                ...(extracted.extractedSubtotal != null && { ExtractedSubtotal: extracted.extractedSubtotal }),
                ...(extracted.extractedTax      != null && { ExtractedTax:      extracted.extractedTax }),
                ...(extracted.extractedItems    != null && { ExtractedItems:    extracted.extractedItems }),
                ...(extracted.extractedDate     != null && { ExtractedDate:     extracted.extractedDate }),
                ...(item.startLocation && { StartLocation: item.startLocation }),
                ...(item.endLocation   && { EndLocation:   item.endLocation }),
                ...(item.totalKMs      != null && { TotalKMs:    parseFloat(item.totalKMs) }),
                ...(item.mileageRate   != null && { MileageRate: parseFloat(item.mileageRate) }),
                ...(eventId   && { EventId:   eventId }),
                ...(eventName && { EventName: eventName }),
              },
            }),
          }
        );
        if (!createRes.ok) throw new Error(await createRes.text());

        return { ...item, receiptURL, extracted };
      })
    );

    const totalAmount = processedItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
    const trackingUrl = `${base}/expenses-status?token=${expenseToken}`;
    const dashboardUrl = `${base}/`;

    await Promise.all([
      EXPENSE_NOTIFY_EMAIL
        ? sendMail(msToken, {
            to: EXPENSE_NOTIFY_EMAIL,
            subject: `New Expense: ${submitterName} – $${totalAmount.toFixed(2)} (${company})`,
            html: accountantEmailHtml({ submitterName, submitterEmail, company, lineItems: processedItems, totalAmount, dashboardUrl }),
          })
        : Promise.resolve(),
      sendMail(msToken, {
        to: submitterEmail,
        subject: `Expense Submitted – $${totalAmount.toFixed(2)} (${company})`,
        html: submitterConfirmationHtml({ submitterName, company, lineItems: processedItems, totalAmount, trackingUrl }),
      }),
    ]).catch((e) => console.error("Email send error:", e.message));

    res.json({ success: true, token: expenseToken });
  } catch (e) {
    console.error("Submit expense error:", e.message);
    res.status(500).json({ error: e.message });
  }
}
