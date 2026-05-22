import { getMicrosoftToken, SITE_ID, EXPENSES_LIST_ID } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { token } = req.query;
  if (!token) return res.status(400).json({ error: "token required" });

  try {
    const msToken = await getMicrosoftToken();
    const filter = `fields/Token eq '${token.replace(/'/g, "''")}'`;
    const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${EXPENSES_LIST_ID}/items?$expand=fields&$filter=${encodeURIComponent(filter)}&$top=100`;
    const r = await fetch(url, {
      headers: {
        Authorization: `Bearer ${msToken}`,
        Prefer: "HonorNonIndexedQueriesWarningMayFailRandomly",
      },
    });
    if (!r.ok) throw new Error(await r.text());
    const { value } = await r.json();
    if (!value || value.length === 0) return res.status(404).json({ error: "Expense not found" });

    const lineItems = value.map((item) => {
      const f = item.fields;
      return {
        id: item.id,
        category:      f.Category      || "",
        expenseDate:   f.ExpenseDate   || "",
        amount:        f.Amount        || 0,
        description:   f.Description   || "",
        receiptURL:    f.ReceiptURL    || "",
        merchantName:  f.MerchantName  || null,
        startLocation: f.StartLocation || null,
        endLocation:   f.EndLocation   || null,
        totalKMs:      f.TotalKMs      ?? null,
        mileageRate:   f.MileageRate   ?? null,
      };
    });

    const first = value[0].fields;
    const overallStatus = value.every((i) => i.fields.Status === "Paid") ? "Paid" : "Pending";
    const totalAmount = lineItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

    res.json({
      submitterName: first.SubmitterName || "",
      company:       first.Company       || "",
      status:        overallStatus,
      submittedAt:   first.Created || value[0].createdDateTime || null,
      totalAmount,
      lineItems,
    });
  } catch (e) {
    console.error("Expense status error:", e.message);
    res.status(500).json({ error: e.message });
  }
}
