import { getMicrosoftToken, SITE_ID, EXPENSES_LIST_ID } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { token } = req.query;
  if (!token) return res.status(400).json({ error: "token required" });

  try {
    const msToken = await getMicrosoftToken();
    const filter = `fields/Token eq '${token.replace(/'/g, "''")}'`;
    const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${EXPENSES_LIST_ID}/items?$expand=fields&$filter=${encodeURIComponent(filter)}&$top=1`;
    const r = await fetch(url, {
      headers: {
        Authorization: `Bearer ${msToken}`,
        Prefer: "HonorNonIndexedQueriesWarningMayFailRandomly",
      },
    });
    if (!r.ok) throw new Error(await r.text());
    const { value } = await r.json();
    if (!value || value.length === 0) return res.status(404).json({ error: "Expense not found" });

    const f = value[0].fields;
    res.json({
      id: value[0].id,
      submitterName: f.SubmitterName || "",
      amount: f.Amount || 0,
      category: f.Category || "",
      expenseDate: f.ExpenseDate || "",
      description: f.Description || "",
      status: f.Status || "Pending",
      submittedAt: f.Created || value[0].createdDateTime || null,
      receiptURL: f.ReceiptURL || "",
    });
  } catch (e) {
    console.error("Expense status error:", e.message);
    res.status(500).json({ error: e.message });
  }
}
