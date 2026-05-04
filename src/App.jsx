import { useState, useEffect, useCallback, useRef } from "react";

const SUPABASE_URL = "https://peylonukcwsqdknchxda.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBleWxvbnVrY3dzcWRrbmNoeGRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MDQxOTYsImV4cCI6MjA5MzQ4MDE5Nn0.fTgnQxWxBDcHk0Xq-4KQJZH9xi4bYwle27tdrjseQ3k";
const ORG_LOGO_PATH = "org-logo.png";
const ORG_LOGO_PUBLIC_URL = `${SUPABASE_URL}/storage/v1/object/public/logos/${ORG_LOGO_PATH}`;

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
  getItems: () => sb("items?order=category,name"),
  addItem: (item) => sb("items", { method: "POST", body: JSON.stringify(item) }),
  updateItem: (id, patch) => sb(`items?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteItem: (id) => sb(`items?id=eq.${id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }),
  getEvents: () => sb("events?order=date"),
  addEvent: (event) => sb("events", { method: "POST", body: JSON.stringify(event) }),
  updateEvent: (id, patch) => sb(`events?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteEvent: (id) => sb(`events?id=eq.${id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }),
  getAllPacking: () => sb("packing_list"),
  addPacking: (entry) => sb("packing_list", { method: "POST", body: JSON.stringify(entry) }),
  updatePacking: (id, patch) => sb(`packing_list?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deletePacking: (id) => sb(`packing_list?id=eq.${id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }),
  deletePackingByEvent: (eventId) => sb(`packing_list?event_id=eq.${eventId}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }),
  getCategories: () => sb("categories?order=sort_order,name"),
  addCategory: (cat) => sb("categories", { method: "POST", body: JSON.stringify(cat) }),
  updateCategory: (id, patch) => sb(`categories?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteCategory: (id) => sb(`categories?id=eq.${id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }),
  uploadLogo: async (file, path) => {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/logos/${path}`, {
      method: "POST",
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Content-Type": file.type, "x-upsert": "true" },
      body: file,
    });
    if (!res.ok) { const err = await res.text(); throw new Error(err); }
    return `${SUPABASE_URL}/storage/v1/object/public/logos/${path}`;
  },
};

async function checkOrgLogoExists() {
  try {
    const res = await fetch(`${ORG_LOGO_PUBLIC_URL}?t=${Date.now()}`, { method: "HEAD" });
    return res.ok ? `${ORG_LOGO_PUBLIC_URL}?t=${Date.now()}` : null;
  } catch { return null; }
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return isMobile;
}

const STATUS_CONFIG = {
  completed: { label: "Completed", color: "#6b7280", bg: "#f3f4f6" },
  active: { label: "Active", color: "#059669", bg: "#ecfdf5" },
  upcoming: { label: "Upcoming", color: "#2563eb", bg: "#eff6ff" },
};

function parseCSV(text, categories) {
  const lines = text.trim().split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/['"]/g, ""));
  const nameIdx = headers.findIndex(h => h.includes("name"));
  const catIdx = headers.findIndex(h => h.includes("cat"));
  const qtyIdx = headers.findIndex(h => h.includes("qty") || h.includes("quan"));
  const notesIdx = headers.findIndex(h => h.includes("note"));
  if (nameIdx === -1) return null;
  const defaultCat = categories[0] || "Other";
  return lines.slice(1).map(line => {
    const cols = line.split(",").map(c => c.trim().replace(/^["']|["']$/g, ""));
    return {
      name: cols[nameIdx] || "",
      category: catIdx >= 0 ? (cols[catIdx] || defaultCat) : defaultCat,
      qty: qtyIdx >= 0 ? (parseInt(cols[qtyIdx]) || 1) : 1,
      notes: notesIdx >= 0 ? (cols[notesIdx] || "") : "",
    };
  }).filter(r => r.name);
}

// ─── Shared UI ────────────────────────────────────────────────────────────────
function Checkmark() {
  return <svg width="11" height="11" viewBox="0 0 10 10" fill="none"><path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function Modal({ title, onClose, onSave, saveLabel, saving, children, wide, isMobile: m }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: m ? "flex-end" : "center", justifyContent: "center", zIndex: 500, padding: m ? 0 : 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#fff", borderRadius: m ? "16px 16px 0 0" : 10, border: m ? "none" : "1px solid #e5e7eb", width: "100%", maxWidth: wide ? 580 : 440, padding: m ? "20px 20px 32px" : 24, maxHeight: "90vh", overflowY: "auto" }}>
        {m && <div style={{ width: 36, height: 4, background: "#e5e7eb", borderRadius: 99, margin: "0 auto 18px" }} />}
        <div style={{ fontWeight: 600, fontSize: m ? 17 : 16, marginBottom: 20 }}>{title}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: m ? 14 : 12, marginBottom: 24 }}>{children}</div>
        <div style={{ display: "flex", gap: 10, justifyContent: m ? "stretch" : "flex-end" }}>
          <button style={{ ...ghostBtn, ...(m ? { flex: 1, padding: "12px", fontSize: 15 } : {}) }} onClick={onClose}>Cancel</button>
          <button style={{ ...primaryBtn, ...(m ? { flex: 2, padding: "12px", fontSize: 15 } : {}), opacity: saving ? 0.5 : 1 }} onClick={onSave} disabled={saving}>{saving ? "Saving..." : saveLabel}</button>
        </div>
      </div>
    </div>
  );
}

const labelStyle = { fontSize: 13, fontWeight: 500, color: "#374151" };
const inputStyle = { padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 14, width: "100%", background: "#fff", outline: "none", fontFamily: "inherit", WebkitAppearance: "none" };
const inputStyleMobile = { ...inputStyle, padding: "11px 14px", fontSize: 16, borderRadius: 10 };
const primaryBtn = { background: "#1a1a2e", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", textAlign: "center" };
const ghostBtn = { background: "none", border: "1px solid #e5e7eb", padding: "7px 14px", borderRadius: 7, fontSize: 13, color: "#374151", cursor: "pointer", fontFamily: "inherit", textAlign: "center" };
const dangerBtn = { background: "none", border: "1px solid #fca5a5", padding: "5px 10px", borderRadius: 6, fontSize: 12, color: "#dc2626", cursor: "pointer", fontFamily: "inherit" };

function LogoUpload({ value, onChange, label, size = 64, storageKey }) {
  const ref = useRef();
  const [uploading, setUploading] = useState(false);
  const handle = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = storageKey || `logo-${Date.now()}-${file.name}`;
      const url = await api.uploadLogo(file, path);
      onChange(url + "?t=" + Date.now());
    } catch (err) { alert("Upload failed: " + err.message); }
    setUploading(false);
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      {value
        ? <img src={value} alt="logo" style={{ width: size, height: size, objectFit: "contain", borderRadius: 8, border: "1px solid #e5e7eb", background: "#f9fafb", flexShrink: 0 }} />
        : <div style={{ width: size, height: size, borderRadius: 8, border: "2px dashed #d1d5db", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 11, textAlign: "center", flexShrink: 0 }}>No logo</div>
      }
      <div style={{ flex: 1 }}>
        {label && <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, color: "#374151" }}>{label}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ ...ghostBtn, opacity: uploading ? 0.5 : 1 }} onClick={() => ref.current.click()} type="button" disabled={uploading}>
            {uploading ? "Uploading..." : (value ? "Change" : "Upload")}
          </button>
          {value && !uploading && <button style={dangerBtn} onClick={() => onChange(null)} type="button">Remove</button>}
        </div>
        <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={handle} />
      </div>
    </div>
  );
}

// ─── Category Manager (used inside Settings) ──────────────────────────────────
function CategoryManager({ categories, setCategories, showToast, isMobile: m }) {
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);
  const iStyle = m ? inputStyleMobile : inputStyle;

  const add = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const created = await api.addCategory({ name: newName.trim(), sort_order: categories.length + 1 });
      setCategories(prev => [...prev, created[0]]);
      setNewName("");
      showToast("Category added");
    } catch { showToast("Error — name may already exist"); }
    setSaving(false);
  };

  const saveEdit = async (id) => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await api.updateCategory(id, { name: editName.trim() });
      setCategories(prev => prev.map(c => c.id === id ? { ...c, name: editName.trim() } : c));
      setEditId(null);
      showToast("Category updated");
    } catch { showToast("Error — name may already exist"); }
    setSaving(false);
  };

  const remove = async (id) => {
    setSaving(true);
    try {
      await api.deleteCategory(id);
      setCategories(prev => prev.filter(c => c.id !== id));
      showToast("Category removed");
    } catch { showToast("Error removing category"); }
    setSaving(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Manage Categories</div>

      {/* Existing categories */}
      <div className="card" style={{ overflow: "hidden" }}>
        {categories.map((cat, i) => (
          <div key={cat.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderBottom: i < categories.length - 1 ? "1px solid #f3f4f6" : "none" }}>
            {editId === cat.id ? (
              <>
                <input value={editName} onChange={e => setEditName(e.target.value)} style={{ ...iStyle, flex: 1 }}
                  onKeyDown={e => { if (e.key === "Enter") saveEdit(cat.id); if (e.key === "Escape") setEditId(null); }} autoFocus />
                <button style={{ ...primaryBtn, padding: "6px 12px", fontSize: 12, opacity: saving ? 0.5 : 1 }} onClick={() => saveEdit(cat.id)} disabled={saving}>Save</button>
                <button style={{ ...ghostBtn, padding: "6px 10px", fontSize: 12 }} onClick={() => setEditId(null)}>✕</button>
              </>
            ) : (
              <>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{cat.name}</span>
                <button style={{ ...ghostBtn, padding: "5px 10px", fontSize: 12 }} onClick={() => { setEditId(cat.id); setEditName(cat.name); }}>Rename</button>
                <button style={{ ...dangerBtn, padding: "5px 10px" }} onClick={() => remove(cat.id)}>Remove</button>
              </>
            )}
          </div>
        ))}
        {categories.length === 0 && <div style={{ padding: "16px", fontSize: 13, color: "#9ca3af", textAlign: "center" }}>No categories yet</div>}
      </div>

      {/* Add new */}
      <div style={{ display: "flex", gap: 8 }}>
        <input value={newName} onChange={e => setNewName(e.target.value)} style={{ ...iStyle, flex: 1 }} placeholder="New category name..."
          onKeyDown={e => e.key === "Enter" && add()} />
        <button style={{ ...primaryBtn, opacity: saving ? 0.5 : 1, whiteSpace: "nowrap" }} onClick={add} disabled={saving}>+ Add</button>
      </div>
      <p style={{ fontSize: 12, color: "#9ca3af" }}>Removing a category won't delete items in it — they'll still show under their old category name.</p>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const isMobile = useIsMobile();
  const [items, setItems] = useState([]);
  const [events, setEvents] = useState([]);
  const [packing, setPacking] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState("dashboard");
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [toast, setToast] = useState(null);
  const [orgLogo, setOrgLogo] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [pendingLogo, setPendingLogo] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [i, e, p, cats, logoUrl] = await Promise.all([
        api.getItems(), api.getEvents(), api.getAllPacking(), api.getCategories(), checkOrgLogoExists()
      ]);
      setItems(i); setEvents(e); setPacking(p);
      setCategories(cats);
      setOrgLogo(logoUrl); setError(null);
    } catch { setError("Could not connect to database."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const saveSettings = () => { setOrgLogo(pendingLogo); showToast("Settings saved"); setShowSettings(false); };

  const categoryNames = categories.map(c => c.name);

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "DM Sans, sans-serif", color: "#6b7280" }}>Loading Cheer Ops...</div>;
  if (error) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "DM Sans, sans-serif", gap: 16, padding: 24, textAlign: "center" }}>
      <div style={{ fontSize: 36 }}>⚠️</div>
      <div style={{ fontWeight: 600 }}>Connection Error</div>
      <div style={{ color: "#6b7280", fontSize: 14, maxWidth: 360 }}>{error}</div>
      <button style={{ ...primaryBtn, padding: "10px 24px" }} onClick={loadAll}>Retry</button>
    </div>
  );

  const selectedEvent = events.find(e => e.id === selectedEventId);
  const eventPacking = packing.filter(p => p.event_id === selectedEventId);
  const m = isMobile;

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif", minHeight: "100vh", background: "#f8f9fb", color: "#1a1a2e" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
        button { cursor: pointer; font-family: inherit; }
        input, select, textarea { font-family: inherit; }
        .card { background: #fff; border-radius: 12px; border: 1px solid #e5e7eb; }
        .pill { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 99px; font-size: 12px; font-weight: 500; }
        .toast { position: fixed; bottom: ${m ? "90px" : "24px"}; left: 50%; transform: translateX(-50%); background: #1a1a2e; color: #fff; padding: 10px 20px; border-radius: 8px; font-size: 14px; z-index: 1000; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
        .nav-btn { background: none; border: none; padding: 8px 14px; border-radius: 6px; font-size: 14px; font-weight: 500; color: #6b7280; transition: all 0.15s; cursor: pointer; }
        .nav-btn:hover { background: #f3f4f6; color: #111; }
        .nav-btn.active { background: #1a1a2e; color: #fff; }
        .tab-bar { position: fixed; bottom: 0; left: 0; right: 0; background: #fff; border-top: 1px solid #e5e7eb; display: flex; z-index: 100; padding-bottom: env(safe-area-inset-bottom); }
        .tab-btn { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 10px 4px; font-size: 11px; font-weight: 500; color: #9ca3af; background: none; border: none; gap: 3px; cursor: pointer; }
        .tab-btn.active { color: #1a1a2e; }
        .tab-icon { font-size: 22px; line-height: 1; }
        .check-box-mobile { width: 28px; height: 28px; border: 2px solid #d1d5db; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; flex-shrink: 0; }
        .check-box-mobile.checked { background: #1a1a2e; border-color: #1a1a2e; }
        .check-box-desktop { width: 18px; height: 18px; border: 2px solid #d1d5db; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; flex-shrink: 0; }
        .check-box-desktop.checked { background: #1a1a2e; border-color: #1a1a2e; }
        .settings-section { border-top: 1px solid #f3f4f6; padding-top: 20px; margin-top: 4px; }
      `}</style>

      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: m ? "0 16px" : "0 24px", display: "flex", alignItems: "center", gap: 8, height: m ? 52 : 56, position: "sticky", top: 0, zIndex: 50 }}>
        {orgLogo
          ? <img src={orgLogo} alt="logo" style={{ height: m ? 30 : 36, width: "auto", objectFit: "contain", marginRight: m ? 4 : 8 }} />
          : <span style={{ fontWeight: 600, fontSize: m ? 15 : 16, marginRight: 4, letterSpacing: "-0.3px" }}>⭐ Cheer Ops</span>
        }
        {!m && <>
          <button className={`nav-btn ${view === "dashboard" ? "active" : ""}`} onClick={() => setView("dashboard")}>Dashboard</button>
          <button className={`nav-btn ${view === "inventory" ? "active" : ""}`} onClick={() => setView("inventory")}>Inventory</button>
          <button className={`nav-btn ${["events", "event-detail"].includes(view) ? "active" : ""}`} onClick={() => setView("events")}>Events</button>
        </>}
        <div style={{ flex: 1 }} />
        <button style={{ background: "none", border: "none", fontSize: 20, padding: "8px", color: "#9ca3af", cursor: "pointer", lineHeight: 1 }} onClick={() => { setPendingLogo(orgLogo); setShowSettings(true); }}>⚙️</button>
      </div>

      {/* Page */}
      <div style={{ padding: m ? "16px 16px 90px" : "28px 24px", maxWidth: m ? "100%" : 960, margin: "0 auto" }}>
        {view === "dashboard" && <Dashboard isMobile={m} items={items} events={events} packing={packing} setView={setView} setSelectedEventId={setSelectedEventId} />}
        {view === "inventory" && <Inventory isMobile={m} items={items} setItems={setItems} categories={categoryNames} showToast={showToast} />}
        {view === "events" && <Events isMobile={m} events={events} setEvents={setEvents} packing={packing} setPacking={setPacking} setView={setView} setSelectedEventId={setSelectedEventId} showToast={showToast} />}
        {view === "event-detail" && selectedEvent && <EventDetail isMobile={m} event={selectedEvent} events={events} setEvents={setEvents} items={items} eventPacking={eventPacking} packing={packing} setPacking={setPacking} setView={setView} showToast={showToast} />}
      </div>

      {/* Mobile tab bar */}
      {m && (
        <nav className="tab-bar">
          <button className={`tab-btn ${view === "dashboard" ? "active" : ""}`} onClick={() => setView("dashboard")}><span className="tab-icon">🏠</span>Dashboard</button>
          <button className={`tab-btn ${view === "inventory" ? "active" : ""}`} onClick={() => setView("inventory")}><span className="tab-icon">📦</span>Inventory</button>
          <button className={`tab-btn ${["events", "event-detail"].includes(view) ? "active" : ""}`} onClick={() => setView("events")}><span className="tab-icon">📅</span>Events</button>
        </nav>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <Modal title="Settings" onClose={() => setShowSettings(false)} onSave={saveSettings} saveLabel="Done" saving={false} isMobile={m} wide>
          <LogoUpload value={pendingLogo} onChange={setPendingLogo} label="Organization Logo" size={56} storageKey={ORG_LOGO_PATH} />
          <p style={{ fontSize: 12, color: "#9ca3af", marginTop: -4 }}>Logo uploads to storage and appears for everyone on next page load.</p>
          <div className="settings-section">
            <CategoryManager categories={categories} setCategories={setCategories} showToast={showToast} isMobile={m} />
          </div>
        </Modal>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ isMobile: m, items, events, packing, setView, setSelectedEventId }) {
  const activeEvent = events.find(e => e.status === "active");
  const upcomingEvents = events.filter(e => e.status === "upcoming");
  const activePacking = activeEvent ? packing.filter(p => p.event_id === activeEvent.id) : [];
  const itemsOut = activePacking.filter(p => p.packed && !p.returned).length;
  const packingProgress = activePacking.length > 0 ? Math.round((activePacking.filter(p => p.packed).length / activePacking.length) * 100) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: m ? 14 : 20 }}>
      <div>
        <h1 style={{ fontSize: m ? 20 : 22, fontWeight: 600, marginBottom: 4 }}>Dashboard</h1>
        <p style={{ color: "#6b7280", fontSize: 14 }}>Your season at a glance</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: m ? 10 : 16 }}>
        {[
          { label: m ? "Items" : "Total Items", value: items.length, sub: "in master inventory" },
          { label: "Items Out", value: itemsOut, sub: activeEvent ? `at ${activeEvent.name}` : "no active event" },
          { label: "Events", value: events.length, sub: `${upcomingEvents.length} upcoming` },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: m ? "12px 12px" : "18px 20px" }}>
            <div style={{ fontSize: m ? 24 : 28, fontWeight: 600, letterSpacing: "-1px" }}>{s.value}</div>
            <div style={{ fontSize: m ? 12 : 13, fontWeight: 500, marginTop: 2 }}>{s.label}</div>
            {!m && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{s.sub}</div>}
          </div>
        ))}
      </div>
      {activeEvent && (
        <div className="card" style={{ padding: m ? 14 : 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
              {activeEvent.logo_url && <img src={activeEvent.logo_url} alt="" style={{ width: m ? 34 : 40, height: m ? 34 : 40, objectFit: "contain", borderRadius: 6, border: "1px solid #e5e7eb", flexShrink: 0 }} />}
              <div style={{ minWidth: 0 }}>
                <span className="pill" style={{ background: "#ecfdf5", color: "#059669", marginBottom: 4, display: "inline-flex" }}>● Active</span>
                <div style={{ fontWeight: 600, fontSize: m ? 15 : 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{activeEvent.name}</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>{activeEvent.location}{!m && activeEvent.date ? ` · ${activeEvent.date}` : ""}</div>
              </div>
            </div>
            {!m && <button style={primaryBtn} onClick={() => { setSelectedEventId(activeEvent.id); setView("event-detail"); }}>Open →</button>}
          </div>
          {packingProgress !== null && (
            <div style={{ marginBottom: m ? 12 : 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6b7280", marginBottom: 5 }}>
                <span>Packing progress</span>
                <span>{m ? `${packingProgress}%` : `${activePacking.filter(p => p.packed).length} / ${activePacking.length} packed`}</span>
              </div>
              <div style={{ background: "#f3f4f6", borderRadius: 99, height: 8, overflow: "hidden" }}>
                <div style={{ width: `${packingProgress}%`, background: "#1a1a2e", height: "100%", borderRadius: 99, transition: "width 0.3s" }} />
              </div>
            </div>
          )}
          {m && <button style={{ ...primaryBtn, width: "100%", padding: "12px", marginTop: 4 }} onClick={() => { setSelectedEventId(activeEvent.id); setView("event-detail"); }}>Open Packing List →</button>}
        </div>
      )}
      {upcomingEvents.length > 0 && (
        <div className="card" style={{ padding: m ? 0 : 20 }}>
          {m
            ? <div style={{ padding: "14px 16px 10px", fontWeight: 600, fontSize: 14, borderBottom: "1px solid #f3f4f6" }}>Upcoming Events</div>
            : <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 14 }}>Upcoming Events</div>
          }
          {upcomingEvents.map((e, i) => (
            <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: m ? "12px 16px" : "0 0 10px", marginBottom: !m && i < upcomingEvents.length - 1 ? 10 : 0, borderBottom: (m || i < upcomingEvents.length - 1) ? "1px solid #f3f4f6" : "none", cursor: m ? "pointer" : "default" }}
              onClick={m ? () => { setSelectedEventId(e.id); setView("event-detail"); } : undefined}>
              {e.logo_url && <img src={e.logo_url} alt="" style={{ width: 32, height: 32, objectFit: "contain", borderRadius: 5, border: "1px solid #e5e7eb", flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.name}</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>{e.location} · {e.date}</div>
              </div>
              {m ? <span style={{ color: "#9ca3af", fontSize: 18 }}>›</span>
                : <button style={ghostBtn} onClick={() => { setSelectedEventId(e.id); setView("event-detail"); }}>View Packing List</button>}
            </div>
          ))}
        </div>
      )}
      {events.length === 0 && <div className="card" style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>No events yet — go to Events to add your season schedule</div>}
    </div>
  );
}

// ─── Inventory ────────────────────────────────────────────────────────────────
function Inventory({ isMobile: m, items, setItems, categories, showToast }) {
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: "", category: categories[0] || "", qty: 1, notes: "" });
  const [saving, setSaving] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [csvPreview, setCsvPreview] = useState(null);
  const [csvError, setCsvError] = useState("");
  const [importing, setImporting] = useState(false);
  const fileRef = useRef();

  const filtered = items.filter(i => (filterCat === "All" || i.category === filterCat) && i.name.toLowerCase().includes(search.toLowerCase()));
  const openAdd = () => { setForm({ name: "", category: categories[0] || "", qty: 1, notes: "" }); setEditItem(null); setShowModal(true); };
  const openEdit = (item) => { setForm({ name: item.name, category: item.category, qty: item.qty, notes: item.notes || "" }); setEditItem(item); setShowModal(true); };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editItem) {
        await api.updateItem(editItem.id, form);
        setItems(prev => prev.map(i => i.id === editItem.id ? { ...i, ...form } : i));
        showToast("Item updated");
      } else {
        const created = await api.addItem(form);
        setItems(prev => [...prev, created[0]]);
        showToast("Item added");
      }
      setShowModal(false);
    } catch { showToast("Error saving"); }
    setSaving(false);
  };

  const remove = async (id) => {
    try { await api.deleteItem(id); setItems(prev => prev.filter(i => i.id !== id)); showToast("Item removed"); }
    catch { showToast("Error removing item"); }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text); previewCSV(text);
  };

  const previewCSV = (text) => {
    setCsvError("");
    const parsed = parseCSV(text, categories);
    if (parsed === null) { setCsvError('Could not find a "name" column.'); setCsvPreview(null); return; }
    if (parsed.length === 0) { setCsvError("No rows found."); setCsvPreview(null); return; }
    setCsvPreview(parsed);
  };

  const runImport = async () => {
    if (!csvPreview?.length) return;
    setImporting(true);
    try {
      const created = await Promise.all(csvPreview.map(item => api.addItem(item)));
      setItems(prev => [...prev, ...created.map(r => r[0])]);
      showToast(`Imported ${csvPreview.length} items`);
      setShowImport(false); setCsvText(""); setCsvPreview(null);
    } catch { showToast("Import failed"); }
    setImporting(false);
  };

  const grouped = {};
  filtered.forEach(item => {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  });

  const iStyle = m ? inputStyleMobile : inputStyle;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: m ? 14 : 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: m ? 20 : 22, fontWeight: 600, marginBottom: 4 }}>Master Inventory</h1>
          <p style={{ color: "#6b7280", fontSize: 14 }}>{items.length} items tracked</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ ...ghostBtn, padding: m ? "9px 13px" : "7px 14px" }} onClick={() => { setCsvText(""); setCsvPreview(null); setCsvError(""); setShowImport(true); }}>{m ? "Import" : "Import CSV"}</button>
          <button style={{ ...primaryBtn, padding: m ? "9px 13px" : "8px 16px" }} onClick={openAdd}>+ {m ? "Add" : "Add Item"}</button>
        </div>
      </div>

      {m ? (
        <>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items..." style={iStyle} />
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
            {["All", ...categories].map(c => (
              <button key={c} onClick={() => setFilterCat(c)} style={{ background: filterCat === c ? "#1a1a2e" : "#fff", color: filterCat === c ? "#fff" : "#374151", border: "1px solid #e5e7eb", borderRadius: 99, padding: "6px 14px", fontSize: 13, whiteSpace: "nowrap", cursor: "pointer", fontFamily: "inherit" }}>{c}</button>
            ))}
          </div>
        </>
      ) : (
        <div style={{ display: "flex", gap: 10 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items..." style={{ ...iStyle, flex: "1 1 160px" }} />
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={iStyle}>
            {["All", ...categories].map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      )}

      {m ? (
        <>
          {Object.entries(grouped).map(([cat, catItems]) => (
            <div key={cat}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>{cat}</div>
              <div className="card" style={{ overflow: "hidden" }}>
                {catItems.map((item, i) => (
                  <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderBottom: i < catItems.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 15 }}>{item.name}</div>
                      <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>Qty: {item.qty}{item.notes ? ` · ${item.notes}` : ""}</div>
                    </div>
                    <button style={{ ...ghostBtn, fontSize: 13, padding: "7px 12px" }} onClick={() => openEdit(item)}>Edit</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="card" style={{ padding: 36, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>No items found</div>}
        </>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: "1px solid #f3f4f6", background: "#fafafa" }}>
              {["Item", "Category", "Qty", "Notes", ""].map(h => <th key={h} style={{ textAlign: "left", padding: "10px 16px", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.map((item, i) => (
                <tr key={item.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 500, fontSize: 14 }}>{item.name}</td>
                  <td style={{ padding: "12px 16px" }}><span className="pill" style={{ background: "#f3f4f6", color: "#374151", fontSize: 11 }}>{item.category}</span></td>
                  <td style={{ padding: "12px 16px", fontSize: 14 }}>{item.qty}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "#6b7280", maxWidth: 200 }}>{item.notes || "—"}</td>
                  <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                    <button style={{ ...ghostBtn, fontSize: 12, marginRight: 6 }} onClick={() => openEdit(item)}>Edit</button>
                    <button style={dangerBtn} onClick={() => remove(item.id)}>Remove</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>No items found</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal title={editItem ? "Edit Item" : "Add Item"} onClose={() => setShowModal(false)} onSave={save} saveLabel={editItem ? "Save Changes" : "Add Item"} saving={saving} isMobile={m}>
          <label style={labelStyle}>Item Name</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={iStyle} placeholder="e.g. Wireless Microphone" autoFocus />
          <label style={labelStyle}>Category</label>
          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={iStyle}>
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
          <label style={labelStyle}>Quantity</label>
          <input type="number" value={form.qty} onChange={e => setForm(f => ({ ...f, qty: Number(e.target.value) }))} style={iStyle} min={1} />
          <label style={labelStyle}>Notes (optional)</label>
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ ...iStyle, height: 72, resize: "none" }} placeholder="Any details to remember..." />
          {editItem && <button style={{ ...dangerBtn, padding: "10px", width: "100%", textAlign: "center" }} onClick={async () => { await api.deleteItem(editItem.id); setItems(prev => prev.filter(i => i.id !== editItem.id)); setShowModal(false); showToast("Item removed"); }}>Remove Item</button>}
        </Modal>
      )}

      {showImport && (
        <Modal title="Import from CSV" onClose={() => setShowImport(false)} onSave={runImport} saveLabel={`Import ${csvPreview?.length || 0} Items`} saving={importing} wide isMobile={m}>
          <div style={{ background: "#f8f9fb", borderRadius: 8, padding: 12, fontSize: 13 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Column headers:</div>
            <code style={{ fontSize: 12, color: "#6b7280" }}>name, category, qty, notes</code>
            <div style={{ marginTop: 6, fontSize: 12, color: "#9ca3af" }}>Available categories: {categories.join(", ")}</div>
          </div>
          <button style={{ ...ghostBtn, width: "100%", padding: "11px" }} onClick={() => fileRef.current.click()}>📂 Upload CSV File</button>
          <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: "none" }} onChange={handleFileUpload} />
          <label style={labelStyle}>Or paste CSV text:</label>
          <textarea value={csvText} onChange={e => { setCsvText(e.target.value); previewCSV(e.target.value); }} style={{ ...iStyle, height: 90, resize: "none", fontFamily: "monospace", fontSize: 12 }} placeholder={"name,category,qty\nWireless Mic,AV / Tech,2"} />
          {csvError && <div style={{ color: "#dc2626", fontSize: 13, padding: "10px 12px", background: "#fef2f2", borderRadius: 8 }}>{csvError}</div>}
          {csvPreview?.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{csvPreview.length} items ready:</div>
              <div style={{ maxHeight: 160, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
                {csvPreview.slice(0, 20).map((row, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, padding: "9px 12px", borderBottom: i < Math.min(csvPreview.length, 20) - 1 ? "1px solid #f3f4f6" : "none", fontSize: 13 }}>
                    <span style={{ fontWeight: 500, flex: 2 }}>{row.name}</span>
                    <span style={{ color: "#6b7280", flex: 1 }}>{row.category}</span>
                    <span style={{ color: "#9ca3af" }}>×{row.qty}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

// ─── Event Form Fields ────────────────────────────────────────────────────────
function EventFormFields({ form, setForm, isMobile: m }) {
  const iStyle = m ? inputStyleMobile : inputStyle;
  return (
    <>
      <label style={labelStyle}>Event Name</label>
      <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={iStyle} placeholder="e.g. Nationals Qualifier – Ottawa" autoFocus />
      <label style={labelStyle}>Date</label>
      <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={iStyle} />
      <label style={labelStyle}>Location</label>
      <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} style={iStyle} placeholder="e.g. Toronto, ON" />
      <label style={labelStyle}>Status</label>
      <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={iStyle}>
        <option value="upcoming">Upcoming</option>
        <option value="active">Active</option>
        <option value="completed">Completed</option>
      </select>
      <label style={labelStyle}>Event Logo (optional)</label>
      <LogoUpload value={form.logo_url || null} onChange={val => setForm(f => ({ ...f, logo_url: val }))} size={48} />
    </>
  );
}

// ─── Events List ──────────────────────────────────────────────────────────────
function Events({ isMobile: m, events, setEvents, packing, setPacking, setView, setSelectedEventId, showToast }) {
  const [showModal, setShowModal] = useState(false);
  const [editEvent, setEditEvent] = useState(null);
  const [form, setForm] = useState({ name: "", date: "", location: "", status: "upcoming", logo_url: null });
  const [saving, setSaving] = useState(false);

  const openAdd = () => { setForm({ name: "", date: "", location: "", status: "upcoming", logo_url: null }); setEditEvent(null); setShowModal(true); };
  const openEdit = (e, evt) => { evt && evt.stopPropagation(); setForm({ name: e.name, date: e.date || "", location: e.location || "", status: e.status, logo_url: e.logo_url || null }); setEditEvent(e); setShowModal(true); };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editEvent) {
        await api.updateEvent(editEvent.id, form);
        setEvents(prev => prev.map(e => e.id === editEvent.id ? { ...e, ...form } : e));
        showToast("Event updated");
      } else {
        const created = await api.addEvent(form);
        setEvents(prev => [...prev, created[0]]);
        showToast("Event created");
      }
      setShowModal(false);
    } catch { showToast("Error saving event"); }
    setSaving(false);
  };

  const remove = async (id, evt) => {
    evt && evt.stopPropagation();
    try {
      await api.deletePackingByEvent(id);
      await api.deleteEvent(id);
      setEvents(prev => prev.filter(e => e.id !== id));
      setPacking(prev => prev.filter(p => p.event_id !== id));
      showToast("Event removed");
    } catch { showToast("Error removing event"); }
  };

  const sorted = [...events].sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: m ? 14 : 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: m ? 20 : 22, fontWeight: 600, marginBottom: 4 }}>Events</h1>
          <p style={{ color: "#6b7280", fontSize: 14 }}>{events.length} events this season</p>
        </div>
        <button style={{ ...primaryBtn, padding: m ? "9px 14px" : "8px 16px" }} onClick={openAdd}>+ {m ? "Add" : "Add Event"}</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: m ? 10 : 12 }}>
        {sorted.map(e => {
          const ep = packing.filter(p => p.event_id === e.id);
          const sc = STATUS_CONFIG[e.status] || STATUS_CONFIG.upcoming;
          return (
            <div key={e.id} className="card" style={{ padding: m ? "14px 16px" : "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, cursor: "pointer" }}
              onClick={() => { setSelectedEventId(e.id); setView("event-detail"); }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                {e.logo_url
                  ? <img src={e.logo_url} alt="" style={{ width: 40, height: 40, objectFit: "contain", borderRadius: 8, border: "1px solid #e5e7eb", flexShrink: 0 }} />
                  : <div style={{ width: 40, height: 40, borderRadius: 8, background: "#f3f4f6", flexShrink: 0 }} />
                }
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span className="pill" style={{ background: sc.bg, color: sc.color, fontSize: 11 }}>{sc.label}</span>
                    {!m && <span style={{ fontWeight: 600, fontSize: 15 }}>{e.name}</span>}
                  </div>
                  {m && <div style={{ fontWeight: 600, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.name}</div>}
                  <div style={{ fontSize: 12, color: "#6b7280" }}>{e.location}{e.date ? ` · ${e.date}` : ""}</div>
                  {ep.length > 0 && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{ep.filter(p => p.packed).length}/{ep.length} packed · {ep.filter(p => p.returned).length}/{ep.length} returned</div>}
                </div>
              </div>
              {m
                ? <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                    <button style={{ ...ghostBtn, fontSize: 12, padding: "6px 10px" }} onClick={(evt) => openEdit(e, evt)}>Edit</button>
                    <button style={{ ...dangerBtn, fontSize: 12, padding: "6px 10px" }} onClick={(evt) => remove(e.id, evt)}>Delete</button>
                  </div>
                : <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <button style={{ ...ghostBtn, fontSize: 12 }} onClick={(evt) => openEdit(e, evt)}>Edit</button>
                    <button style={{ ...ghostBtn, fontSize: 12 }} onClick={(evt) => { evt.stopPropagation(); setSelectedEventId(e.id); setView("event-detail"); }}>Packing List →</button>
                    <button style={dangerBtn} onClick={(evt) => remove(e.id, evt)}>Delete</button>
                  </div>
              }
            </div>
          );
        })}
        {events.length === 0 && <div className="card" style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>No events yet</div>}
      </div>
      {showModal && (
        <Modal title={editEvent ? "Edit Event" : "Add Event"} onClose={() => setShowModal(false)} onSave={save} saveLabel={editEvent ? "Save Changes" : "Create Event"} saving={saving} isMobile={m}>
          <EventFormFields form={form} setForm={setForm} isMobile={m} />
        </Modal>
      )}
    </div>
  );
}

// ─── Event Detail ─────────────────────────────────────────────────────────────
function EventDetail({ isMobile: m, event, events, setEvents, items, eventPacking, packing, setPacking, setView, showToast }) {
  const [showAddItem, setShowAddItem] = useState(false);
  const [addItemId, setAddItemId] = useState("");
  const [addQty, setAddQty] = useState(1);
  const [saving, setSaving] = useState(false);
  const [showCopy, setShowCopy] = useState(false);
  const [copyEventId, setCopyEventId] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({ name: event.name, date: event.date || "", location: event.location || "", status: event.status, logo_url: event.logo_url || null });

  useEffect(() => {
    setEditForm({ name: event.name, date: event.date || "", location: event.location || "", status: event.status, logo_url: event.logo_url || null });
  }, [event]);

  const saveEdit = async () => {
    setSaving(true);
    try {
      await api.updateEvent(event.id, editForm);
      setEvents(prev => prev.map(e => e.id === event.id ? { ...e, ...editForm } : e));
      showToast("Event updated"); setShowEdit(false);
    } catch { showToast("Error updating event"); }
    setSaving(false);
  };

  const toggleField = async (entry, field) => {
    const newVal = !entry[field];
    try {
      await api.updatePacking(entry.id, { [field]: newVal });
      setPacking(prev => prev.map(p => p.id === entry.id ? { ...p, [field]: newVal } : p));
    } catch { showToast("Error updating"); }
  };

  const removeFromList = async (entryId) => {
    try { await api.deletePacking(entryId); setPacking(prev => prev.filter(p => p.id !== entryId)); }
    catch { showToast("Error removing"); }
  };

  const addToList = async () => {
    if (!addItemId) return;
    if (eventPacking.find(p => p.item_id === addItemId)) { showToast("Already in list"); return; }
    setSaving(true);
    try {
      const created = await api.addPacking({ event_id: event.id, item_id: addItemId, qty_needed: addQty, packed: false, returned: false });
      setPacking(prev => [...prev, created[0]]);
      showToast("Item added"); setShowAddItem(false);
    } catch { showToast("Error adding item"); }
    setSaving(false);
  };

  const copyFromEvent = async () => {
    if (!copyEventId) return;
    const source = packing.filter(p => p.event_id === copyEventId);
    if (!source.length) { showToast("That event has no packing list"); return; }
    setSaving(true);
    try {
      const toAdd = source.filter(p => !eventPacking.find(ep => ep.item_id === p.item_id));
      const created = await Promise.all(toAdd.map(p => api.addPacking({ event_id: event.id, item_id: p.item_id, qty_needed: p.qty_needed, packed: false, returned: false })));
      setPacking(prev => [...prev, ...created.map(r => r[0])]);
      showToast(`Copied ${toAdd.length} items`); setShowCopy(false);
    } catch { showToast("Error copying"); }
    setSaving(false);
  };

  const updateStatus = async (newStatus) => {
    try {
      await api.updateEvent(event.id, { status: newStatus });
      setEvents(prev => prev.map(e => e.id === event.id ? { ...e, status: newStatus } : e));
      showToast(`Marked as ${newStatus}`);
    } catch { showToast("Error updating status"); }
  };

  const sc = STATUS_CONFIG[event.status] || STATUS_CONFIG.upcoming;
  const totalPacked = eventPacking.filter(p => p.packed).length;
  const total = eventPacking.length;
  const progress = total > 0 ? Math.round((totalPacked / total) * 100) : 0;
  const availableToAdd = items.filter(i => !eventPacking.find(p => p.item_id === i.id));
  const otherEvents = events.filter(e => e.id !== event.id && packing.some(p => p.event_id === e.id));
  const iStyle = m ? inputStyleMobile : inputStyle;

  const grouped = {};
  eventPacking.forEach(p => {
    const item = items.find(i => i.id === p.item_id);
    if (!item) return;
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push({ ...p, item });
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: m ? 14 : 16 }}>
      <button style={{ ...ghostBtn, alignSelf: "flex-start", fontSize: m ? 14 : 13 }} onClick={() => setView("events")}>← {m ? "Events" : "Back to Events"}</button>

      <div className="card" style={{ padding: m ? 14 : 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: total > 0 ? 14 : 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flex: 1, minWidth: 0 }}>
            {event.logo_url && <img src={event.logo_url} alt="" style={{ width: m ? 44 : 56, height: m ? 44 : 56, objectFit: "contain", borderRadius: 8, border: "1px solid #e5e7eb", flexShrink: 0 }} />}
            <div style={{ minWidth: 0 }}>
              <span className="pill" style={{ background: sc.bg, color: sc.color, marginBottom: 6, display: "inline-flex" }}>{sc.label}</span>
              <div style={{ fontWeight: 700, fontSize: m ? 16 : 20, lineHeight: 1.2, marginBottom: 3 }}>{event.name}</div>
              <div style={{ fontSize: m ? 13 : 14, color: "#6b7280" }}>{event.location}{event.date ? ` · ${event.date}` : ""}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flexShrink: 0 }}>
            <button style={{ ...ghostBtn, fontSize: 12, padding: m ? "7px 10px" : "6px 12px" }} onClick={() => setShowEdit(true)}>Edit</button>
            {event.status !== "active" && <button style={{ ...ghostBtn, fontSize: 12, padding: m ? "7px 10px" : "6px 12px" }} onClick={() => updateStatus("active")}>Active</button>}
            {event.status !== "completed" && <button style={{ ...ghostBtn, fontSize: 12, padding: m ? "7px 10px" : "6px 12px" }} onClick={() => updateStatus("completed")}>{m ? "Done" : "Completed"}</button>}
            {event.status !== "upcoming" && <button style={{ ...ghostBtn, fontSize: 12, padding: m ? "7px 10px" : "6px 12px" }} onClick={() => updateStatus("upcoming")}>Upcoming</button>}
          </div>
        </div>
        {total > 0 && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6b7280", marginBottom: 5 }}>
              <span>Packing progress</span><span>{totalPacked} / {total} packed</span>
            </div>
            <div style={{ background: "#f3f4f6", borderRadius: 99, height: 8, overflow: "hidden" }}>
              <div style={{ width: `${progress}%`, background: "#1a1a2e", height: "100%", borderRadius: 99, transition: "width 0.3s" }} />
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: m ? 15 : 14, fontWeight: 600 }}>Packing List</div>
        <div style={{ display: "flex", gap: 8 }}>
          {otherEvents.length > 0 && <button style={{ ...ghostBtn, fontSize: m ? 13 : 12, padding: m ? "8px 12px" : "7px 14px" }} onClick={() => { setCopyEventId(otherEvents[0].id); setShowCopy(true); }}>Copy</button>}
          <button style={{ ...primaryBtn, padding: m ? "8px 14px" : "8px 16px" }} onClick={() => { setAddItemId(availableToAdd[0]?.id || ""); setAddQty(1); setShowAddItem(true); }}>+ Add Item</button>
        </div>
      </div>

      {Object.keys(grouped).length === 0 && (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
          No items yet — add from inventory or copy from another event
        </div>
      )}

      {Object.entries(grouped).map(([cat, entries]) => (
        <div key={cat}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>{cat}</div>
          <div className="card" style={{ overflow: "hidden" }}>
            {entries.map((entry, i) => (
              <div key={entry.id} style={{ padding: m ? "14px 16px" : "12px 16px", borderBottom: i < entries.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                {m ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: 500, fontSize: 15, textDecoration: entry.returned ? "line-through" : "none", color: entry.returned ? "#9ca3af" : "#111" }}>{entry.item.name}</span>
                        <span style={{ fontSize: 13, color: "#9ca3af", marginLeft: 6 }}>×{entry.qty_needed}</span>
                        {entry.item.notes && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{entry.item.notes}</div>}
                      </div>
                      <button style={{ ...dangerBtn, padding: "6px 10px", marginLeft: 8 }} onClick={() => removeFromList(entry.id)}>✕</button>
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, background: entry.packed ? "#f0fdf4" : "#f8f9fb", borderRadius: 8, padding: "10px 14px", cursor: "pointer", border: `1px solid ${entry.packed ? "#bbf7d0" : "#e5e7eb"}` }}
                        onClick={() => toggleField(entry, "packed")}>
                        <div className={`check-box-mobile ${entry.packed ? "checked" : ""}`}>{entry.packed && <Checkmark />}</div>
                        <span style={{ fontSize: 14, fontWeight: 500, color: entry.packed ? "#15803d" : "#374151" }}>Packed</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, background: entry.returned ? "#f0fdf4" : "#f8f9fb", borderRadius: 8, padding: "10px 14px", cursor: "pointer", border: `1px solid ${entry.returned ? "#bbf7d0" : "#e5e7eb"}` }}
                        onClick={() => toggleField(entry, "returned")}>
                        <div className={`check-box-mobile ${entry.returned ? "checked" : ""}`}>{entry.returned && <Checkmark />}</div>
                        <span style={{ fontSize: 14, fontWeight: 500, color: entry.returned ? "#15803d" : "#374151" }}>Returned</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div className={`check-box-desktop ${entry.packed ? "checked" : ""}`} onClick={() => toggleField(entry, "packed")}>{entry.packed && <Checkmark />}</div>
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>Packed</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, textDecoration: entry.returned ? "line-through" : "none", color: entry.returned ? "#9ca3af" : "#111" }}>{entry.item.name}</span>
                      <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: 8 }}>×{entry.qty_needed}</span>
                      {entry.item.notes && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{entry.item.notes}</div>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>Returned</span>
                      <div className={`check-box-desktop ${entry.returned ? "checked" : ""}`} onClick={() => toggleField(entry, "returned")}>{entry.returned && <Checkmark />}</div>
                    </div>
                    <button style={{ ...dangerBtn, padding: "4px 8px", fontSize: 11 }} onClick={() => removeFromList(entry.id)}>✕</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {showEdit && (
        <Modal title="Edit Event" onClose={() => setShowEdit(false)} onSave={saveEdit} saveLabel="Save Changes" saving={saving} isMobile={m}>
          <EventFormFields form={editForm} setForm={setEditForm} isMobile={m} />
        </Modal>
      )}
      {showAddItem && (
        <Modal title="Add to Packing List" onClose={() => setShowAddItem(false)} onSave={addToList} saveLabel="Add to List" saving={saving} isMobile={m}>
          <label style={labelStyle}>Select Item</label>
          <select value={addItemId} onChange={e => setAddItemId(e.target.value)} style={iStyle}>
            {availableToAdd.length === 0 ? <option value="">All items already added</option> : availableToAdd.map(i => <option key={i.id} value={i.id}>{i.name} ({i.category})</option>)}
          </select>
          <label style={labelStyle}>Qty Needed</label>
          <input type="number" value={addQty} onChange={e => setAddQty(Number(e.target.value))} style={iStyle} min={1} />
        </Modal>
      )}
      {showCopy && (
        <Modal title="Copy from Event" onClose={() => setShowCopy(false)} onSave={copyFromEvent} saveLabel="Copy Items" saving={saving} isMobile={m}>
          <label style={labelStyle}>Copy from which event?</label>
          <select value={copyEventId} onChange={e => setCopyEventId(e.target.value)} style={iStyle}>
            {otherEvents.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <p style={{ fontSize: 13, color: "#6b7280" }}>Items already on this list won't be duplicated. All copied items start as unpacked.</p>
        </Modal>
      )}
    </div>
  );
}
