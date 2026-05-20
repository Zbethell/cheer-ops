import { useState, useEffect, useRef, useCallback } from "react";

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

const primaryBtn = {
  background: "#1a1a2e", color: "#fff", border: "none", borderRadius: 8,
  padding: "12px 24px", fontSize: 15, fontWeight: 600, cursor: "pointer",
  fontFamily: "inherit", width: "100%",
};

const inputStyle = {
  width: "100%", padding: "10px 12px", border: "1px solid #d1d5db",
  borderRadius: 8, fontSize: 15, fontFamily: "inherit", color: "#1a1a2e",
  background: "#fff", boxSizing: "border-box",
};

const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 };

function Field({ label, required, hint, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={labelStyle}>
        {label}{required && <span style={{ color: "#ef4444" }}> *</span>}
      </label>
      {children}
      {hint && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 5 }}>{hint}</div>}
    </div>
  );
}

function AddressAutocomplete({ label, required, value, onSelect, placeholder }) {
  const [query, setQuery] = useState(value?.address || "");
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (!containerRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleChange(e) {
    const q = e.target.value;
    setQuery(q);
    onSelect(null);
    clearTimeout(debounceRef.current);
    if (q.length < 3) { setSuggestions([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(`/api/maps/search?q=${encodeURIComponent(q)}`);
        const data = await r.json();
        setSuggestions(data);
        setOpen(data.length > 0);
      } catch {}
      setSearching(false);
    }, 350);
  }

  function handleSelect(s) {
    setQuery(s.address);
    setSuggestions([]);
    setOpen(false);
    onSelect(s);
  }

  const confirmed = !!value;

  return (
    <Field label={label} required={required}>
      <div ref={containerRef} style={{ position: "relative" }}>
        <input
          style={{
            ...inputStyle,
            borderColor: confirmed ? "#1a1a2e" : "#d1d5db",
            paddingRight: searching ? 36 : 12,
          }}
          value={query}
          onChange={handleChange}
          placeholder={placeholder || "Start typing an address…"}
          autoComplete="off"
        />
        {searching && (
          <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#9ca3af" }}>…</div>
        )}
        {confirmed && !searching && (
          <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#059669", fontSize: 14 }}>✓</div>
        )}
        {open && suggestions.length > 0 && (
          <div style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 100,
            background: "#fff", border: "1px solid #d1d5db", borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.1)", overflow: "hidden",
          }}>
            {suggestions.map((s, i) => (
              <div
                key={i}
                onMouseDown={() => handleSelect(s)}
                style={{
                  padding: "10px 14px", cursor: "pointer", fontSize: 14, color: "#1a1a2e",
                  borderBottom: i < suggestions.length - 1 ? "1px solid #f3f4f6" : "none",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#f8f9fb"}
                onMouseLeave={(e) => e.currentTarget.style.background = "#fff"}
              >
                {s.address}
              </div>
            ))}
          </div>
        )}
      </div>
    </Field>
  );
}

export default function Expenses() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [form, setForm] = useState({
    name: "", email: "", amount: "", category: "", company: "", date: "", description: "",
  });
  const [fromPlace, setFromPlace] = useState(null);
  const [toPlace, setToPlace] = useState(null);
  const [totalKMs, setTotalKMs] = useState("");
  const [calculatingKMs, setCalculatingKMs] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [step, setStep] = useState("form");
  const [statusToken, setStatusToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    fetch("/api/expense-config")
      .then((r) => r.json())
      .then((c) => setConfig({ ...DEFAULT_CONFIG, ...c, labels: { ...DEFAULT_CONFIG.labels, ...(c.labels || {}) } }))
      .catch(() => {});
  }, []);

  // Auto-calculate KMs when both addresses are confirmed
  useEffect(() => {
    if (!fromPlace || !toPlace) return;
    setCalculatingKMs(true);
    fetch(`/api/maps/distance?fromLat=${fromPlace.lat}&fromLon=${fromPlace.lon}&toLat=${toPlace.lat}&toLon=${toPlace.lon}`)
      .then((r) => r.json())
      .then((data) => { if (data.km) setTotalKMs(String(data.km)); })
      .catch(() => {})
      .finally(() => setCalculatingKMs(false));
  }, [fromPlace, toPlace]);

  const isMileage = form.category === "Mileage";
  const mileageRate = config.mileageRate || 0.70;
  const calculatedAmount = isMileage && totalKMs
    ? (parseFloat(totalKMs) * mileageRate).toFixed(2)
    : null;

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setReceipt(file);
    const reader = new FileReader();
    reader.onload = (ev) => setReceiptPreview(ev.target.result);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!form.name.trim() || !form.email.trim() || !form.category || !form.company || !form.date) {
      setError("Please fill in all required fields.");
      return;
    }
    if (isMileage) {
      if (!fromPlace || !toPlace) { setError("Please select both start and end addresses from the suggestions."); return; }
      if (!totalKMs || parseFloat(totalKMs) <= 0) { setError("Please enter a valid KM amount."); return; }
    } else {
      if (!form.amount || isNaN(parseFloat(form.amount)) || parseFloat(form.amount) <= 0) {
        setError("Please enter a valid amount."); return;
      }
      if (!receipt) { setError("A receipt is required for this expense type."); return; }
    }

    setLoading(true);
    try {
      let receiptBase64 = null, receiptMimeType = null, receiptFileName = null;
      if (receipt) {
        receiptMimeType = receipt.type;
        receiptFileName = receipt.name;
        receiptBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target.result.split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(receipt);
        });
      }

      const finalAmount = isMileage ? parseFloat(calculatedAmount) : parseFloat(form.amount);

      const res = await fetch("/api/submit-expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submitterName:  form.name.trim(),
          submitterEmail: form.email.trim(),
          amount:         finalAmount,
          category:       form.category,
          company:        form.company,
          expenseDate:    form.date,
          description:    form.description.trim(),
          receiptBase64,
          receiptMimeType,
          receiptFileName,
          ...(isMileage && {
            startLocation: fromPlace.address,
            endLocation:   toPlace.address,
            totalKMs:      parseFloat(totalKMs),
            mileageRate,
          }),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");
      setStatusToken(data.token);
      setStep("success");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const statusUrl = `${window.location.origin}/expenses-status?token=${statusToken}`;

  if (step === "success") {
    return (
      <div style={{ fontFamily: "'DM Sans','Segoe UI',sans-serif", minHeight: "100vh", background: "#f8f9fb", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: "40px 32px", maxWidth: 480, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1a1a2e", margin: "0 0 8px" }}>Expense Submitted</h2>
          <p style={{ color: "#6b7280", fontSize: 15, margin: "0 0 28px" }}>
            Your expense report has been received. Bookmark the link below to check your reimbursement status.
          </p>
          <div style={{ background: "#f8f9fb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "12px 16px", marginBottom: 20, wordBreak: "break-all", fontSize: 13, color: "#374151" }}>
            {statusUrl}
          </div>
          <button onClick={() => navigator.clipboard.writeText(statusUrl)} style={{ ...primaryBtn, marginBottom: 12 }}>
            Copy Status Link
          </button>
          <button
            onClick={() => { setForm({ name: "", email: "", amount: "", category: "", company: "", date: "", description: "" }); setFromPlace(null); setToPlace(null); setTotalKMs(""); setReceipt(null); setReceiptPreview(null); setStep("form"); }}
            style={{ background: "none", border: "1px solid #d1d5db", borderRadius: 8, padding: "10px 24px", fontSize: 14, cursor: "pointer", fontFamily: "inherit", width: "100%", color: "#374151" }}
          >
            Submit Another Expense
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'DM Sans','Segoe UI',sans-serif", minHeight: "100vh", background: "#f8f9fb", padding: "32px 16px" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; }`}</style>

      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <div style={{ marginBottom: 28, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a1a2e", marginBottom: 6 }}>{config.formTitle}</h1>
          <p style={{ color: "#6b7280", fontSize: 15 }}>{config.formSubtitle}</p>
        </div>

        <form onSubmit={handleSubmit} style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: "28px 24px" }}>

          <Field label={config.labels.name} required>
            <input style={inputStyle} value={form.name} onChange={set("name")} placeholder="Full name" />
          </Field>

          <Field label={config.labels.email} required>
            <input style={inputStyle} type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label={config.labels.company} required>
              <select style={inputStyle} value={form.company} onChange={set("company")}>
                <option value="">Select…</option>
                {(config.expenseCompanies || []).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label={config.labels.date} required>
              <input style={inputStyle} type="date" value={form.date} onChange={set("date")} />
            </Field>
          </div>

          <Field label={config.labels.category} required>
            <select style={inputStyle} value={form.category} onChange={(e) => { set("category")(e); setFromPlace(null); setToPlace(null); setTotalKMs(""); }}>
              <option value="">Select a category…</option>
              {config.categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>

          {/* Mileage fields */}
          {isMileage && (
            <>
              <AddressAutocomplete
                label={config.labels.startLocation}
                required
                value={fromPlace}
                onSelect={setFromPlace}
                placeholder="Start typing a start address…"
              />
              <AddressAutocomplete
                label={config.labels.endLocation}
                required
                value={toPlace}
                onSelect={setToPlace}
                placeholder="Start typing an end address…"
              />
              <Field
                label={config.labels.totalKMs}
                required
                hint={calculatingKMs ? "Calculating route…" : `Rate: $${mileageRate.toFixed(2)}/km — auto-filled from addresses, adjust if needed`}
              >
                <input
                  style={{ ...inputStyle, background: calculatingKMs ? "#f8f9fb" : "#fff" }}
                  type="number" min="0.1" step="0.1"
                  value={totalKMs}
                  onChange={(e) => setTotalKMs(e.target.value)}
                  placeholder="0.0"
                />
              </Field>
              {calculatedAmount && (
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "12px 16px", marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 14, color: "#166534" }}>Calculated reimbursement</span>
                  <strong style={{ fontSize: 16, color: "#166534" }}>${calculatedAmount}</strong>
                </div>
              )}
            </>
          )}

          {/* Standard amount */}
          {!isMileage && form.category && (
            <Field label={config.labels.amount} required>
              <input style={inputStyle} type="number" min="0.01" step="0.01" value={form.amount} onChange={set("amount")} placeholder="0.00" />
            </Field>
          )}

          <Field label={config.labels.description}>
            <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={form.description} onChange={set("description")} placeholder="Brief description of the expense" />
          </Field>

          {/* Receipt — required unless mileage */}
          {!isMileage && form.category && (
            <Field label={config.labels.receipt} required>
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${receipt ? "#1a1a2e" : "#d1d5db"}`, borderRadius: 8,
                  padding: "20px 16px", textAlign: "center", cursor: "pointer",
                  background: "#fafafa", transition: "border-color 0.15s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = "#1a1a2e"}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = receipt ? "#1a1a2e" : "#d1d5db"}
              >
                {receiptPreview && receipt?.type?.startsWith("image/") ? (
                  <img src={receiptPreview} alt="Receipt preview" style={{ maxHeight: 200, maxWidth: "100%", borderRadius: 6, objectFit: "contain" }} />
                ) : receipt ? (
                  <div style={{ fontSize: 14, color: "#374151" }}>📄 {receipt.name}</div>
                ) : (
                  <>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>📎</div>
                    <div style={{ fontSize: 14, color: "#6b7280" }}>Click to attach a photo or PDF</div>
                  </>
                )}
              </div>
              {receipt && (
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, display: "flex", justifyContent: "space-between" }}>
                  <span>{receipt.name}</span>
                  <button type="button" onClick={() => { setReceipt(null); setReceiptPreview(null); }} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>Remove</button>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display: "none" }} onChange={handleFileChange} />
            </Field>
          )}

          {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", color: "#dc2626", fontSize: 14, marginBottom: 16 }}>{error}</div>}

          <button type="submit" style={primaryBtn} disabled={loading}>
            {loading ? "Submitting…" : "Submit Expense"}
          </button>
        </form>
      </div>
    </div>
  );
}
