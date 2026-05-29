import { useState, useEffect, useRef } from "react";

const SUPABASE_URL = "https://peylonukcwsqdknchxda.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBleWxvbnVrY3dzcWRrbmNoeGRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MDQxOTYsImV4cCI6MjA5MzQ4MDE5Nn0.fTgnQxWxBDcHk0Xq-4KQJZH9xi4bYwle27tdrjseQ3k";

const sbFetch = async (path) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  const text = await res.text();
  return text ? JSON.parse(text) : [];
};

const DEFAULT_CONFIG = {
  formTitle: "Expense Report",
  formSubtitle: "Submit your expenses for reimbursement. You'll receive a link to track their status.",
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

  return (
    <Field label={label} required={required}>
      <div ref={containerRef} style={{ position: "relative" }}>
        <input
          style={{ ...inputStyle, borderColor: value ? "#1a1a2e" : "#d1d5db", paddingRight: 36 }}
          value={query}
          onChange={handleChange}
          placeholder={placeholder || "Start typing an address…"}
          autoComplete="off"
        />
        {searching && (
          <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#9ca3af" }}>…</div>
        )}
        {value && !searching && (
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

function LineItemEditor({ item, index, total, config, onUpdate, onRemove }) {
  const [calculatingKMs, setCalculatingKMs] = useState(false);
  const fileRef = useRef(null);
  const isMileage = item.category === "Mileage";
  const mileageRate = config.mileageRate || 0.70;
  const calculatedAmount = isMileage && item.totalKMs
    ? (parseFloat(item.totalKMs) * mileageRate).toFixed(2)
    : null;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!item.fromPlace || !item.toPlace) return;
    const { lat: fLat, lon: fLon } = item.fromPlace;
    const { lat: tLat, lon: tLon } = item.toPlace;
    setCalculatingKMs(true);
    fetch(`/api/maps/distance?fromLat=${fLat}&fromLon=${fLon}&toLat=${tLat}&toLon=${tLon}`)
      .then((r) => r.json())
      .then((data) => { if (data.km) onUpdate({ totalKMs: String(data.km) }); })
      .catch(() => {})
      .finally(() => setCalculatingKMs(false));
  }, [item.fromPlace?.lat, item.fromPlace?.lon, item.toPlace?.lat, item.toPlace?.lon]);

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onUpdate({ receipt: file, receiptPreview: ev.target.result });
    reader.readAsDataURL(file);
  }

  return (
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "20px 20px 4px", marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#1a1a2e", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Expense #{index}
        </div>
        {total > 1 && (
          <button
            type="button"
            onClick={onRemove}
            style={{ background: "none", border: "1px solid #fecaca", borderRadius: 6, padding: "4px 10px", fontSize: 12, color: "#ef4444", cursor: "pointer", fontFamily: "inherit" }}
          >
            Remove
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Field label={config.labels.category} required>
          <select
            style={inputStyle}
            value={item.category}
            onChange={(e) => onUpdate({ category: e.target.value, fromPlace: null, toPlace: null, totalKMs: "" })}
          >
            <option value="">Select a category…</option>
            {config.categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label={config.labels.date} required>
          <input
            style={inputStyle}
            type="date"
            value={item.date}
            onChange={(e) => onUpdate({ date: e.target.value })}
          />
        </Field>
      </div>

      {isMileage && (
        <>
          <AddressAutocomplete
            label={config.labels.startLocation}
            required
            value={item.fromPlace}
            onSelect={(s) => onUpdate({ fromPlace: s })}
            placeholder="Start typing a start address…"
          />
          <AddressAutocomplete
            label={config.labels.endLocation}
            required
            value={item.toPlace}
            onSelect={(s) => onUpdate({ toPlace: s })}
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
              value={item.totalKMs}
              onChange={(e) => onUpdate({ totalKMs: e.target.value })}
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

      {!isMileage && item.category && (
        <Field label={config.labels.amount} required>
          <input
            style={inputStyle}
            type="number" min="0.01" step="0.01"
            value={item.amount}
            onChange={(e) => onUpdate({ amount: e.target.value })}
            placeholder="0.00"
          />
        </Field>
      )}

      <Field label={config.labels.description}>
        <textarea
          style={{ ...inputStyle, minHeight: 72, resize: "vertical" }}
          value={item.description}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="Brief description of the expense"
        />
      </Field>

      {!isMileage && item.category && (
        <Field label={config.labels.receipt} hint="Optional — attach a photo or PDF of your receipt">
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${item.receipt ? "#1a1a2e" : "#d1d5db"}`, borderRadius: 8,
              padding: "16px", textAlign: "center", cursor: "pointer",
              background: "#fafafa", transition: "border-color 0.15s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = "#1a1a2e"}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = item.receipt ? "#1a1a2e" : "#d1d5db"}
          >
            {item.receiptPreview && item.receipt?.type?.startsWith("image/") ? (
              <img src={item.receiptPreview} alt="Receipt preview" style={{ maxHeight: 160, maxWidth: "100%", borderRadius: 6, objectFit: "contain" }} />
            ) : item.receipt ? (
              <div style={{ fontSize: 14, color: "#374151" }}>📄 {item.receipt.name}</div>
            ) : (
              <>
                <div style={{ fontSize: 24, marginBottom: 6 }}>📎</div>
                <div style={{ fontSize: 13, color: "#6b7280" }}>Click to attach a photo or PDF</div>
              </>
            )}
          </div>
          {item.receipt && (
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, display: "flex", justifyContent: "space-between" }}>
              <span>{item.receipt.name}</span>
              <button type="button" onClick={() => onUpdate({ receipt: null, receiptPreview: null })} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>Remove</button>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display: "none" }} onChange={handleFileChange} />
        </Field>
      )}
    </div>
  );
}

function newItem() {
  return {
    id: crypto.randomUUID(),
    category: "", date: "", amount: "", description: "",
    fromPlace: null, toPlace: null, totalKMs: "",
    receipt: null, receiptPreview: null,
  };
}

export default function Expenses() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [reportForm, setReportForm] = useState({ name: "", email: "", company: "", eventId: "", approvedBy: "" });
  const [evoEvents, setEvoEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [lineItems, setLineItems] = useState([newItem()]);
  const [step, setStep] = useState("form");
  const [statusToken, setStatusToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/expense-config")
      .then((r) => r.json())
      .then((c) => setConfig({ ...DEFAULT_CONFIG, ...c, labels: { ...DEFAULT_CONFIG.labels, ...(c.labels || {}) } }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (reportForm.company !== "EVO") { setEvoEvents([]); return; }
    setLoadingEvents(true);
    sbFetch("events?status=eq.active&order=date")
      .then((evs) => evs.length > 0 ? evs : sbFetch("events?status=eq.upcoming&order=date"))
      .then(setEvoEvents)
      .catch(() => {})
      .finally(() => setLoadingEvents(false));
  }, [reportForm.company]);

  const setRF = (field) => (e) => setReportForm((f) => ({ ...f, [field]: e.target.value }));

  function addItem() {
    setLineItems((prev) => [...prev, newItem()]);
  }

  function removeItem(id) {
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  }

  function updateItem(id, changes) {
    setLineItems((prev) => prev.map((item) => item.id === id ? { ...item, ...changes } : item));
  }

  const mileageRate = config.mileageRate || 0.70;
  const reportTotal = lineItems.reduce((sum, item) => {
    if (item.category === "Mileage" && item.totalKMs) {
      return sum + parseFloat(item.totalKMs) * mileageRate;
    }
    return sum + (parseFloat(item.amount) || 0);
  }, 0);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!reportForm.name.trim() || !reportForm.email.trim() || !reportForm.company) {
      setError("Please fill in your name, email, and company."); return;
    }
    if (!reportForm.approvedBy) {
      setError("Please select who approved this expense report."); return;
    }
    if (reportForm.company === "EVO" && !reportForm.eventId) {
      setError("Please select an event for EVO expenses."); return;
    }

    for (let i = 0; i < lineItems.length; i++) {
      const item = lineItems[i];
      const n = i + 1;
      if (!item.category) { setError(`Expense #${n}: please select a category.`); return; }
      if (!item.date) { setError(`Expense #${n}: please select a date.`); return; }
      if (item.category === "Mileage") {
        if (!item.fromPlace || !item.toPlace) { setError(`Expense #${n}: please select both start and end addresses from the suggestions.`); return; }
        if (!item.totalKMs || parseFloat(item.totalKMs) <= 0) { setError(`Expense #${n}: please enter a valid KM amount.`); return; }
      } else {
        if (!item.amount || isNaN(parseFloat(item.amount)) || parseFloat(item.amount) <= 0) {
          setError(`Expense #${n}: please enter a valid amount.`); return;
        }
      }
    }

    setLoading(true);
    try {
      const processedItems = await Promise.all(
        lineItems.map(async (item) => {
          let receiptBase64 = null, receiptMimeType = null, receiptFileName = null;
          if (item.receipt) {
            receiptMimeType = item.receipt.type;
            receiptFileName = item.receipt.name;
            receiptBase64 = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = (ev) => resolve(ev.target.result.split(",")[1]);
              reader.onerror = reject;
              reader.readAsDataURL(item.receipt);
            });
          }
          const isMileage = item.category === "Mileage";
          const finalAmount = isMileage
            ? parseFloat((parseFloat(item.totalKMs) * mileageRate).toFixed(2))
            : parseFloat(item.amount);
          return {
            category:     item.category,
            expenseDate:  item.date,
            amount:       finalAmount,
            description:  item.description.trim(),
            receiptBase64, receiptMimeType, receiptFileName,
            ...(isMileage && {
              startLocation: item.fromPlace.address,
              endLocation:   item.toPlace.address,
              totalKMs:      parseFloat(item.totalKMs),
              mileageRate,
            }),
          };
        })
      );

      const selectedEvent = evoEvents.find((ev) => ev.id === reportForm.eventId);
      const res = await fetch("/api/submit-expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submitterName:  reportForm.name.trim(),
          submitterEmail: reportForm.email.trim(),
          company:        reportForm.company,
          approvedBy:     reportForm.approvedBy,
          lineItems:      processedItems,
          ...(selectedEvent && { eventId: selectedEvent.id, eventName: selectedEvent.name }),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");
      setStatusToken(data.token);
      setStep("success");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setReportForm({ name: "", email: "", company: "", eventId: "", approvedBy: "" });
    setLineItems([newItem()]);
    setStatusToken("");
    setError("");
    setStep("form");
  }

  const statusUrl = `${window.location.origin}/expenses-status?token=${statusToken}`;

  if (step === "success") {
    return (
      <div style={{ fontFamily: "'DM Sans','Segoe UI',sans-serif", minHeight: "100vh", background: "#f8f9fb", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: "40px 32px", maxWidth: 480, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1a1a2e", margin: "0 0 8px" }}>Expenses Submitted</h2>
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
            onClick={resetForm}
            style={{ background: "none", border: "1px solid #d1d5db", borderRadius: 8, padding: "10px 24px", fontSize: 14, cursor: "pointer", fontFamily: "inherit", width: "100%", color: "#374151" }}
          >
            Submit Another Expense Report
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'DM Sans','Segoe UI',sans-serif", minHeight: "100vh", background: "#f8f9fb", padding: "32px 16px" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; }`}</style>

      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ marginBottom: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a1a2e", marginBottom: 6 }}>{config.formTitle}</h1>
          <p style={{ color: "#6b7280", fontSize: 15 }}>{config.formSubtitle}</p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Report header — submitter info */}
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "20px 20px 4px", marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#1a1a2e", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>Your Information</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Field label={config.labels.name} required>
                <input style={inputStyle} value={reportForm.name} onChange={setRF("name")} placeholder="Full name" />
              </Field>
              <Field label={config.labels.company} required>
                <select
                  style={inputStyle}
                  value={reportForm.company}
                  onChange={(e) => setReportForm((f) => ({ ...f, company: e.target.value, eventId: "" }))}
                >
                  <option value="">Select…</option>
                  {(config.expenseCompanies || []).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>

            <Field label={config.labels.email} required>
              <input style={inputStyle} type="email" value={reportForm.email} onChange={setRF("email")} placeholder="you@example.com" />
            </Field>

            <Field label="Approved By" required>
              <select style={inputStyle} value={reportForm.approvedBy} onChange={setRF("approvedBy")}>
                <option value="">Select approver…</option>
                {["Doug", "Frank", "Steph", "Nic"].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>

            {reportForm.company === "EVO" && (
              <Field label="Event" required>
                <select
                  style={inputStyle}
                  value={reportForm.eventId}
                  onChange={setRF("eventId")}
                  disabled={loadingEvents}
                >
                  <option value="">Select an event…</option>
                  {evoEvents.map((ev) => (
                    <option key={ev.id} value={ev.id}>{ev.name}</option>
                  ))}
                </select>
              </Field>
            )}
          </div>

          {/* Line items */}
          {lineItems.map((item, i) => (
            <LineItemEditor
              key={item.id}
              item={item}
              index={i + 1}
              total={lineItems.length}
              config={config}
              onUpdate={(changes) => updateItem(item.id, changes)}
              onRemove={() => removeItem(item.id)}
            />
          ))}

          {/* Add item */}
          <button
            type="button"
            onClick={addItem}
            style={{
              width: "100%", padding: "12px", border: "2px dashed #d1d5db", borderRadius: 12,
              background: "none", fontSize: 14, color: "#6b7280", cursor: "pointer",
              fontFamily: "inherit", fontWeight: 500, marginBottom: 16,
              transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#1a1a2e"; e.currentTarget.style.color = "#1a1a2e"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#d1d5db"; e.currentTarget.style.color = "#6b7280"; }}
          >
            + Add Another Expense
          </button>

          {/* Total + submit */}
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "20px 20px 20px" }}>
            {reportTotal > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid #f3f4f6" }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: "#374151" }}>Report Total</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: "#1a1a2e" }}>${reportTotal.toFixed(2)}</span>
              </div>
            )}

            {error && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", color: "#dc2626", fontSize: 14, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <button type="submit" style={primaryBtn} disabled={loading}>
              {loading ? "Submitting…" : `Submit ${lineItems.length > 1 ? `${lineItems.length} Expenses` : "Expense"}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
