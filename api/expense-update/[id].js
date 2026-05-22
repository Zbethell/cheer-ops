import {
  getMicrosoftToken, requireAdmin, sendMail, paidNotificationHtml,
  SITE_ID, EXPENSES_LIST_ID,
} from "../_lib.js";

export default async function handler(req, res) {
  if (req.method !== "PATCH") return res.status(405).json({ error: "Method not allowed" });

  const user = await requireAdmin(req, res);
  if (!user) return;

  const { id } = req.query;
  const { status, amount } = req.body;
  if (!status && amount == null) return res.status(400).json({ error: "status or amount required" });

  try {
    const token = await getMicrosoftToken();

    const fields = {};
    if (status) fields.Status = status;
    if (amount != null) fields.Amount = parseFloat(amount);

    // Fetch expense details before updating (needed for paid notification)
    const detailRes = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${EXPENSES_LIST_ID}/items/${id}?$expand=fields`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const detail = detailRes.ok ? await detailRes.json() : null;

    const r = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${EXPENSES_LIST_ID}/items/${id}/fields`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      }
    );
    if (!r.ok) throw new Error(await r.text());

    // Notify submitter when marked paid
    if (status === "Paid" && detail?.fields?.SubmitterEmail) {
      const f = detail.fields;
      sendMail(token, {
        to: f.SubmitterEmail,
        subject: `Your Expense Has Been Approved – $${parseFloat(f.Amount || 0).toFixed(2)}`,
        html: paidNotificationHtml({
          submitterName: f.SubmitterName || "there",
          amount: f.Amount || 0,
          category: f.Category || "",
          expenseDate: f.ExpenseDate || "",
        }),
      }).catch((e) => console.error("Paid email error:", e.message));
    }

    res.json({ success: true });
  } catch (e) {
    console.error("Expense update error:", e.message);
    res.status(500).json({ error: e.message });
  }
}
