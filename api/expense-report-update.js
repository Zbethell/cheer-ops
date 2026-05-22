import {
  getMicrosoftToken, requireAdmin, sendMail, paidNotificationHtml,
  SITE_ID, EXPENSES_LIST_ID,
} from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "PATCH") return res.status(405).json({ error: "Method not allowed" });

  const user = await requireAdmin(req, res);
  if (!user) return;

  const { token } = req.query;
  const { status } = req.body;
  if (!token || !status) return res.status(400).json({ error: "token and status required" });

  try {
    const msToken = await getMicrosoftToken();

    const filter = `fields/Token eq '${token.replace(/'/g, "''")}'`;
    const listUrl = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${EXPENSES_LIST_ID}/items?$expand=fields&$filter=${encodeURIComponent(filter)}&$top=100`;
    const listRes = await fetch(listUrl, {
      headers: {
        Authorization: `Bearer ${msToken}`,
        Prefer: "HonorNonIndexedQueriesWarningMayFailRandomly",
      },
    });
    if (!listRes.ok) throw new Error(await listRes.text());
    const { value } = await listRes.json();
    if (!value || value.length === 0) return res.status(404).json({ error: "Report not found" });

    await Promise.all(
      value.map((item) =>
        fetch(
          `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${EXPENSES_LIST_ID}/items/${item.id}/fields`,
          {
            method: "PATCH",
            headers: { Authorization: `Bearer ${msToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ Status: status }),
          }
        )
      )
    );

    if (status === "Paid") {
      const f = value[0].fields;
      const lineItems = value.map((i) => ({
        category:    i.fields.Category    || "",
        expenseDate: i.fields.ExpenseDate || "",
        amount:      i.fields.Amount      || 0,
      }));
      const totalAmount = lineItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

      sendMail(msToken, {
        to: f.SubmitterEmail,
        subject: `Your Expense Has Been Approved – $${totalAmount.toFixed(2)} (${f.Company || ""})`,
        html: paidNotificationHtml({
          submitterName: f.SubmitterName || "there",
          company:       f.Company       || "",
          lineItems,
          totalAmount,
        }),
      }).catch((e) => console.error("Paid email error:", e.message));
    }

    res.json({ success: true, updated: value.length });
  } catch (e) {
    console.error("Report update error:", e.message);
    res.status(500).json({ error: e.message });
  }
}
