import { useState, useEffect } from "react";

const SUPABASE_URL = "https://peylonukcwsqdknchxda.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBleWxvbnVrY3dzcWRrbmNoeGRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MDQxOTYsImV4cCI6MjA5MzQ4MDE5Nn0.fTgnQxWxBDcHk0Xq-4KQJZH9xi4bYwle27tdrjseQ3k";
const ORG_LOGO_URL = `${SUPABASE_URL}/storage/v1/object/public/logos/org-logo.png`;

const sb = async (path, options = {}) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": options.prefer || "return=representation",
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) { const err = await res.text(); throw new Error(err); }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
};

const api = {
  getActiveEvents: () => sb("events?status=eq.active&order=date"),
  getAreas: () => sb("areas?order=sort_order"),
  getAreaItems: (areaId) => sb(`area_items?area_id=eq.${areaId}`),
  getItems: () => sb("items?order=name"),
  submitReport: (report) => sb("event_reports", { method: "POST", body: JSON.stringify(report) }),
  submitReportItems: (items) => sb("report_items", { method: "POST", body: JSON.stringify(items) }),
  updateItemQty: (id, qty) => sb(`items?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ qty }) }),
};

const inputStyle = { padding: "12px 14px", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 16, width: "100%", background: "#fff", outline: "none", fontFamily: "inherit", WebkitAppearance: "none" };
const primaryBtn = { background: "#1a1a2e", color: "#fff", border: "none", padding: "14px 20px", borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", width: "100%", textAlign: "center" };
const ghostBtn = { background: "none", border: "1px solid #e5e7eb", padding: "12px 20px", borderRadius: 10, fontSize: 15, color: "#374151", cursor: "pointer", fontFamily: "inherit", width: "100%", textAlign: "center" };

export default function Report() {
  const [step, setStep] = useState("loading"); // loading | setup | area | items | review | submitted
  const [orgLogo, setOrgLogo] = useState(null);
  const [events, setEvents] = useState([]);
  const [areas, setAreas] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [areaItems, setAreaItems] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedArea, setSelectedArea] = useState(null);
  const [staffName, setStaffName] = useState("");
  const [responses, setResponses] = useState({}); // item_id -> { qty_used, qty_remaining, had_issue, issue_notes }
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [generalNotes, setGeneralNotes] = useState("");

  useEffect(() => {
    (async () => {
      // Load org logo
      try {
        const logoRes = await fetch(ORG_LOGO_URL, { method: "HEAD" });
        if (logoRes.ok) setOrgLogo(ORG_LOGO_URL + "?t=" + Date.now());
      } catch {}
      // Load events, areas, items
      try {
        const [ev, ar, it] = await Promise.all([api.getActiveEvents(), api.getAreas(), api.getItems()]);
        const allEvents = ev.length > 0 ? ev : await sb("events?order=date&status=eq.upcoming");
        setEvents(allEvents);
        setAreas(ar);
        setAllItems(it);
        setStep(allEvents.length === 0 ? "no-events" : "setup");
      } catch { setStep("error"); }
    })();
  }, []);

  const selectArea = async (area) => {
    setSelectedArea(area);
    try {
      const ai = await api.getAreaItems(area.id);
      setAreaItems(ai);
      // Init responses for each area item
      const init = {};
      ai.forEach(ai => {
        init[ai.item_id] = { qty_used: 0, qty_remaining: "", had_issue: false, issue_notes: "" };
      });
      setResponses(init);
      setStep("items");
    } catch { setError("Error loading area items"); }
  };

  const updateResponse = (itemId, field, value) => {
    setResponses(prev => ({ ...prev, [itemId]: { ...prev[itemId], [field]: value } }));
  };

  const submit = async () => {
    if (!staffName.trim()) { setError("Please enter your name"); return; }
    setSubmitting(true);
    setError("");
    try {
      // Create report
      const report = await api.submitReport({
        event_id: selectedEvent.id,
        area_id: selectedArea.id,
        staff_name: staffName.trim(),
        notes: generalNotes,
      });
      const reportId = report[0].id;

      // Create report items
      const items = areaItems.map(ai => ({
        report_id: reportId,
        item_id: ai.item_id,
        qty_used: responses[ai.item_id]?.qty_used || 0,
        qty_remaining: responses[ai.item_id]?.qty_remaining !== "" ? Number(responses[ai.item_id]?.qty_remaining) : null,
        had_issue: responses[ai.item_id]?.had_issue || false,
        issue_notes: responses[ai.item_id]?.issue_notes || "",
      }));

      if (items.length > 0) await api.submitReportItems(items);

      // Auto-deduct consumables
      for (const ai of areaItems) {
        if (ai.is_consumable) {
          const item = allItems.find(i => i.id === ai.item_id);
          const used = responses[ai.item_id]?.qty_used || 0;
          if (item && used > 0) {
            const newQty = Math.max(0, item.qty - used);
            await api.updateItemQty(item.id, newQty);
          }
        }
      }

      setStep("submitted");
    } catch (e) { setError("Error submitting — please try again"); }
    setSubmitting(false);
  };

  const itemsForArea = areaItems.map(ai => ({
    ...ai,
    item: allItems.find(i => i.id === ai.item_id),
  })).filter(ai => ai.item);

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif", minHeight: "100vh", background: "#f8f9fb", color: "#1a1a2e" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
        button { cursor: pointer; font-family: inherit; }
        input, select, textarea { font-family: inherit; }
      `}</style>

      {/* Header */}
      <div style={{ background: "#1a1a2e", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        {orgLogo
          ? <img src={orgLogo} alt="logo" style={{ height: 34, width: "auto", objectFit: "contain" }} />
          : <div style={{ color: "#fff", fontWeight: 600, fontSize: 17 }}>⭐ Cheer Ops</div>
        }
        <div style={{ color: "#9ca3af", fontSize: 13 }}>Event Report</div>
      </div>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "24px 20px 60px" }}>

        {/* Loading */}
        {step === "loading" && (
          <div style={{ textAlign: "center", color: "#6b7280", padding: 60 }}>Loading...</div>
        )}

        {/* Error */}
        {step === "error" && (
          <div style={{ textAlign: "center", color: "#dc2626", padding: 60 }}>Could not connect. Please check your connection and try again.</div>
        )}

        {/* No events */}
        {step === "no-events" && (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📅</div>
            <div style={{ fontWeight: 600, fontSize: 17, marginBottom: 8 }}>No Active Events</div>
            <div style={{ color: "#6b7280", fontSize: 14 }}>There are no active events right now. Check back closer to the event.</div>
          </div>
        )}

        {/* Step 1 — Name + Event */}
        {step === "setup" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 20, marginBottom: 6 }}>Hello! 👋</div>
              <div style={{ color: "#6b7280", fontSize: 15 }}>Let's fill out your post-event report. This only takes a few minutes.</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 14, fontWeight: 500 }}>Your Name</label>
              <input value={staffName} onChange={e => setStaffName(e.target.value)} style={inputStyle} placeholder="Enter your full name" autoFocus />
            </div>

            {events.length > 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={{ fontSize: 14, fontWeight: 500 }}>Which Event?</label>
                <select value={selectedEvent?.id || ""} onChange={e => setSelectedEvent(events.find(ev => ev.id === e.target.value))} style={inputStyle}>
                  <option value="">Select event...</option>
                  {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                </select>
              </div>
            )}

            {events.length === 1 && !selectedEvent && (() => { setTimeout(() => setSelectedEvent(events[0]), 0); return null; })()}

            {error && <div style={{ color: "#dc2626", fontSize: 14, padding: "10px 14px", background: "#fef2f2", borderRadius: 8 }}>{error}</div>}

            <button style={primaryBtn} onClick={() => {
              if (!staffName.trim()) { setError("Please enter your name"); return; }
              if (!selectedEvent) { setError("Please select an event"); return; }
              setError(""); setStep("area");
            }}>Continue →</button>
          </div>
        )}

        {/* Step 2 — Select Area */}
        {step === "area" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 20, marginBottom: 6 }}>Hi {staffName}! 👋</div>
              <div style={{ color: "#6b7280", fontSize: 15 }}>Which area were you working at <strong>{selectedEvent?.name}</strong>?</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {areas.map(area => (
                <button key={area.id} onClick={() => selectArea(area)}
                  style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "16px 18px", textAlign: "left", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>{area.name}</div>
                  {area.description && <div style={{ fontSize: 13, color: "#6b7280", marginTop: 3 }}>{area.description}</div>}
                </button>
              ))}
            </div>

            <button style={ghostBtn} onClick={() => setStep("setup")}>← Back</button>
          </div>
        )}

        {/* Step 3 — Item Questions */}
        {step === "items" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>{selectedEvent?.name} · {selectedArea?.name}</div>
              <div style={{ fontWeight: 600, fontSize: 20, marginBottom: 6 }}>Items Used</div>
              <div style={{ color: "#6b7280", fontSize: 15 }}>
                {itemsForArea.length > 0
                  ? "Please fill in details for each item in your area."
                  : "No items have been assigned to this area yet."}
              </div>
            </div>

            {itemsForArea.length === 0 && (
              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20 }}>
                <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 8 }}>No items assigned to this area yet</div>
                <div style={{ fontSize: 13, color: "#6b7280" }}>Use the notes section below to record anything from your area.</div>
              </div>
            )}

            {itemsForArea.map(ai => {
              const resp = responses[ai.item_id] || {};
              return (
                <div key={ai.item_id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 18 }}>
                  <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{ai.item.name}</div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                    {ai.is_consumable && <span style={{ background: "#fef3c7", color: "#d97706", padding: "2px 10px", borderRadius: 99, fontSize: 12, fontWeight: 500 }}>Consumable</span>}
                    {!ai.is_consumable && <span style={{ background: "#f3f4f6", color: "#6b7280", padding: "2px 10px", borderRadius: 99, fontSize: 12, fontWeight: 500 }}>Equipment</span>}
                  </div>

                  {ai.is_consumable && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
                      <div>
                        <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>How many did you use?</label>
                        <input type="number" min={0} value={resp.qty_used || 0}
                          onChange={e => updateResponse(ai.item_id, "qty_used", Number(e.target.value))}
                          style={{ ...inputStyle, fontSize: 15 }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>How many are left? (optional)</label>
                        <input type="number" min={0} value={resp.qty_remaining}
                          onChange={e => updateResponse(ai.item_id, "qty_remaining", e.target.value)}
                          style={{ ...inputStyle, fontSize: 15 }} placeholder="Leave blank if unsure" />
                      </div>
                    </div>
                  )}

                  <div>
                    <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 10 }}>Any issues with this item?</label>
                    <div style={{ display: "flex", gap: 10, marginBottom: resp.had_issue ? 12 : 0 }}>
                      <button onClick={() => updateResponse(ai.item_id, "had_issue", false)}
                        style={{ flex: 1, padding: "10px", borderRadius: 8, border: `1px solid ${!resp.had_issue ? "#1a1a2e" : "#e5e7eb"}`, background: !resp.had_issue ? "#1a1a2e" : "#fff", color: !resp.had_issue ? "#fff" : "#374151", fontSize: 14, fontFamily: "inherit", cursor: "pointer", fontWeight: 500 }}>
                        ✓ No Issues
                      </button>
                      <button onClick={() => updateResponse(ai.item_id, "had_issue", true)}
                        style={{ flex: 1, padding: "10px", borderRadius: 8, border: `1px solid ${resp.had_issue ? "#dc2626" : "#e5e7eb"}`, background: resp.had_issue ? "#fef2f2" : "#fff", color: resp.had_issue ? "#dc2626" : "#374151", fontSize: 14, fontFamily: "inherit", cursor: "pointer", fontWeight: 500 }}>
                        ⚠ Issue
                      </button>
                    </div>
                    {resp.had_issue && (
                      <textarea value={resp.issue_notes}
                        onChange={e => updateResponse(ai.item_id, "issue_notes", e.target.value)}
                        style={{ ...inputStyle, height: 80, resize: "none", marginTop: 4 }}
                        placeholder="Describe the issue..." />
                    )}
                  </div>
                </div>
              );
            })}

            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 18 }}>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Additional Notes</div>
              <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>Anything else from your area not related to specific items — incidents, observations, feedback, etc.</div>
              <textarea value={generalNotes} onChange={e => setGeneralNotes(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 15, fontFamily: "inherit", resize: "none", height: 100, outline: "none" }}
                placeholder="Optional..." />
            </div>

            {error && <div style={{ color: "#dc2626", fontSize: 14, padding: "10px 14px", background: "#fef2f2", borderRadius: 8 }}>{error}</div>}

            <button style={primaryBtn} onClick={() => setStep("review")}>Review & Submit →</button>
            <button style={ghostBtn} onClick={() => setStep("area")}>← Back</button>
          </div>
        )}

        {/* Step 4 — Review */}
        {step === "review" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 20, marginBottom: 6 }}>Review Your Report</div>
              <div style={{ color: "#6b7280", fontSize: 15 }}>Check everything looks right before submitting.</div>
            </div>

            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 8, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>Summary</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                  <span style={{ color: "#6b7280" }}>Staff</span>
                  <span style={{ fontWeight: 500 }}>{staffName}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                  <span style={{ color: "#6b7280" }}>Event</span>
                  <span style={{ fontWeight: 500 }}>{selectedEvent?.name}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                  <span style={{ color: "#6b7280" }}>Area</span>
                  <span style={{ fontWeight: 500 }}>{selectedArea?.name}</span>
                </div>
              </div>
            </div>

            {itemsForArea.length > 0 && (
              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid #f3f4f6", fontSize: 13, fontWeight: 600, color: "#374151" }}>Items</div>
                {itemsForArea.map((ai, i) => {
                  const resp = responses[ai.item_id] || {};
                  return (
                    <div key={ai.item_id} style={{ padding: "12px 16px", borderBottom: i < itemsForArea.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                      <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 4 }}>{ai.item.name}</div>
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 13, color: "#6b7280" }}>
                        {ai.is_consumable && <span>Used: <strong>{resp.qty_used || 0}</strong></span>}
                        {ai.is_consumable && resp.qty_remaining !== "" && resp.qty_remaining !== undefined && <span>Remaining: <strong>{resp.qty_remaining}</strong></span>}
                        {resp.had_issue
                          ? <span style={{ color: "#dc2626" }}>⚠ Issue reported</span>
                          : <span style={{ color: "#059669" }}>✓ No issues</span>
                        }
                      </div>
                      {resp.had_issue && resp.issue_notes && <div style={{ fontSize: 13, color: "#dc2626", marginTop: 4, fontStyle: "italic" }}>"{resp.issue_notes}"</div>}
                    </div>
                  );
                })}
              </div>
            )}

            {generalNotes.trim() && (
              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 8, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>Additional Notes</div>
                <div style={{ fontSize: 14, color: "#374151", whiteSpace: "pre-wrap" }}>{generalNotes}</div>
              </div>
            )}

            {error && <div style={{ color: "#dc2626", fontSize: 14, padding: "10px 14px", background: "#fef2f2", borderRadius: 8 }}>{error}</div>}

            <button style={{ ...primaryBtn, opacity: submitting ? 0.6 : 1 }} onClick={submit} disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Report ✓"}
            </button>
            <button style={ghostBtn} onClick={() => setStep("items")}>← Back</button>
          </div>
        )}

        {/* Submitted */}
        {step === "submitted" && (
          <div style={{ textAlign: "center", padding: "60px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#ecfdf5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 }}>✓</div>
            <div style={{ fontWeight: 700, fontSize: 22 }}>Report Submitted!</div>
            <div style={{ color: "#6b7280", fontSize: 15, maxWidth: 340 }}>
              Thank you {staffName}! Your report for <strong>{selectedArea?.name}</strong> has been received.
            </div>
            <button style={{ ...primaryBtn, marginTop: 16 }} onClick={() => {
              setStep("setup"); setStaffName(""); setSelectedArea(null);
              setSelectedEvent(null); setResponses({}); setAreaItems([]); setGeneralNotes("");
            }}>Submit Another Report</button>
          </div>
        )}

      </div>
    </div>
  );
}
