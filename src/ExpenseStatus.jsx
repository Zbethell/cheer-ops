import { useState, useEffect } from "react";

const STATUS_COLORS = {
  Pending: { color: "#92400e", bg: "#fef3c7", border: "#fde68a" },
  Paid:    { color: "#065f46", bg: "#d1fae5", border: "#6ee7b7" },
};

export default function ExpenseStatus() {
  const [report, setReport] = useState(null);
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
        setReport(data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const statusStyle = report ? (STATUS_COLORS[report.status] || STATUS_COLORS.Pending) : {};

  return (
    <div style={{ fontFamily: "'DM Sans','Segoe UI',sans-serif", minHeight: "100vh", background: "#f8f9fb", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; }`}</style>

      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: "40px 32px", maxWidth: 520, width: "100%" }}>
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

        {report && !loading && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: statusStyle.bg, border: `1px solid ${statusStyle.border}`,
                borderRadius: 99, padding: "6px 16px",
              }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusStyle.color, display: "inline-block" }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: statusStyle.color }}>
                  {report.status === "Paid" ? "Reimbursed" : "Pending Review"}
                </span>
              </div>
              {report.company && (
                <span style={{ fontSize: 13, color: "#6d28d9", background: "#ede9fe", border: "1px solid #c4b5fd", borderRadius: 99, padding: "4px 12px", fontWeight: 500 }}>
                  {report.company}
                </span>
              )}
            </div>

            {/* Report summary */}
            <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 20 }}>
              {[
                ["Submitted by", report.submitterName],
                ["Submitted on", report.submittedAt ? new Date(report.submittedAt).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" }) : "—"],
              ].map(([label, value]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #f3f4f6" }}>
                  <span style={{ fontSize: 14, color: "#6b7280" }}>{label}</span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: "#1a1a2e" }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Line items */}
            <div style={{ background: "#f8f9fb", borderRadius: 10, overflow: "hidden", border: "1px solid #e5e7eb", marginBottom: 16 }}>
              <div style={{ padding: "10px 16px", display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, borderBottom: "1px solid #e5e7eb" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Category</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Date</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right" }}>Amount</span>
              </div>
              {report.lineItems.map((item, i) => (
                <div
                  key={item.id}
                  style={{ padding: "12px 16px", borderBottom: i < report.lineItems.length - 1 ? "1px solid #e5e7eb" : "none" }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, alignItems: "start" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: "#1a1a2e" }}>{item.category}</div>
                      {item.description && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{item.description}</div>}
                      {item.totalKMs != null && (
                        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                          🚗 {item.startLocation} → {item.endLocation} ({item.totalKMs} km)
                        </div>
                      )}
                      {item.merchantName && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>🏪 {item.merchantName}</div>}
                    </div>
                    <span style={{ fontSize: 13, color: "#6b7280", whiteSpace: "nowrap" }}>
                      {item.expenseDate ? new Date(item.expenseDate + "T00:00:00").toLocaleDateString("en-CA") : "—"}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#1a1a2e", textAlign: "right", whiteSpace: "nowrap" }}>
                      ${parseFloat(item.amount).toFixed(2)}
                    </span>
                  </div>
                  {item.receiptURL && (
                    <div style={{ marginTop: 6 }}>
                      <a href={item.receiptURL} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#2563eb", textDecoration: "none", fontWeight: 500 }}>
                        View Receipt →
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Total */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderTop: "2px solid #1a1a2e" }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#1a1a2e" }}>Total</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: "#1a1a2e" }}>${parseFloat(report.totalAmount).toFixed(2)}</span>
            </div>

            {report.status === "Pending" && (
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
