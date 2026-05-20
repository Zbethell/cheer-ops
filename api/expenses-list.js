import { getMicrosoftToken, requireAdmin, SITE_ID, EXPENSES_LIST_ID } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const user = await requireAdmin(req, res);
  if (!user) return;

  try {
    const token = await getMicrosoftToken();
    const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${EXPENSES_LIST_ID}/items?$expand=fields&$top=999`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(await r.text());
    const { value } = await r.json();
    const items = value
      .map((i) => ({
        id: i.id,
        submitterName:     i.fields.SubmitterName     || "",
        submitterEmail:    i.fields.SubmitterEmail    || "",
        amount:            i.fields.Amount            || 0,
        category:          i.fields.Category          || "",
        expenseDate:       i.fields.ExpenseDate       || "",
        description:       i.fields.Description       || "",
        status:            i.fields.Status            || "Pending",
        receiptURL:        i.fields.ReceiptURL        || "",
        token:             i.fields.Token             || "",
        submittedAt:       i.fields.Created           || i.createdDateTime || null,
        merchantName:      i.fields.MerchantName      || null,
        extractedTotal:    i.fields.ExtractedTotal    ?? null,
        extractedSubtotal: i.fields.ExtractedSubtotal ?? null,
        extractedTax:      i.fields.ExtractedTax      ?? null,
        extractedItems:    i.fields.ExtractedItems    || null,
        extractedDate:     i.fields.ExtractedDate     || null,
        company:           i.fields.Company           || "",
        startLocation:     i.fields.StartLocation     || null,
        endLocation:       i.fields.EndLocation       || null,
        totalKMs:          i.fields.TotalKMs          ?? null,
        mileageRate:       i.fields.MileageRate       ?? null,
      }))
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    res.json(items);
  } catch (e) {
    console.error("Expenses list error:", e.message);
    res.status(500).json({ error: e.message });
  }
}
