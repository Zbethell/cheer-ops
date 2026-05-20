import { getMicrosoftToken, requireAdmin, SHAREPOINT_DRIVE_ID } from "./_lib.js";

const DEFAULT_CONFIG = {
  formTitle: "Expense Report",
  formSubtitle: "Submit your expense for reimbursement. You'll receive a link to track its status.",
  categories: ["Meal", "Gas", "Office Supplies", "Mileage"],
  mileageRate: 0.70,
  expenseCompanies: ["Pro", "Pro Gym Services", "EVO"],
  labels: {
    name: "Your Name", email: "Email Address", amount: "Amount ($)",
    date: "Date of Expense", category: "Category", company: "Company",
    description: "Description", receipt: "Receipt Photo",
    startLocation: "Start Location", endLocation: "End Location", totalKMs: "Total KMs",
  },
};

export default async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const token = await getMicrosoftToken();
      const r = await fetch(
        `https://graph.microsoft.com/v1.0/drives/${SHAREPOINT_DRIVE_ID}/root:/expense-config.json:/content`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (r.status === 404) return res.json(DEFAULT_CONFIG);
      if (!r.ok) throw new Error(await r.text());
      const config = await r.json();
      res.json({ ...DEFAULT_CONFIG, ...config, labels: { ...DEFAULT_CONFIG.labels, ...(config.labels || {}) } });
    } catch (e) {
      console.error("Get config error:", e.message);
      res.json(DEFAULT_CONFIG);
    }
    return;
  }

  if (req.method === "POST") {
    const user = await requireAdmin(req, res);
    if (!user) return;
    try {
      const token = await getMicrosoftToken();
      const r = await fetch(
        `https://graph.microsoft.com/v1.0/drives/${SHAREPOINT_DRIVE_ID}/root:/expense-config.json:/content`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(req.body),
        }
      );
      if (!r.ok) throw new Error(await r.text());
      res.json({ success: true });
    } catch (e) {
      console.error("Save config error:", e.message);
      res.status(500).json({ error: e.message });
    }
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
