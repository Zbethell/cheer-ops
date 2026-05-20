import { useState, useEffect } from "react";

const STATUS_COLORS = {
  Pending: { color: "#92400e", bg: "#fef3c7", border: "#fde68a" },
  Paid:    { color: "#065f46", bg: "#d1fae5", border: "#6ee7b7" },
};

export default function ExpenseStatus() {
  const [expense, setExpense] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const token = new URLSearchParams(window.location.search).get("token");

  useEffect(() => {
    if (!token) {
      setError("No expense token found in this URL.");
      setLoading(false);
      return;
    }
    fetch(`/api/expense-status?token=${encodeURIComponent(token)}`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, data: d })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error || "Expense not found");
        setExpense(data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const statusStyle = expense ? (STATUS_COLORS[expense.status] || STATUS_COLORS.Pending) : {};

  return (
    <div style={{ fontFamily: "'DM Sans','Segoe UI',sans-serif", minHeight: "100vh", background: "#f8f9fb", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; }`}</style>

      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: "40px 32px", maxWidth: 480, width: "100%" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1a1a2e", marginBottom: 4 }}>Expense Status</h1>
        <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 28 }}>Track your reimbursement request</p>

        {loading && (
          <div style={{ textAlign: "center", color: "#9ca3af", padding: "32px 0" }}>Loading…</div>
        )}

        {error && !loading && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "14px 16px", color: "#dc2626", fontSize: 14 }}>
            {error}
          </div>
        )}

        {expense && !loading && (
          <>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: statusStyle.bg, border: `1px solid ${statusStyle.border}`,
              borderRadius: 99, padding: "6px 16px", marginBottom: 24,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusStyle.color, display: "inline-block" }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: statusStyle.color }}>
                {expense.status === "Paid" ? "Reimbursed" : "Pending Review"}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {[
                ["Submitted by", expense.submitterName],
                ["Amount", `$${parseFloat(expense.amount).toFixed(2)}`],
                ["Category", expense.category],
                ["Expense Date", expense.expenseDate ? new Date(expense.expenseDate + "T00:00:00").toLocaleDateString("en-CA") : "—"],
                ["Submitted On", expense.submittedAt ? new Date(expense.submittedAt).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" }) : "—"],
              ].map(([label, value]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #f3f4f6" }}>
                  <span style={{ fontSize: 14, color: "#6b7280" }}>{label}</span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: "#1a1a2e" }}>{value}</span>
                </div>
              ))}
              {expense.description && (
                <div style={{ padding: "12px 0", borderBottom: "1px solid #f3f4f6" }}>
                  <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 4 }}>Description</div>
                  <div style={{ fontSize: 14, color: "#1a1a2e" }}>{expense.description}</div>
                </div>
              )}
              {expense.receiptURL && (
                <div style={{ padding: "12px 0" }}>
                  <a href={expense.receiptURL} target="_blank" rel="noreferrer" style={{ fontSize: 14, color: "#2563eb", textDecoration: "none", fontWeight: 500 }}>
                    View Receipt →
                  </a>
                </div>
              )}
            </div>

            {expense.status === "Pending" && (
              <p style={{ marginTop: 20, fontSize: 13, color: "#9ca3af", textAlign: "center" }}>
                Bookmark this page to check back on your reimbursement status.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
