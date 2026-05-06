import { useState, useEffect, useCallback, useRef } from "react";

const SUPABASE_URL = "https://peylonukcwsqdknchxda.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBleWxvbnVrY3dzcWRrbmNoeGRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MDQxOTYsImV4cCI6MjA5MzQ4MDE5Nn0.fTgnQxWxBDcHk0Xq-4KQJZH9xi4bYwle27tdrjseQ3k";
const ORG_LOGO_PATH = "org-logo.png";
const ORG_LOGO_PUBLIC_URL = `${SUPABASE_URL}/storage/v1/object/public/logos/${ORG_LOGO_PATH}`;
const ADMIN_EMAIL = "zack@canadiancheer.com";

let authToken = null;

const sb = async (path, options = {}) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${authToken || SUPABASE_KEY}`,
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
  deleteItem: (id) => sb(`items?id=eq.${id}`, { method: "DELETE" }),
  getEvents: () => sb("events?order=date"),
  addEvent: (event) => sb("events", { method: "POST", body: JSON.stringify(event) }),
  updateEvent: (id, patch) => sb(`events?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteEvent: (id) => sb(`events?id=eq.${id}`, { method: "DELETE" }),
  getAllPacking: () => sb("packing_list"),
  addPacking: (entry) => sb("packing_list", { method: "POST", body: JSON.stringify(entry) }),
  updatePacking: (id, patch) => sb(`packing_list?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deletePacking: (id) => sb(`packing_list?id=eq.${id}`, { method: "DELETE" }),
  deletePackingByEvent: (eventId) => sb(`packing_list?event_id=eq.${eventId}`, { method: "DELETE" }),
  getCategories: () => sb("categories?order=sort_order,name"),
  addCategory: (cat) => sb("categories", { method: "POST", body: JSON.stringify(cat) }),
  updateCategory: (id, patch) => sb(`categories?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteCategory: (id) => sb(`categories?id=eq.${id}`, { method: "DELETE" }),
  getTrailers: () => sb("trailers?order=number"),
  addTrailer: (t) => sb("trailers", { method: "POST", body: JSON.stringify(t) }),
  updateTrailer: (id, patch) => sb(`trailers?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteTrailer: (id) => sb(`trailers?id=eq.${id}`, { method: "DELETE" }),
  getEventTrailers: () => sb("event_trailers"),
  addEventTrailer: (et) => sb("event_trailers", { method: "POST", body: JSON.stringify(et) }),
  deleteEventTrailer: (id) => sb(`event_trailers?id=eq.${id}`, { method: "DELETE" }),
  deleteEventTrailersByEvent: (eventId) => sb(`event_trailers?event_id=eq.${eventId}`, { method: "DELETE" }),
  getAreas: () => sb("areas?order=sort_order"),
  getAreaItems: () => sb("area_items"),
  addAreaItem: (ai) => sb("area_items", { method: "POST", body: JSON.stringify(ai) }),
  updateAreaItem: (id, patch) => sb(`area_items?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteAreaItem: (id) => sb(`area_items?id=eq.${id}`, { method: "DELETE" }),
  addArea: (a) => sb("areas", { method: "POST", body: JSON.stringify(a) }),
  updateArea: (id, patch) => sb(`areas?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteArea: (id) => sb(`areas?id=eq.${id}`, { method: "DELETE" }),
  getReports: () => sb("event_reports?order=submitted_at.desc"),
  getReportItems: () => sb("report_items"),
  getTechSetups: () => sb("tech_setups?order=created_at"),
  addTechSetup: (s) => sb("tech_setups", { method: "POST", body: JSON.stringify(s) }),
  updateTechSetup: (id, patch) => sb(`tech_setups?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  getTechDevices: () => sb("tech_devices?order=created_at"),
  addTechDevice: (d) => sb("tech_devices", { method: "POST", body: JSON.stringify(d) }),
  updateTechDevice: (id, patch) => sb(`tech_devices?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteTechDevice: (id) => sb(`tech_devices?id=eq.${id}`, { method: "DELETE" }),
  getTechConnections: () => sb("tech_connections?order=created_at"),
  addTechConnection: (c) => sb("tech_connections", { method: "POST", body: JSON.stringify(c) }),
  deleteTechConnection: (id) => sb(`tech_connections?id=eq.${id}`, { method: "DELETE" }),
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

const auth = {
  signIn: async (email, password) => {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "apikey": SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error_description || "Invalid credentials"); }
    return res.json();
  },
  signOut: async () => {
    if (!authToken) return;
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST",
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${authToken}` },
    }).catch(() => {});
  },
  refresh: async (refreshToken) => {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { "apikey": SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    return res.json();
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

// ─── Trailer SVG Diagram ──────────────────────────────────────────────────────
function TrailerDiagram({ trailer, packingEntries, items }) {
  const isBarn = trailer.door_type === "barn";
  const zones = [
    { id: "FL", label: "Front Left", x: 10, y: 10, w: 80, h: 100 },
    { id: "FR", label: "Front Right", x: 110, y: 10, w: 80, h: 100 },
    { id: "ML", label: "Mid Left", x: 10, y: 120, w: 80, h: 100 },
    { id: "MR", label: "Mid Right", x: 110, y: 120, w: 80, h: 100 },
    { id: "RL", label: "Rear Left", x: 10, y: 230, w: 80, h: 100 },
    { id: "RR", label: "Rear Right", x: 110, y: 230, w: 80, h: 100 },
  ];

  const total = packingEntries.length;
  const packed = packingEntries.filter(p => p.packed).length;
  const pct = total > 0 ? Math.round((packed / total) * 100) : 0;
  const fillColor = pct === 100 ? "#16a34a" : pct > 50 ? "#2563eb" : pct > 0 ? "#f59e0b" : "#e5e7eb";

  return (
    <div style={{ background: "#f8f9fb", borderRadius: 10, padding: 16, border: "1px solid #e5e7eb" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Trailer Layout — Top View</div>
        <div style={{ fontSize: 13, color: pct === 100 ? "#16a34a" : "#6b7280", fontWeight: 500 }}>{packed}/{total} packed ({pct}%)</div>
      </div>
      <svg viewBox="0 0 200 360" style={{ width: "100%", maxWidth: 280, display: "block", margin: "0 auto" }}>
        {/* Trailer outline */}
        <rect x="5" y="5" width="190" height="350" rx="4" fill="#fff" stroke="#374151" strokeWidth="2.5" />

        {/* Front cab indicator */}
        <rect x="5" y="5" width="190" height="22" rx="4" fill="#1a1a2e" />
        <text x="100" y="19" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="600">FRONT</text>

        {/* Center divider */}
        <line x1="100" y1="27" x2="100" y2="335" stroke="#d1d5db" strokeWidth="1" strokeDasharray="4,3" />

        {/* Fill level indicator on left side */}
        <rect x="5" y="27" width="8" height={Math.round(308 * pct / 100)} fill={fillColor} opacity="0.4" />

        {/* Zones */}
        {zones.map(z => {
          const zoneEntries = packingEntries.filter((_, i) => {
            const idx = Math.floor(i / Math.ceil(total / 6));
            return zones[idx]?.id === z.id;
          });
          return (
            <g key={z.id}>
              <rect x={z.x} y={z.y + 20} width={z.w} height={z.h} rx="3"
                fill="#f3f4f6" stroke="#d1d5db" strokeWidth="1" />
              <text x={z.x + z.w / 2} y={z.y + 75} textAnchor="middle" fill="#9ca3af" fontSize="8">{z.label}</text>
            </g>
          );
        })}

        {/* Door */}
        {isBarn ? (
          <g>
            <rect x="5" y="330" width="85" height="22" rx="2" fill="#374151" />
            <rect x="110" y="330" width="85" height="22" rx="2" fill="#374151" />
            <text x="52" y="344" textAnchor="middle" fill="#fff" fontSize="8">BARN DOOR L</text>
            <text x="152" y="344" textAnchor="middle" fill="#fff" fontSize="8">BARN DOOR R</text>
          </g>
        ) : (
          <g>
            <rect x="5" y="330" width="190" height="22" rx="2" fill="#374151" />
            <text x="100" y="344" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="600">ROLL-UP DOOR</text>
          </g>
        )}

        {/* Packed items as dots */}
        {packingEntries.slice(0, 24).map((entry, i) => {
          const col = i % 8;
          const row = Math.floor(i / 8);
          const x = 20 + col * 20;
          const y = 50 + row * 80;
          return (
            <circle key={entry.id} cx={x} cy={y} r="6"
              fill={entry.packed ? "#16a34a" : "#e5e7eb"}
              stroke={entry.packed ? "#15803d" : "#d1d5db"}
              strokeWidth="1">
              <title>{entry.item?.name || ""}</title>
            </circle>
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 10, fontSize: 12, color: "#6b7280" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#16a34a" }} />Packed
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#e5e7eb", border: "1px solid #d1d5db" }} />Unpacked
        </div>
      </div>
    </div>
  );
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

// ─── Category Manager ─────────────────────────────────────────────────────────
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
      setNewName(""); showToast("Category added");
    } catch { showToast("Error — name may already exist"); }
    setSaving(false);
  };

  const saveEdit = async (id) => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await api.updateCategory(id, { name: editName.trim() });
      setCategories(prev => prev.map(c => c.id === id ? { ...c, name: editName.trim() } : c));
      setEditId(null); showToast("Category updated");
    } catch { showToast("Error — name may already exist"); }
    setSaving(false);
  };

  const remove = async (id) => {
    setSaving(true);
    try {
      await api.deleteCategory(id);
      setCategories(prev => prev.filter(c => c.id !== id));
      showToast("Category removed");
    } catch { showToast("Error removing"); }
    setSaving(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Manage Categories</div>
      <div className="card" style={{ overflow: "hidden" }}>
        {categories.map((cat, i) => (
          <div key={cat.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderBottom: i < categories.length - 1 ? "1px solid #f3f4f6" : "none" }}>
            {editId === cat.id ? (
              <>
                <input value={editName} onChange={e => setEditName(e.target.value)} style={{ ...iStyle, flex: 1 }}
                  onKeyDown={e => { if (e.key === "Enter") saveEdit(cat.id); if (e.key === "Escape") setEditId(null); }} autoFocus />
                <button style={{ ...primaryBtn, padding: "6px 12px", fontSize: 12 }} onClick={() => saveEdit(cat.id)}>Save</button>
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
        {categories.length === 0 && <div style={{ padding: 16, fontSize: 13, color: "#9ca3af", textAlign: "center" }}>No categories yet</div>}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={newName} onChange={e => setNewName(e.target.value)} style={{ ...iStyle, flex: 1 }} placeholder="New category name..."
          onKeyDown={e => e.key === "Enter" && add()} />
        <button style={{ ...primaryBtn, whiteSpace: "nowrap" }} onClick={add} disabled={saving}>+ Add</button>
      </div>
      <p style={{ fontSize: 12, color: "#9ca3af" }}>Removing a category won't delete items in it.</p>
    </div>
  );
}

// ─── Trailer Manager (for Settings) ──────────────────────────────────────────
function TrailerManager({ trailers, setTrailers, showToast, isMobile: m }) {
  const [showModal, setShowModal] = useState(false);
  const [editTrailer, setEditTrailer] = useState(null);
  const [form, setForm] = useState({ number: "", door_type: "rollup", notes: "" });
  const [saving, setSaving] = useState(false);
  const iStyle = m ? inputStyleMobile : inputStyle;

  const openAdd = () => { setForm({ number: "", door_type: "rollup", notes: "" }); setEditTrailer(null); setShowModal(true); };
  const openEdit = (t) => { setForm({ number: t.number, door_type: t.door_type, notes: t.notes || "" }); setEditTrailer(t); setShowModal(true); };

  const save = async () => {
    if (!form.number.trim()) return;
    setSaving(true);
    try {
      if (editTrailer) {
        await api.updateTrailer(editTrailer.id, form);
        setTrailers(prev => prev.map(t => t.id === editTrailer.id ? { ...t, ...form } : t));
        showToast("Trailer updated");
      } else {
        const created = await api.addTrailer(form);
        setTrailers(prev => [...prev, created[0]]);
        showToast("Trailer added");
      }
      setShowModal(false);
    } catch { showToast("Error saving trailer"); }
    setSaving(false);
  };

  const remove = async (id) => {
    try { await api.deleteTrailer(id); setTrailers(prev => prev.filter(t => t.id !== id)); showToast("Trailer removed"); }
    catch { showToast("Error removing trailer"); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Manage Trailers</div>
        <button style={{ ...primaryBtn, fontSize: 12, padding: "6px 12px" }} onClick={openAdd}>+ Add Trailer</button>
      </div>
      <div className="card" style={{ overflow: "hidden" }}>
        {trailers.map((t, i) => (
          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: i < trailers.length - 1 ? "1px solid #f3f4f6" : "none" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: 14 }}>🚛 Trailer {t.number}</div>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>{t.door_type === "barn" ? "Barn doors" : "Roll-up door"}{t.notes ? ` · ${t.notes}` : ""}</div>
            </div>
            <button style={{ ...ghostBtn, padding: "5px 10px", fontSize: 12 }} onClick={() => openEdit(t)}>Edit</button>
            <button style={{ ...dangerBtn, padding: "5px 10px" }} onClick={() => remove(t.id)}>Remove</button>
          </div>
        ))}
        {trailers.length === 0 && <div style={{ padding: 16, fontSize: 13, color: "#9ca3af", textAlign: "center" }}>No trailers yet</div>}
      </div>

      {showModal && (
        <Modal title={editTrailer ? "Edit Trailer" : "Add Trailer"} onClose={() => setShowModal(false)} onSave={save} saveLabel={editTrailer ? "Save" : "Add Trailer"} saving={saving} isMobile={m}>
          <label style={labelStyle}>Trailer Number</label>
          <input value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))} style={iStyle} placeholder="e.g. 53702" autoFocus />
          <label style={labelStyle}>Door Type</label>
          <select value={form.door_type} onChange={e => setForm(f => ({ ...f, door_type: e.target.value }))} style={iStyle}>
            <option value="rollup">Roll-up Door</option>
            <option value="barn">Barn Doors</option>
          </select>
          <label style={labelStyle}>Notes (optional)</label>
          <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={iStyle} placeholder="Any details..." />
        </Modal>
      )}
    </div>
  );
}

// ─── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError("");
    try {
      const session = await auth.signIn(email.trim(), password);
      onLogin(session);
    } catch (err) {
      setError(err.message || "Sign in failed. Check your email and password.");
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8f9fb", fontFamily: "'DM Sans', 'Segoe UI', sans-serif", padding: 24 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; }`}</style>
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: "40px 36px", width: "100%", maxWidth: 380, boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img src={ORG_LOGO_PUBLIC_URL} alt="" style={{ height: 52, marginBottom: 14, objectFit: "contain" }}
            onError={e => { e.target.style.display = "none"; }} />
          <div style={{ fontWeight: 700, fontSize: 22, color: "#1a1a2e", letterSpacing: "-0.5px" }}>Cheer Ops</div>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>Sign in to continue</div>
        </div>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              style={{ width: "100%", padding: "11px 14px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 15, fontFamily: "inherit", outline: "none" }}
              placeholder="you@example.com" autoFocus autoComplete="email" />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              style={{ width: "100%", padding: "11px 14px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 15, fontFamily: "inherit", outline: "none" }}
              placeholder="••••••••" autoComplete="current-password" />
          </div>
          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#dc2626" }}>
              {error}
            </div>
          )}
          <button type="submit" disabled={loading}
            style={{ background: "#1a1a2e", color: "#fff", border: "none", padding: "13px", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: loading ? 0.6 : 1, marginTop: 4 }}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
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
  const [trailers, setTrailers] = useState([]);
  const [areas, setAreas] = useState([]);
  const [areaItems, setAreaItems] = useState([]);
  const [reports, setReports] = useState([]);
  const [reportItems, setReportItems] = useState([]);
  const [eventTrailers, setEventTrailers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState("dashboard");
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [toast, setToast] = useState(null);
  const [orgLogo, setOrgLogo] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [pendingLogo, setPendingLogo] = useState(null);

  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("sb_session");
    if (!stored) { setAuthChecked(true); return; }
    try {
      const s = JSON.parse(stored);
      const expiresAt = s.expires_at || 0;
      if (expiresAt > Math.floor(Date.now() / 1000) + 60) {
        authToken = s.access_token;
        setSession(s);
        setAuthChecked(true);
      } else {
        auth.refresh(s.refresh_token).then(fresh => {
          if (fresh) {
            const newSession = { ...fresh, expires_at: Math.floor(Date.now() / 1000) + fresh.expires_in };
            localStorage.setItem("sb_session", JSON.stringify(newSession));
            authToken = fresh.access_token;
            setSession(newSession);
          } else {
            localStorage.removeItem("sb_session");
          }
          setAuthChecked(true);
        });
      }
    } catch {
      localStorage.removeItem("sb_session");
      setAuthChecked(true);
    }
  }, []);

  const handleLogin = (s) => {
    const newSession = { ...s, expires_at: Math.floor(Date.now() / 1000) + s.expires_in };
    localStorage.setItem("sb_session", JSON.stringify(newSession));
    authToken = s.access_token;
    setSession(newSession);
  };

  const handleLogout = async () => {
    await auth.signOut();
    localStorage.removeItem("sb_session");
    authToken = null;
    setSession(null);
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [i, e, p, cats, tr, et, ar, ai, rp, ri, logoUrl] = await Promise.all([
        api.getItems(), api.getEvents(), api.getAllPacking(),
        api.getCategories(), api.getTrailers(), api.getEventTrailers(),
        api.getAreas(), api.getAreaItems(), api.getReports(), api.getReportItems(),
        checkOrgLogoExists()
      ]);
      setItems(i); setEvents(e); setPacking(p);
      setCategories(cats); setTrailers(tr); setEventTrailers(et);
      setAreas(ar); setAreaItems(ai); setReports(rp); setReportItems(ri);
      setOrgLogo(logoUrl); setError(null);
    } catch { setError("Could not connect to database."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const saveSettings = () => { setOrgLogo(pendingLogo); showToast("Settings saved"); setShowSettings(false); };
  const categoryNames = categories.map(c => c.name);

  if (!authChecked) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "DM Sans, sans-serif", color: "#6b7280" }}>Loading...</div>;
  if (!session) return <LoginScreen onLogin={handleLogin} />;

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "DM Sans, sans-serif", color: "#6b7280" }}>Loading Cheer Ops...</div>;
  if (error) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "DM Sans, sans-serif", gap: 16, padding: 24, textAlign: "center" }}>
      <div style={{ fontSize: 36 }}>⚠️</div>
      <div style={{ fontWeight: 600 }}>Connection Error</div>
      <div style={{ color: "#6b7280", fontSize: 14, maxWidth: 360 }}>{error}</div>
      <button style={{ ...primaryBtn, padding: "10px 24px" }} onClick={loadAll}>Retry</button>
    </div>
  );

  const isAdmin = session?.user?.email === ADMIN_EMAIL;
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
        .trailer-tab { padding: 8px 16px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; background: #fff; color: #374151; font-family: inherit; transition: all 0.15s; }
        .trailer-tab.active { background: #1a1a2e; color: #fff; border-color: #1a1a2e; }
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
          <button className={`nav-btn ${view === "reports" ? "active" : ""}`} onClick={() => setView("reports")}>Reports</button>
          {isAdmin && <button className={`nav-btn ${view === "tech" ? "active" : ""}`} onClick={() => setView("tech")}>Tech Setups</button>}
        </>}
        <div style={{ flex: 1 }} />
        {!m && <button style={{ background: "none", border: "none", fontSize: 13, padding: "6px 10px", color: "#9ca3af", cursor: "pointer", fontFamily: "inherit" }} onClick={handleLogout}>Sign out</button>}
        <button style={{ background: "none", border: "none", fontSize: 20, padding: "8px", color: "#9ca3af", cursor: "pointer", lineHeight: 1 }} onClick={() => { setPendingLogo(orgLogo); setShowSettings(true); }}>⚙️</button>
      </div>

      <div style={{ padding: m ? "16px 16px 90px" : "28px 24px", maxWidth: m ? "100%" : 960, margin: "0 auto" }}>
        {view === "dashboard" && <Dashboard isMobile={m} items={items} events={events} packing={packing} trailers={trailers} setView={setView} setSelectedEventId={setSelectedEventId} />}
        {view === "inventory" && <Inventory isMobile={m} items={items} setItems={setItems} categories={categoryNames} packing={packing} showToast={showToast} />}
        {view === "events" && <Events isMobile={m} events={events} setEvents={setEvents} packing={packing} setPacking={setPacking} eventTrailers={eventTrailers} setEventTrailers={setEventTrailers} setView={setView} setSelectedEventId={setSelectedEventId} showToast={showToast} />}
        {view === "event-detail" && selectedEvent && <EventDetail isMobile={m} event={selectedEvent} events={events} setEvents={setEvents} items={items} eventPacking={eventPacking} packing={packing} setPacking={setPacking} trailers={trailers} eventTrailers={eventTrailers} setEventTrailers={setEventTrailers} setView={setView} showToast={showToast} />}
        {view === "reports" && <Reports isMobile={m} reports={reports} setReports={setReports} reportItems={reportItems} events={events} areas={areas} setAreas={setAreas} areaItems={areaItems} setAreaItems={setAreaItems} items={items} setItems={setItems} showToast={showToast} />}
        {view === "tech" && isAdmin && <TechSetups isMobile={m} events={events} showToast={showToast} />}
      </div>

      {m && (
        <nav className="tab-bar">
          <button className={`tab-btn ${view === "dashboard" ? "active" : ""}`} onClick={() => setView("dashboard")}><span className="tab-icon">🏠</span>Dashboard</button>
          <button className={`tab-btn ${view === "inventory" ? "active" : ""}`} onClick={() => setView("inventory")}><span className="tab-icon">📦</span>Inventory</button>
          <button className={`tab-btn ${["events", "event-detail"].includes(view) ? "active" : ""}`} onClick={() => setView("events")}><span className="tab-icon">📅</span>Events</button>
          <button className={`tab-btn ${view === "reports" ? "active" : ""}`} onClick={() => setView("reports")}><span className="tab-icon">📋</span>Reports</button>
          {isAdmin && <button className={`tab-btn ${view === "tech" ? "active" : ""}`} onClick={() => setView("tech")}><span className="tab-icon">📶</span>Tech</button>}
        </nav>
      )}

      {showSettings && (
        <Modal title="Settings" onClose={() => setShowSettings(false)} onSave={saveSettings} saveLabel="Done" saving={false} isMobile={m} wide>
          <LogoUpload value={pendingLogo} onChange={setPendingLogo} label="Organization Logo" size={56} storageKey={ORG_LOGO_PATH} />
          <p style={{ fontSize: 12, color: "#9ca3af", marginTop: -4 }}>Logo uploads to storage and appears for everyone on next page load.</p>
          <div className="settings-section">
            <CategoryManager categories={categories} setCategories={setCategories} showToast={showToast} isMobile={m} />
          </div>
          <div className="settings-section">
            <TrailerManager trailers={trailers} setTrailers={setTrailers} showToast={showToast} isMobile={m} />
          </div>
        </Modal>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ isMobile: m, items, events, packing, trailers, setView, setSelectedEventId }) {
  const activeEvent = events.find(e => e.status === "active");
  const upcomingEvents = events.filter(e => e.status === "upcoming");
  const activePacking = activeEvent ? packing.filter(p => p.event_id === activeEvent.id) : [];
  const itemsOut = activePacking.filter(p => p.packed && !p.returned).length;
  const packingProgress = activePacking.length > 0 ? Math.round((activePacking.filter(p => p.packed).length / activePacking.length) * 100) : null;

  // Warehouse view: calculate qty available per item
  const itemsWithAvailable = items.map(item => {
    const out = packing
      .filter(p => p.item_id === item.id && p.packed && !p.returned)
      .reduce((sum, p) => sum + (p.qty_needed || 1), 0);
    return { ...item, available: Math.max(0, item.qty - out), out };
  });
  const itemsCurrentlyOut = itemsWithAvailable.filter(i => i.out > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: m ? 14 : 20 }}>
      <div>
        <h1 style={{ fontSize: m ? 20 : 22, fontWeight: 600, marginBottom: 4 }}>Dashboard</h1>
        <p style={{ color: "#6b7280", fontSize: 14 }}>Your season at a glance</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: m ? 10 : 16 }}>
        {[
          { label: m ? "Items" : "Total Items", value: items.length, sub: "in master inventory" },
          { label: "Items Out", value: itemsCurrentlyOut.length, sub: "types currently packed" },
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

      {/* Warehouse status */}
      {itemsCurrentlyOut.length > 0 && (
        <div className="card" style={{ padding: m ? 0 : 20 }}>
          {m
            ? <div style={{ padding: "14px 16px 10px", fontWeight: 600, fontSize: 14, borderBottom: "1px solid #f3f4f6" }}>🏭 Warehouse Status</div>
            : <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 14 }}>🏭 Warehouse Status</div>
          }
          {itemsCurrentlyOut.map((item, i) => (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: m ? "11px 16px" : "0 0 10px", marginBottom: !m && i < itemsCurrentlyOut.length - 1 ? 10 : 0, borderBottom: (m && i < itemsCurrentlyOut.length - 1) ? "1px solid #f3f4f6" : "none" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 14 }}>{item.name}</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>{item.available} in warehouse · {item.out} on trailer</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <span className="pill" style={{ background: "#ecfdf5", color: "#059669", fontSize: 11 }}>{item.available} avail</span>
                <span className="pill" style={{ background: "#eff6ff", color: "#2563eb", fontSize: 11 }}>{item.out} out</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {upcomingEvents.length > 0 && (
        <div className="card" style={{ padding: m ? 0 : 20 }}>
          {m
            ? <div style={{ padding: "14px 16px 10px", fontWeight: 600, fontSize: 14, borderBottom: "1px solid #f3f4f6" }}>Upcoming Events</div>
            : <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 14 }}>Upcoming Events</div>
          }
          {upcomingEvents.map((e, i) => (
            <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: m ? "12px 16px" : "0 0 10px", marginBottom: !m && i < upcomingEvents.length - 1 ? 10 : 0, borderBottom: (m && i < upcomingEvents.length - 1) ? "1px solid #f3f4f6" : "none", cursor: m ? "pointer" : "default" }}
              onClick={m ? () => { setSelectedEventId(e.id); setView("event-detail"); } : undefined}>
              {e.logo_url && <img src={e.logo_url} alt="" style={{ width: 32, height: 32, objectFit: "contain", borderRadius: 5, border: "1px solid #e5e7eb", flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.name}</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>{e.location} · {e.date}</div>
              </div>
              {m ? <span style={{ color: "#9ca3af", fontSize: 18 }}>›</span>
                : <button style={ghostBtn} onClick={() => { setSelectedEventId(e.id); setView("event-detail"); }}>View →</button>}
            </div>
          ))}
        </div>
      )}

      {events.length === 0 && <div className="card" style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>No events yet — go to Events to add your season schedule</div>}
    </div>
  );
}

// ─── Inventory ────────────────────────────────────────────────────────────────
function Inventory({ isMobile: m, items, setItems, categories, packing, showToast }) {
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("All");
  const [showWarehouse, setShowWarehouse] = useState(false);
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

  // Calculate warehouse availability
  const itemsWithAvailable = items.map(item => {
    const out = packing
      .filter(p => p.item_id === item.id && p.packed && !p.returned)
      .reduce((sum, p) => sum + (p.qty_needed || 1), 0);
    return { ...item, available: Math.max(0, item.qty - out), out };
  });

  const filtered = itemsWithAvailable.filter(i => (filterCat === "All" || i.category === filterCat) && i.name.toLowerCase().includes(search.toLowerCase()));
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
          <button style={{ ...ghostBtn, padding: m ? "9px 13px" : "7px 14px", background: showWarehouse ? "#1a1a2e" : "none", color: showWarehouse ? "#fff" : "#374151" }} onClick={() => setShowWarehouse(w => !w)}>🏭 {m ? "" : "Warehouse"}</button>
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
                      <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
                        {showWarehouse
                          ? <span>{item.available} in warehouse{item.out > 0 ? ` · ${item.out} on trailer` : ""}</span>
                          : <span>Qty: {item.qty}{item.notes ? ` · ${item.notes}` : ""}</span>
                        }
                      </div>
                    </div>
                    {showWarehouse && item.out > 0 && <span className="pill" style={{ background: "#eff6ff", color: "#2563eb", fontSize: 11 }}>Out</span>}
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
              {["Item", "Category", showWarehouse ? "In Warehouse" : "Qty", showWarehouse ? "On Trailers" : "Notes", ""].map(h => <th key={h} style={{ textAlign: "left", padding: "10px 16px", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.map((item, i) => (
                <tr key={item.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 500, fontSize: 14 }}>{item.name}</td>
                  <td style={{ padding: "12px 16px" }}><span className="pill" style={{ background: "#f3f4f6", color: "#374151", fontSize: 11 }}>{item.category}</span></td>
                  <td style={{ padding: "12px 16px", fontSize: 14 }}>
                    {showWarehouse
                      ? <span style={{ color: item.available === 0 ? "#dc2626" : "#059669", fontWeight: 500 }}>{item.available}</span>
                      : item.qty
                    }
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "#6b7280", maxWidth: 200 }}>
                    {showWarehouse
                      ? (item.out > 0 ? <span className="pill" style={{ background: "#eff6ff", color: "#2563eb", fontSize: 11 }}>{item.out} out</span> : <span style={{ color: "#9ca3af" }}>—</span>)
                      : (item.notes || "—")
                    }
                  </td>
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
          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={iStyle}>{categories.map(c => <option key={c}>{c}</option>)}</select>
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
            <div style={{ marginTop: 6, fontSize: 12, color: "#9ca3af" }}>Categories: {categories.join(", ")}</div>
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
function Events({ isMobile: m, events, setEvents, packing, setPacking, eventTrailers, setEventTrailers, setView, setSelectedEventId, showToast }) {
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
      await api.deleteEventTrailersByEvent(id);
      await api.deleteEvent(id);
      setEvents(prev => prev.filter(e => e.id !== id));
      setPacking(prev => prev.filter(p => p.event_id !== id));
      setEventTrailers(prev => prev.filter(et => et.event_id !== id));
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
          const et = eventTrailers.filter(t => t.event_id === e.id);
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
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
                    {ep.length > 0 && `${ep.filter(p => p.packed).length}/${ep.length} packed`}
                    {et.length > 0 && ` · ${et.length} trailer${et.length > 1 ? "s" : ""}`}
                  </div>
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
function EventDetail({ isMobile: m, event, events, setEvents, items, eventPacking, packing, setPacking, trailers, eventTrailers, setEventTrailers, setView, showToast }) {
  const [activeTab, setActiveTab] = useState("all"); // "all" | trailer id
  const [showDiagram, setShowDiagram] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [addItemId, setAddItemId] = useState("");
  const [addQty, setAddQty] = useState(1);
  const [addTrailerId, setAddTrailerId] = useState("");
  const [saving, setSaving] = useState(false);
  const [showCopy, setShowCopy] = useState(false);
  const [copyEventId, setCopyEventId] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [showTrailerManager, setShowTrailerManager] = useState(false);
  const [editForm, setEditForm] = useState({ name: event.name, date: event.date || "", location: event.location || "", status: event.status, logo_url: event.logo_url || null });

  useEffect(() => {
    setEditForm({ name: event.name, date: event.date || "", location: event.location || "", status: event.status, logo_url: event.logo_url || null });
  }, [event]);

  // Trailers assigned to this event
  const assignedEventTrailers = eventTrailers.filter(et => et.event_id === event.id);
  const assignedTrailers = assignedEventTrailers.map(et => trailers.find(t => t.id === et.trailer_id)).filter(Boolean);
  const unassignedTrailers = trailers.filter(t => !assignedEventTrailers.find(et => et.trailer_id === t.id));

  const assignTrailer = async (trailerId) => {
    try {
      const created = await api.addEventTrailer({ event_id: event.id, trailer_id: trailerId });
      setEventTrailers(prev => [...prev, created[0]]);
      showToast("Trailer assigned");
    } catch { showToast("Error assigning trailer"); }
  };

  const unassignTrailer = async (trailerId) => {
    const et = assignedEventTrailers.find(e => e.trailer_id === trailerId);
    if (!et) return;
    try {
      await api.deleteEventTrailer(et.id);
      setEventTrailers(prev => prev.filter(e => e.id !== et.id));
      showToast("Trailer removed");
    } catch { showToast("Error removing trailer"); }
  };

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

  const updateQty = async (entry, newQty) => {
    if (newQty < 1) return;
    try {
      await api.updatePacking(entry.id, { qty_needed: newQty });
      setPacking(prev => prev.map(p => p.id === entry.id ? { ...p, qty_needed: newQty } : p));
    } catch { showToast("Error updating qty"); }
  };

  const assignTrailerToItem = async (entry, trailerId) => {
    const val = trailerId === entry.trailer_id ? null : trailerId;
    try {
      await api.updatePacking(entry.id, { trailer_id: val });
      setPacking(prev => prev.map(p => p.id === entry.id ? { ...p, trailer_id: val } : p));
    } catch { showToast("Error assigning trailer"); }
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
      const entry = { event_id: event.id, item_id: addItemId, qty_needed: addQty, packed: false, returned: false };
      if (addTrailerId) entry.trailer_id = addTrailerId;
      const created = await api.addPacking(entry);
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

  // Filter packing by active tab
  const visiblePacking = activeTab === "all"
    ? eventPacking
    : activeTab === "unassigned"
    ? eventPacking.filter(p => !p.trailer_id)
    : eventPacking.filter(p => p.trailer_id === activeTab);

  const activeTrailer = assignedTrailers.find(t => t.id === activeTab);

  // Group by category
  const grouped = {};
  visiblePacking.forEach(p => {
    const item = items.find(i => i.id === p.item_id);
    if (!item) return;
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push({ ...p, item });
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: m ? 14 : 16 }}>
      <button style={{ ...ghostBtn, alignSelf: "flex-start", fontSize: m ? 14 : 13 }} onClick={() => setView("events")}>← {m ? "Events" : "Back to Events"}</button>

      {/* Event header */}
      <div className="card" style={{ padding: m ? 14 : 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: total > 0 ? 14 : 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flex: 1, minWidth: 0 }}>
            {event.logo_url && <img src={event.logo_url} alt="" style={{ width: m ? 44 : 56, height: m ? 44 : 56, objectFit: "contain", borderRadius: 8, border: "1px solid #e5e7eb", flexShrink: 0 }} />}
            <div style={{ minWidth: 0 }}>
              <span className="pill" style={{ background: sc.bg, color: sc.color, marginBottom: 6, display: "inline-flex" }}>{sc.label}</span>
              <div style={{ fontWeight: 700, fontSize: m ? 16 : 20, lineHeight: 1.2, marginBottom: 3 }}>{event.name}</div>
              <div style={{ fontSize: m ? 13 : 14, color: "#6b7280" }}>{event.location}{event.date ? ` · ${event.date}` : ""}</div>
              {assignedTrailers.length > 0 && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 3 }}>🚛 {assignedTrailers.map(t => `Trailer ${t.number}`).join(", ")}</div>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flexShrink: 0 }}>
            <button style={{ ...ghostBtn, fontSize: 12, padding: m ? "7px 10px" : "6px 12px" }} onClick={() => setShowEdit(true)}>Edit</button>
            <button style={{ ...ghostBtn, fontSize: 12, padding: m ? "7px 10px" : "6px 12px" }} onClick={() => setShowTrailerManager(true)}>🚛 Trailers</button>
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

      {/* Trailer tabs */}
      {assignedTrailers.length > 0 && (
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2, alignItems: "center" }}>
          <button className={`trailer-tab ${activeTab === "all" ? "active" : ""}`} onClick={() => setActiveTab("all")}>All Items</button>
          {assignedTrailers.map(t => (
            <button key={t.id} className={`trailer-tab ${activeTab === t.id ? "active" : ""}`} onClick={() => setActiveTab(t.id)}>
              🚛 {t.number}
            </button>
          ))}
          <button className={`trailer-tab ${activeTab === "unassigned" ? "active" : ""}`} onClick={() => setActiveTab("unassigned")}>Unassigned</button>
          {activeTrailer && (
            <button onClick={() => setShowDiagram(d => !d)}
              style={{ marginLeft: "auto", padding: "6px 12px", borderRadius: 8, fontSize: 12, fontFamily: "inherit", cursor: "pointer", border: "1px solid #e5e7eb", background: showDiagram ? "#1a1a2e" : "#fff", color: showDiagram ? "#fff" : "#374151", whiteSpace: "nowrap", flexShrink: 0 }}>
              {showDiagram ? "Hide Diagram" : "Show Diagram"}
            </button>
          )}
        </div>
      )}

      {/* Trailer diagram */}
      {activeTrailer && showDiagram && (
        <TrailerDiagram
          trailer={activeTrailer}
          packingEntries={visiblePacking.map(p => ({ ...p, item: items.find(i => i.id === p.item_id) }))}
          items={items}
        />
      )}

      {/* Packing list header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: m ? 15 : 14, fontWeight: 600 }}>
          {activeTab === "all" ? "All Items" : activeTab === "unassigned" ? "Unassigned Items" : `Trailer ${activeTrailer?.number}`}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {otherEvents.length > 0 && <button style={{ ...ghostBtn, fontSize: m ? 13 : 12, padding: m ? "8px 12px" : "7px 14px" }} onClick={() => { setCopyEventId(otherEvents[0].id); setShowCopy(true); }}>Copy</button>}
          <button style={{ ...primaryBtn, padding: m ? "8px 14px" : "8px 16px" }} onClick={() => { setAddItemId(availableToAdd[0]?.id || ""); setAddQty(1); setAddTrailerId(activeTab !== "all" && activeTab !== "unassigned" ? activeTab : ""); setShowAddItem(true); }}>+ Add Item</button>
        </div>
      </div>

      {Object.keys(grouped).length === 0 && (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
          {activeTab === "unassigned" ? "No unassigned items" : "No items yet — add from inventory or copy from another event"}
        </div>
      )}

      {Object.entries(grouped).map(([cat, entries]) => (
        <div key={cat}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>{cat}</div>
          <div className="card" style={{ overflow: "hidden" }}>
            {entries.map((entry, i) => {
              const entryTrailer = trailers.find(t => t.id === entry.trailer_id);
              return (
                <div key={entry.id} style={{ padding: m ? "14px 16px" : "12px 16px", borderBottom: i < entries.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                  {m ? (
                    <>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontWeight: 500, fontSize: 15, textDecoration: entry.returned ? "line-through" : "none", color: entry.returned ? "#9ca3af" : "#111" }}>{entry.item.name}</span>
                          {assignedTrailers.length > 0 && (
                            <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                              {assignedTrailers.map(t => (
                                <button key={t.id} onClick={() => assignTrailerToItem(entry, t.id)}
                                  style={{ padding: "4px 10px", borderRadius: 99, fontSize: 12, fontFamily: "inherit", cursor: "pointer", fontWeight: 500, border: `1px solid ${entry.trailer_id === t.id ? "#1a1a2e" : "#e5e7eb"}`, background: entry.trailer_id === t.id ? "#1a1a2e" : "#fff", color: entry.trailer_id === t.id ? "#fff" : "#6b7280" }}>
                                  🚛 {t.number}
                                </button>
                              ))}
                            </div>
                          )}
                          {entry.item.notes && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{entry.item.notes}</div>}
                          {/* Qty editor mobile */}
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                            <button style={{ ...ghostBtn, padding: "2px 10px", fontSize: 16, lineHeight: 1 }} onClick={() => updateQty(entry, entry.qty_needed - 1)}>−</button>
                            <input type="number" value={entry.qty_needed} min={1}
                              onChange={e => updateQty(entry, Number(e.target.value))}
                              style={{ width: 52, textAlign: "center", padding: "5px 6px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 15, fontFamily: "inherit" }} />
                            <button style={{ ...ghostBtn, padding: "2px 10px", fontSize: 16, lineHeight: 1 }} onClick={() => updateQty(entry, entry.qty_needed + 1)}>+</button>
                            <span style={{ fontSize: 12, color: "#9ca3af" }}>needed</span>
                          </div>
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
                        {assignedTrailers.length > 0 && (
                          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                            {assignedTrailers.map(t => (
                              <button key={t.id} onClick={() => assignTrailerToItem(entry, t.id)}
                                style={{ padding: "3px 9px", borderRadius: 99, fontSize: 11, fontFamily: "inherit", cursor: "pointer", fontWeight: 500, border: `1px solid ${entry.trailer_id === t.id ? "#1a1a2e" : "#e5e7eb"}`, background: entry.trailer_id === t.id ? "#1a1a2e" : "#fff", color: entry.trailer_id === t.id ? "#fff" : "#6b7280" }}>
                                🚛 {t.number}
                              </button>
                            ))}
                          </div>
                        )}
                        {entry.item.notes && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{entry.item.notes}</div>}
                      </div>
                      {/* Qty editor desktop */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <button style={{ ...ghostBtn, padding: "2px 8px", fontSize: 14, lineHeight: 1 }} onClick={() => updateQty(entry, entry.qty_needed - 1)}>−</button>
                        <input type="number" value={entry.qty_needed} min={1}
                          onChange={e => updateQty(entry, Number(e.target.value))}
                          style={{ width: 46, textAlign: "center", padding: "3px 6px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 13, fontFamily: "inherit" }} />
                        <button style={{ ...ghostBtn, padding: "2px 8px", fontSize: 14, lineHeight: 1 }} onClick={() => updateQty(entry, entry.qty_needed + 1)}>+</button>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11, color: "#9ca3af" }}>Returned</span>
                        <div className={`check-box-desktop ${entry.returned ? "checked" : ""}`} onClick={() => toggleField(entry, "returned")}>{entry.returned && <Checkmark />}</div>
                      </div>
                      <button style={{ ...dangerBtn, padding: "4px 8px", fontSize: 11 }} onClick={() => removeFromList(entry.id)}>✕</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Trailer manager modal */}
      {showTrailerManager && (
        <Modal title="Manage Trailers for This Event" onClose={() => setShowTrailerManager(false)} onSave={() => setShowTrailerManager(false)} saveLabel="Done" saving={false} isMobile={m} wide>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Assigned Trailers</div>
          {assignedTrailers.length === 0 && <div style={{ fontSize: 13, color: "#9ca3af" }}>No trailers assigned yet</div>}
          {assignedTrailers.map(t => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#f8f9fb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>🚛 Trailer {t.number}</span>
              <span style={{ fontSize: 12, color: "#9ca3af" }}>{t.door_type === "barn" ? "Barn doors" : "Roll-up"}</span>
              <button style={dangerBtn} onClick={() => unassignTrailer(t.id)}>Remove</button>
            </div>
          ))}
          {unassignedTrailers.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginTop: 8 }}>Add Trailer</div>
              {unassignedTrailers.map(t => (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>🚛 Trailer {t.number}</span>
                  <span style={{ fontSize: 12, color: "#9ca3af" }}>{t.door_type === "barn" ? "Barn doors" : "Roll-up"}</span>
                  <button style={{ ...primaryBtn, fontSize: 12, padding: "6px 12px" }} onClick={() => assignTrailer(t.id)}>Assign</button>
                </div>
              ))}
            </>
          )}
        </Modal>
      )}

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
          {assignedTrailers.length > 0 && (
            <>
              <label style={labelStyle}>Assign to Trailer (optional)</label>
              <select value={addTrailerId} onChange={e => setAddTrailerId(e.target.value)} style={iStyle}>
                <option value="">No trailer assigned</option>
                {assignedTrailers.map(t => <option key={t.id} value={t.id}>Trailer {t.number}</option>)}
              </select>
            </>
          )}
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

// ─── Reports View (main app) ──────────────────────────────────────────────────
function Reports({ isMobile: m, reports, setReports, reportItems, events, areas, setAreas, areaItems, setAreaItems, items, setItems, showToast }) {
  const [activeSection, setActiveSection] = useState("submitted"); // submitted | areas | low-stock
  const iStyle = m ? inputStyleMobile : inputStyle;

  // Low stock items
  const lowStockItems = items.filter(i => i.is_consumable && i.low_threshold > 0 && i.qty <= i.low_threshold);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: m ? 14 : 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: m ? 20 : 22, fontWeight: 600, marginBottom: 4 }}>Reports</h1>
          <p style={{ color: "#6b7280", fontSize: 14 }}>{reports.length} submitted reports</p>
        </div>
        <a href="/report" target="_blank" rel="noopener noreferrer"
          style={{ ...primaryBtn, textDecoration: "none", display: "inline-block", padding: m ? "9px 13px" : "8px 16px", fontSize: 13 }}>
          📋 Open Report Form ↗
        </a>
      </div>

      {/* Section tabs */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
        {[
          { id: "submitted", label: "Submitted Reports" },
          { id: "areas", label: "Manage Areas" },
          { id: "low-stock", label: `⚠ Low Stock${lowStockItems.length > 0 ? ` (${lowStockItems.length})` : ""}` },
        ].map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, fontFamily: "inherit", cursor: "pointer", fontWeight: 500, border: `1px solid ${activeSection === s.id ? "#1a1a2e" : "#e5e7eb"}`, background: activeSection === s.id ? "#1a1a2e" : "#fff", color: activeSection === s.id ? "#fff" : "#374151", whiteSpace: "nowrap" }}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Submitted Reports */}
      {activeSection === "submitted" && (
        <SubmittedReports reports={reports} reportItems={reportItems} events={events} areas={areas} items={items} isMobile={m} />
      )}

      {/* Manage Areas */}
      {activeSection === "areas" && (
        <AreaManager areas={areas} setAreas={setAreas} areaItems={areaItems} setAreaItems={setAreaItems} items={items} setItems={setItems} showToast={showToast} isMobile={m} />
      )}

      {/* Low Stock */}
      {activeSection === "low-stock" && (
        <div>
          {lowStockItems.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
              ✅ All consumables are well stocked
            </div>
          ) : (
            <div className="card" style={{ overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", background: "#fef2f2", borderBottom: "1px solid #fecaca" }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "#dc2626" }}>⚠ Items Below Threshold</div>
                <div style={{ fontSize: 13, color: "#ef4444", marginTop: 2 }}>These consumables need restocking before the next event</div>
              </div>
              {lowStockItems.map((item, i) => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: i < lowStockItems.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{item.name}</div>
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>{item.category}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#dc2626" }}>{item.qty}</div>
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>threshold: {item.low_threshold}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Submitted Reports ────────────────────────────────────────────────────────
function SubmittedReports({ reports, reportItems, events, areas, items, isMobile: m }) {
  const [expandedId, setExpandedId] = useState(null);
  const [localReports, setLocalReports] = useState(reports);

  // Keep in sync with parent
  useEffect(() => { setLocalReports(reports); }, [reports]);

  const deleteReport = async (reportId, e) => {
    e.stopPropagation();
    if (!window.confirm("Delete this report? This cannot be undone.")) return;
    try {
      await sb(`report_items?report_id=eq.${reportId}`, { method: "DELETE" });
      await sb(`event_reports?id=eq.${reportId}`, { method: "DELETE" });
      setLocalReports(prev => prev.filter(r => r.id !== reportId));
    } catch { alert("Error deleting report"); }
  };

  if (localReports.length === 0) {
    return (
      <div className="card" style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
        No reports submitted yet. Share the report link with your staff after the event.
      </div>
    );
  }

  // Group by event, sorted by most recent event first
  const byEvent = {};
  localReports.forEach(r => {
    if (!byEvent[r.event_id]) byEvent[r.event_id] = [];
    byEvent[r.event_id].push(r);
  });

  // Sort events by most recent submission
  const sortedEventIds = Object.keys(byEvent).sort((a, b) => {
    const latestA = Math.max(...byEvent[a].map(r => new Date(r.submitted_at)));
    const latestB = Math.max(...byEvent[b].map(r => new Date(r.submitted_at)));
    return latestB - latestA;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {sortedEventIds.map(eventId => {
        const event = events.find(e => e.id === eventId);
        const eventReports = byEvent[eventId].sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
        const totalIssues = eventReports.reduce((sum, r) => sum + reportItems.filter(ri => ri.report_id === r.id && ri.had_issue).length, 0);
        return (
          <div key={eventId}>
            {/* Event header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{event?.name || "Unknown Event"}</div>
                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{eventReports.length} report{eventReports.length > 1 ? "s" : ""} submitted</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {totalIssues > 0 && <span style={{ background: "#fef2f2", color: "#dc2626", padding: "4px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600 }}>⚠ {totalIssues} issue{totalIssues > 1 ? "s" : ""}</span>}
              </div>
            </div>

            <div className="card" style={{ overflow: "hidden" }}>
              {eventReports.map((report, i) => {
                const area = areas.find(a => a.id === report.area_id);
                const rItems = reportItems.filter(ri => ri.report_id === report.id);
                const issues = rItems.filter(ri => ri.had_issue);
                const isExpanded = expandedId === report.id;
                const submittedDate = new Date(report.submitted_at);
                return (
                  <div key={report.id} style={{ borderBottom: i < eventReports.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer" }}
                      onClick={() => setExpandedId(isExpanded ? null : report.id)}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 15 }}>{report.staff_name}</div>
                        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3, display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ background: "#f3f4f6", padding: "2px 8px", borderRadius: 99 }}>{area?.name || "Unknown area"}</span>
                          <span>{submittedDate.toLocaleDateString()} {submittedDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                        {issues.length > 0 && <span style={{ background: "#fef2f2", color: "#dc2626", padding: "2px 8px", borderRadius: 99, fontSize: 12, fontWeight: 500 }}>⚠ {issues.length}</span>}
                        <button style={{ ...dangerBtn, padding: "4px 8px", fontSize: 12 }} onClick={(e) => deleteReport(report.id, e)}>Delete</button>
                        <span style={{ color: "#9ca3af", fontSize: 16 }}>{isExpanded ? "▴" : "▾"}</span>
                      </div>
                    </div>
                    {isExpanded && (
                      <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                        {rItems.length === 0 && !report.notes && (
                          <div style={{ fontSize: 13, color: "#9ca3af", fontStyle: "italic" }}>No item data in this report.</div>
                        )}
                        {rItems.map(ri => {
                          const item = items.find(i => i.id === ri.item_id);
                          return (
                            <div key={ri.id} style={{ background: ri.had_issue ? "#fef2f2" : "#f8f9fb", borderRadius: 8, padding: "10px 12px", border: `1px solid ${ri.had_issue ? "#fecaca" : "#e5e7eb"}` }}>
                              <div style={{ fontWeight: 500, fontSize: 13 }}>{item?.name || "Unknown item"}</div>
                              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3, display: "flex", gap: 12, flexWrap: "wrap" }}>
                                {ri.qty_used > 0 && <span>Used: <strong>{ri.qty_used}</strong></span>}
                                {ri.qty_remaining !== null && <span>Remaining: <strong>{ri.qty_remaining}</strong></span>}
                                {ri.had_issue
                                  ? <span style={{ color: "#dc2626" }}>⚠ Issue</span>
                                  : <span style={{ color: "#059669" }}>✓ No issues</span>}
                              </div>
                              {ri.had_issue && ri.issue_notes && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 4, fontStyle: "italic" }}>"{ri.issue_notes}"</div>}
                            </div>
                          );
                        })}
                        {report.notes && (
                          <div style={{ background: "#f8f9fb", borderRadius: 8, padding: "10px 12px", border: "1px solid #e5e7eb" }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>GENERAL NOTES</div>
                            <div style={{ fontSize: 13, color: "#374151" }}>{report.notes}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Area Manager ─────────────────────────────────────────────────────────────
function AreaManager({ areas, setAreas, areaItems, setAreaItems, items, setItems, showToast, isMobile: m }) {
  const [selectedAreaId, setSelectedAreaId] = useState(null);
  const [showAddArea, setShowAddArea] = useState(false);
  const [newAreaName, setNewAreaName] = useState("");
  const [saving, setSaving] = useState(false);
  const iStyle = m ? inputStyleMobile : inputStyle;

  const selectedArea = areas.find(a => a.id === selectedAreaId);
  const selectedAreaItems = areaItems.filter(ai => ai.area_id === selectedAreaId);
  const itemsNotInArea = items.filter(i => !selectedAreaItems.find(ai => ai.item_id === i.id));

  const addArea = async () => {
    if (!newAreaName.trim()) return;
    setSaving(true);
    try {
      const created = await api.addArea({ name: newAreaName.trim(), sort_order: areas.length + 1 });
      setAreas(prev => [...prev, created[0]]);
      setNewAreaName(""); setShowAddArea(false);
      showToast("Area added");
    } catch { showToast("Error adding area"); }
    setSaving(false);
  };

  const deleteArea = async (id) => {
    try {
      await api.deleteArea(id);
      setAreas(prev => prev.filter(a => a.id !== id));
      setAreaItems(prev => prev.filter(ai => ai.area_id !== id));
      if (selectedAreaId === id) setSelectedAreaId(null);
      showToast("Area removed");
    } catch { showToast("Error removing area"); }
  };

  const addItemToArea = async (itemId) => {
    try {
      const created = await api.addAreaItem({ area_id: selectedAreaId, item_id: itemId, is_consumable: false, low_threshold: 0 });
      setAreaItems(prev => [...prev, created[0]]);
      showToast("Item added to area");
    } catch { showToast("Error adding item"); }
  };

  const toggleConsumable = async (areaItem) => {
    try {
      await api.updateAreaItem(areaItem.id, { is_consumable: !areaItem.is_consumable });
      setAreaItems(prev => prev.map(ai => ai.id === areaItem.id ? { ...ai, is_consumable: !ai.is_consumable } : ai));
    } catch { showToast("Error updating"); }
  };

  const removeItemFromArea = async (id) => {
    try {
      await api.deleteAreaItem(id);
      setAreaItems(prev => prev.filter(ai => ai.id !== id));
      showToast("Item removed from area");
    } catch { showToast("Error removing item"); }
  };

  const updateItemConsumable = async (itemId, isConsumable) => {
    try {
      await api.updateItem(itemId, { is_consumable: isConsumable });
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, is_consumable: isConsumable } : i));
    } catch { showToast("Error updating item"); }
  };

  const updateLowThreshold = async (itemId, threshold) => {
    try {
      await api.updateItem(itemId, { low_threshold: threshold });
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, low_threshold: threshold } : i));
    } catch { showToast("Error updating threshold"); }
  };

  if (!selectedAreaId) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 14, color: "#6b7280" }}>Select an area to manage its items, or add a new area.</div>
        <div className="card" style={{ overflow: "hidden" }}>
          {areas.map((area, i) => (
            <div key={area.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderBottom: i < areas.length - 1 ? "1px solid #f3f4f6" : "none" }}>
              <div style={{ flex: 1, cursor: "pointer" }} onClick={() => setSelectedAreaId(area.id)}>
                <div style={{ fontWeight: 500, fontSize: 14 }}>{area.name}</div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>{areaItems.filter(ai => ai.area_id === area.id).length} items</div>
              </div>
              <button style={{ ...ghostBtn, fontSize: 12, padding: "6px 12px" }} onClick={() => setSelectedAreaId(area.id)}>Manage →</button>
              <button style={{ ...dangerBtn, padding: "5px 10px" }} onClick={() => deleteArea(area.id)}>Delete</button>
            </div>
          ))}
        </div>
        {showAddArea ? (
          <div style={{ display: "flex", gap: 8 }}>
            <input value={newAreaName} onChange={e => setNewAreaName(e.target.value)} style={{ ...iStyle, flex: 1 }} placeholder="New area name..." autoFocus onKeyDown={e => e.key === "Enter" && addArea()} />
            <button style={{ ...primaryBtn, width: "auto", padding: "8px 16px" }} onClick={addArea} disabled={saving}>Add</button>
            <button style={{ ...ghostBtn, width: "auto", padding: "8px 12px" }} onClick={() => setShowAddArea(false)}>✕</button>
          </div>
        ) : (
          <button style={{ ...ghostBtn, width: "100%" }} onClick={() => setShowAddArea(true)}>+ Add New Area</button>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button style={{ ...ghostBtn, padding: "7px 12px", fontSize: 13, width: "auto" }} onClick={() => setSelectedAreaId(null)}>← Areas</button>
        <div style={{ fontWeight: 600, fontSize: 16 }}>{selectedArea?.name}</div>
      </div>

      <div style={{ fontSize: 13, color: "#6b7280" }}>Items in this area will appear in the staff report form. Mark items as consumable to enable usage tracking.</div>

      {/* Items in area */}
      {selectedAreaItems.length > 0 && (
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "10px 16px", background: "#fafafa", borderBottom: "1px solid #f3f4f6", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Items in this area</div>
          {selectedAreaItems.map((ai, i) => {
            const item = items.find(it => it.id === ai.item_id);
            if (!item) return null;
            return (
              <div key={ai.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: i < selectedAreaItems.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: "#9ca3af" }}>{item.category}</div>
                  {ai.is_consumable && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                      <span style={{ fontSize: 12, color: "#6b7280" }}>Low threshold:</span>
                      <input type="number" min={0} defaultValue={item.low_threshold || 0}
                        onBlur={e => updateLowThreshold(item.id, Number(e.target.value))}
                        style={{ width: 60, padding: "3px 8px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 12, fontFamily: "inherit" }} />
                    </div>
                  )}
                </div>
                <button onClick={() => toggleConsumable(ai)}
                  style={{ padding: "5px 10px", borderRadius: 99, fontSize: 12, fontFamily: "inherit", cursor: "pointer", fontWeight: 500, border: `1px solid ${ai.is_consumable ? "#f59e0b" : "#e5e7eb"}`, background: ai.is_consumable ? "#fef3c7" : "#fff", color: ai.is_consumable ? "#d97706" : "#6b7280", whiteSpace: "nowrap" }}>
                  {ai.is_consumable ? "🔄 Consumable" : "Equipment"}
                </button>
                <button style={{ ...dangerBtn, padding: "5px 8px" }} onClick={() => removeItemFromArea(ai.id)}>✕</button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add items to area */}
      {itemsNotInArea.length > 0 && (
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "10px 16px", background: "#fafafa", borderBottom: "1px solid #f3f4f6", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Add Items to Area</div>
          {itemsNotInArea.map((item, i) => (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", borderBottom: i < itemsNotInArea.length - 1 ? "1px solid #f3f4f6" : "none" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 14 }}>{item.name}</div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>{item.category}</div>
              </div>
              <button style={{ ...primaryBtn, width: "auto", padding: "6px 12px", fontSize: 12 }} onClick={() => addItemToArea(item.id)}>+ Add</button>
            </div>
          ))}
        </div>
      )}

      {selectedAreaItems.length === 0 && itemsNotInArea.length === 0 && (
        <div className="card" style={{ padding: 32, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
          No items in your inventory yet. Add items first then assign them to areas.
        </div>
      )}
    </div>
  );
}

// ─── Tech Setups ──────────────────────────────────────────────────────────────

const DEVICE_TYPES = {
  router:  { label: "Router",          icon: "🌐", color: "#2563eb" },
  switch:  { label: "Switch",          icon: "🔀", color: "#7c3aed" },
  ap:      { label: "Access Point",    icon: "📡", color: "#059669" },
  ptp:     { label: "Point-to-Point",  icon: "🔗", color: "#d97706" },
  laptop:  { label: "Laptop",          icon: "💻", color: "#374151" },
  printer: { label: "Printer",         icon: "🖨️",  color: "#6b7280" },
  camera:  { label: "Camera",          icon: "📷", color: "#dc2626" },
};

const CONN_TYPES = {
  ethernet: { label: "Ethernet",     dash: "0",   color: "#374151" },
  fiber:    { label: "Fiber",        dash: "8,4", color: "#7c3aed" },
  ptp:      { label: "P2P Wireless", dash: "4,4", color: "#d97706" },
  wifi:     { label: "WiFi",         dash: "2,6", color: "#059669" },
};

function TechSetups({ isMobile: m, events, showToast }) {
  const [setups, setSetups] = useState([]);
  const [devices, setDevices] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [viewMode, setViewMode] = useState("canvas");
  const [placingType, setPlacingType] = useState(null);
  const [connectingFrom, setConnectingFrom] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [pendingPos, setPendingPos] = useState(null);
  const [showConnModal, setShowConnModal] = useState(false);
  const [pendingConn, setPendingConn] = useState(null);
  const [deviceForm, setDeviceForm] = useState({ label: "", network: "main", notes: "" });
  const [connForm, setConnForm] = useState({ connection_type: "ethernet", label: "" });
  const [saving, setSaving] = useState(false);
  const [uploadingFP, setUploadingFP] = useState(false);
  const canvasRef = useRef();
  const fpRef = useRef();
  const didDragRef = useRef(false);
  const iStyle = m ? inputStyleMobile : inputStyle;

  useEffect(() => {
    Promise.all([api.getTechSetups(), api.getTechDevices(), api.getTechConnections()])
      .then(([s, d, c]) => { setSetups(s); setDevices(d); setConnections(c); })
      .finally(() => setLoading(false));
  }, []);

  const selectedSetup = setups.find(s => s.event_id === selectedEventId);
  const setupDevices = selectedSetup ? devices.filter(d => d.setup_id === selectedSetup.id) : [];
  const setupConns = selectedSetup ? connections.filter(c => c.setup_id === selectedSetup.id) : [];
  const selectedEvent = events.find(e => e.id === selectedEventId);

  const ensureSetup = async () => {
    if (selectedSetup) return selectedSetup;
    const [s] = await api.addTechSetup({ event_id: selectedEventId, notes: "" });
    setSetups(prev => [...prev, s]);
    return s;
  };

  const handleCanvasClick = (e) => {
    if (didDragRef.current) { didDragRef.current = false; return; }
    if (!placingType || !selectedEventId) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x_pct = ((e.clientX - rect.left) / rect.width) * 100;
    const y_pct = ((e.clientY - rect.top) / rect.height) * 100;
    setPendingPos({ type: placingType, x_pct, y_pct });
    setDeviceForm({ label: DEVICE_TYPES[placingType].label, network: "main", notes: "" });
    setShowDeviceModal(true);
  };

  const saveDevice = async () => {
    if (!deviceForm.label.trim()) return;
    setSaving(true);
    try {
      const setup = await ensureSetup();
      const [d] = await api.addTechDevice({
        setup_id: setup.id, type: pendingPos.type,
        label: deviceForm.label, x_pct: pendingPos.x_pct, y_pct: pendingPos.y_pct,
        network: deviceForm.network, notes: deviceForm.notes,
      });
      setDevices(prev => [...prev, d]);
      setShowDeviceModal(false); setPlacingType(null);
      showToast("Device added");
    } catch { showToast("Error saving device"); }
    setSaving(false);
  };

  const deleteDevice = async (id) => {
    try {
      await api.deleteTechDevice(id);
      const toDelete = connections.filter(c => c.from_device_id === id || c.to_device_id === id);
      await Promise.all(toDelete.map(c => api.deleteTechConnection(c.id)));
      setDevices(prev => prev.filter(d => d.id !== id));
      setConnections(prev => prev.filter(c => c.from_device_id !== id && c.to_device_id !== id));
      showToast("Device removed");
    } catch { showToast("Error removing device"); }
  };

  const handleDeviceClick = (e, deviceId) => {
    e.stopPropagation();
    if (didDragRef.current) return;
    if (placingType) return;
    if (connectingFrom === null) {
      setConnectingFrom(deviceId);
    } else if (connectingFrom === deviceId) {
      setConnectingFrom(null);
    } else {
      const exists = connections.find(c =>
        (c.from_device_id === connectingFrom && c.to_device_id === deviceId) ||
        (c.from_device_id === deviceId && c.to_device_id === connectingFrom)
      );
      if (exists) { setConnectingFrom(null); showToast("Already connected"); return; }
      setPendingConn({ from: connectingFrom, to: deviceId });
      setConnForm({ connection_type: "ethernet", label: "" });
      setShowConnModal(true);
      setConnectingFrom(null);
    }
  };

  const saveConnection = async () => {
    setSaving(true);
    try {
      const setup = await ensureSetup();
      const [c] = await api.addTechConnection({
        setup_id: setup.id, from_device_id: pendingConn.from,
        to_device_id: pendingConn.to, connection_type: connForm.connection_type, label: connForm.label,
      });
      setConnections(prev => [...prev, c]);
      setShowConnModal(false); showToast("Connection added");
    } catch { showToast("Error adding connection"); }
    setSaving(false);
  };

  const deleteConnection = async (id) => {
    try {
      await api.deleteTechConnection(id);
      setConnections(prev => prev.filter(c => c.id !== id));
      showToast("Connection removed");
    } catch { showToast("Error removing connection"); }
  };

  const startDrag = (e, device) => {
    if (placingType) return;
    e.stopPropagation();
    didDragRef.current = false;
    const rect = canvasRef.current.getBoundingClientRect();
    setDragging({ id: device.id, startX: e.clientX, startY: e.clientY, origX: device.x_pct, origY: device.y_pct, rectW: rect.width, rectH: rect.height });
  };

  const onMouseMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - dragging.startX;
    const dy = e.clientY - dragging.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) didDragRef.current = true;
    const newX = Math.max(2, Math.min(98, dragging.origX + (dx / dragging.rectW) * 100));
    const newY = Math.max(2, Math.min(98, dragging.origY + (dy / dragging.rectH) * 100));
    setDevices(prev => prev.map(d => d.id === dragging.id ? { ...d, x_pct: newX, y_pct: newY } : d));
  };

  const onMouseUp = async () => {
    if (!dragging) return;
    const device = devices.find(d => d.id === dragging.id);
    if (device && didDragRef.current) {
      try { await api.updateTechDevice(dragging.id, { x_pct: device.x_pct, y_pct: device.y_pct }); }
      catch { showToast("Error saving position"); }
    }
    setDragging(null);
  };

  const uploadFloorPlan = async (file) => {
    setUploadingFP(true);
    try {
      const path = `floorplan-${selectedEventId}-${Date.now()}.${file.name.split(".").pop()}`;
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/logos/${path}`, {
        method: "POST",
        headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Content-Type": file.type, "x-upsert": "true" },
        body: file,
      });
      if (!res.ok) throw new Error(await res.text());
      const url = `${SUPABASE_URL}/storage/v1/object/public/logos/${path}`;
      const setup = await ensureSetup();
      await api.updateTechSetup(setup.id, { floor_plan_url: url });
      setSetups(prev => prev.map(s => s.id === setup.id ? { ...s, floor_plan_url: url } : s));
      showToast("Floor plan uploaded");
    } catch { showToast("Upload failed"); }
    setUploadingFP(false);
  };

  const removeFloorPlan = async () => {
    if (!selectedSetup) return;
    await api.updateTechSetup(selectedSetup.id, { floor_plan_url: null });
    setSetups(prev => prev.map(s => s.id === selectedSetup.id ? { ...s, floor_plan_url: null } : s));
  };

  const buildGuideSteps = () => {
    const steps = [];
    const visited = new Set();
    const inbound = new Set(setupConns.map(c => c.to_device_id));
    const queue = setupDevices.filter(d => !inbound.has(d.id)).map(d => d.id);
    while (queue.length) {
      const id = queue.shift();
      if (visited.has(id)) continue;
      visited.add(id);
      const device = setupDevices.find(d => d.id === id);
      if (!device) continue;
      steps.push({ type: "device", device });
      setupConns.filter(c => c.from_device_id === id).forEach(c => {
        const to = setupDevices.find(d => d.id === c.to_device_id);
        if (to) { steps.push({ type: "conn", conn: c, from: device, to }); queue.push(c.to_device_id); }
      });
    }
    setupDevices.filter(d => !visited.has(d.id)).forEach(d => steps.push({ type: "device", device: d }));
    return steps;
  };

  const floorPlanUrl = selectedSetup?.floor_plan_url;

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Loading tech setups...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: m ? 14 : 20 }}
      onKeyDown={e => { if (e.key === "Escape") { setPlacingType(null); setConnectingFrom(null); } }} tabIndex={-1}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ fontSize: m ? 20 : 22, fontWeight: 600, marginBottom: 4 }}>Tech Setups</h1>
          <p style={{ color: "#6b7280", fontSize: 14 }}>Network diagrams per event</p>
        </div>
        {selectedEventId && (
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ ...ghostBtn, background: viewMode === "canvas" ? "#1a1a2e" : "none", color: viewMode === "canvas" ? "#fff" : "#374151" }} onClick={() => setViewMode("canvas")}>Diagram</button>
            <button style={{ ...ghostBtn, background: viewMode === "guide" ? "#1a1a2e" : "none", color: viewMode === "guide" ? "#fff" : "#374151" }} onClick={() => setViewMode("guide")}>Setup Guide</button>
          </div>
        )}
      </div>

      {/* Event selector */}
      <div className="card" style={{ padding: m ? "12px 16px" : "14px 20px" }}>
        <label style={{ ...labelStyle, display: "block", marginBottom: 8 }}>Select Event</label>
        <select value={selectedEventId} onChange={e => { setSelectedEventId(e.target.value); setPlacingType(null); setConnectingFrom(null); }} style={iStyle}>
          <option value="">— Choose an event —</option>
          {events.map(e => <option key={e.id} value={e.id}>{e.name}{e.date ? ` · ${e.date}` : ""}</option>)}
        </select>
      </div>

      {!selectedEventId && (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
          Select an event above to view or build its network tech setup
        </div>
      )}

      {/* ── Diagram view ── */}
      {selectedEventId && viewMode === "canvas" && (
        <>
          {/* Device palette */}
          <div className="card" style={{ padding: m ? "12px 16px" : "14px 20px" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
              {placingType
                ? `Placing: ${DEVICE_TYPES[placingType].icon} ${DEVICE_TYPES[placingType].label} — click the diagram`
                : connectingFrom
                ? `Connecting from: ${setupDevices.find(d => d.id === connectingFrom)?.label || "?"} — click target device (Esc to cancel)`
                : "Add devices — pick a type then click the diagram to place it"}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {Object.entries(DEVICE_TYPES).map(([type, cfg]) => (
                <button key={type}
                  onClick={() => { setPlacingType(placingType === type ? null : type); setConnectingFrom(null); }}
                  style={{ padding: "6px 12px", borderRadius: 8, fontSize: 13, fontFamily: "inherit", cursor: "pointer", fontWeight: 500,
                    border: `1px solid ${placingType === type ? cfg.color : "#e5e7eb"}`,
                    background: placingType === type ? cfg.color + "18" : "#fff",
                    color: placingType === type ? cfg.color : "#374151" }}>
                  {cfg.icon} {cfg.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "#9ca3af" }}>Floor plan:</span>
              <button style={{ ...ghostBtn, fontSize: 12, padding: "5px 10px" }} onClick={() => fpRef.current.click()} disabled={uploadingFP}>
                {uploadingFP ? "Uploading..." : floorPlanUrl ? "Change Image" : "Upload Image"}
              </button>
              {floorPlanUrl && <button style={{ ...dangerBtn, fontSize: 12, padding: "5px 10px" }} onClick={removeFloorPlan}>Remove</button>}
              {floorPlanUrl && <span style={{ fontSize: 12, color: "#059669" }}>✓ Floor plan loaded</span>}
              <input ref={fpRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) uploadFloorPlan(e.target.files[0]); e.target.value = ""; }} />
            </div>
          </div>

          {/* Canvas */}
          <div
            ref={canvasRef}
            onClick={handleCanvasClick}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            style={{
              position: "relative", width: "100%", paddingTop: m ? "75%" : "56.25%",
              background: "#f1f5f9",
              backgroundImage: floorPlanUrl ? `url(${floorPlanUrl})` : "none",
              backgroundSize: "cover", backgroundPosition: "center",
              borderRadius: 12, border: `2px ${placingType ? "dashed #2563eb" : connectingFrom ? "dashed #d97706" : "solid #e5e7eb"}`,
              cursor: placingType ? "crosshair" : connectingFrom ? "cell" : "default",
              overflow: "hidden", userSelect: "none",
            }}>

            {/* Grid */}
            {!floorPlanUrl && (
              <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.25 }}>
                <defs>
                  <pattern id="tgrid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#64748b" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#tgrid)" />
              </svg>
            )}

            {/* Floor plan overlay tint */}
            {floorPlanUrl && <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.12)" }} />}

            {/* Connection lines */}
            <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
              {setupConns.map(conn => {
                const from = setupDevices.find(d => d.id === conn.from_device_id);
                const to = setupDevices.find(d => d.id === conn.to_device_id);
                if (!from || !to) return null;
                const cfg = CONN_TYPES[conn.connection_type] || CONN_TYPES.ethernet;
                const mx = (from.x_pct + to.x_pct) / 2;
                const my = (from.y_pct + to.y_pct) / 2;
                return (
                  <g key={conn.id}>
                    <line x1={`${from.x_pct}%`} y1={`${from.y_pct}%`} x2={`${to.x_pct}%`} y2={`${to.y_pct}%`}
                      stroke={cfg.color} strokeWidth="2.5" strokeDasharray={cfg.dash} opacity="0.85" />
                    {conn.label && (
                      <text x={`${mx}%`} y={`${my}%`} textAnchor="middle" dy="-5"
                        fill={cfg.color} fontSize="10" fontWeight="600"
                        style={{ paintOrder: "stroke", stroke: "#fff", strokeWidth: 3 }}>
                        {conn.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Devices */}
            {setupDevices.map(device => {
              const cfg = DEVICE_TYPES[device.type] || DEVICE_TYPES.ap;
              const netColor = device.network === "photo_video" ? "#ea580c" : "#2563eb";
              const isFrom = connectingFrom === device.id;
              return (
                <div key={device.id}
                  style={{
                    position: "absolute", left: `${device.x_pct}%`, top: `${device.y_pct}%`,
                    transform: "translate(-50%,-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                    cursor: dragging?.id === device.id ? "grabbing" : (connectingFrom !== null && !isFrom) ? "cell" : "grab",
                    zIndex: dragging?.id === device.id ? 10 : 5,
                  }}
                  onMouseDown={e => startDrag(e, device)}
                  onClick={e => handleDeviceClick(e, device.id)}>
                  <div style={{
                    width: m ? 40 : 48, height: m ? 40 : 48, borderRadius: 10, background: "#fff",
                    border: `2.5px solid ${isFrom ? "#d97706" : netColor}`,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: m ? 20 : 24,
                    boxShadow: isFrom ? "0 0 0 3px #d97706aa" : "0 2px 8px rgba(0,0,0,0.15)",
                  }}>
                    {cfg.icon}
                  </div>
                  <div style={{
                    background: "rgba(255,255,255,0.93)", borderRadius: 4, padding: "2px 6px",
                    fontSize: 10, fontWeight: 600, color: "#1a1a2e", maxWidth: 80, textAlign: "center",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)", border: `1px solid ${netColor}30`,
                  }}>
                    {device.label}
                  </div>
                  {device.network === "photo_video" && (
                    <div style={{ fontSize: 8, color: "#ea580c", fontWeight: 700, background: "#fff7ed", borderRadius: 3, padding: "1px 4px" }}>PV</div>
                  )}
                </div>
              );
            })}

            {/* Empty state */}
            {setupDevices.length === 0 && !placingType && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                <div style={{ textAlign: "center", color: "#94a3b8" }}>
                  <div style={{ fontSize: 40, marginBottom: 10 }}>📶</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>Pick a device type above,</div>
                  <div style={{ fontSize: 13 }}>then click here to place it</div>
                </div>
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="card" style={{ padding: m ? "12px 16px" : "14px 20px" }}>
            <div style={{ display: "flex", gap: m ? 16 : 32, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Networks</div>
                <div style={{ display: "flex", gap: 12 }}>
                  {[{ label: "Main", color: "#2563eb", bg: "#eff6ff" }, { label: "Photo/Video", color: "#ea580c", bg: "#fff7ed" }].map(n => (
                    <div key={n.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
                      <div style={{ width: 12, height: 12, borderRadius: 3, border: `2px solid ${n.color}`, background: n.bg }} />{n.label}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Connections</div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {Object.entries(CONN_TYPES).map(([, cfg]) => (
                    <div key={cfg.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                      <svg width="22" height="8"><line x1="0" y1="4" x2="22" y2="4" stroke={cfg.color} strokeWidth="2" strokeDasharray={cfg.dash} /></svg>
                      {cfg.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: "#9ca3af" }}>
              Tip: Click a device to start connecting — then click another device to link them. Drag to reposition. Press Esc to cancel.
            </div>
          </div>

          {/* Devices list */}
          {setupDevices.length > 0 && (
            <div className="card" style={{ overflow: "hidden" }}>
              <div style={{ padding: "10px 16px", fontWeight: 600, fontSize: 13, borderBottom: "1px solid #f3f4f6", color: "#374151" }}>
                Devices ({setupDevices.length})
              </div>
              {setupDevices.map((d, i) => {
                const cfg = DEVICE_TYPES[d.type] || DEVICE_TYPES.ap;
                const netColor = d.network === "photo_video" ? "#ea580c" : "#2563eb";
                return (
                  <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", borderBottom: i < setupDevices.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                    <span style={{ fontSize: 18 }}>{cfg.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{d.label}</div>
                      <div style={{ fontSize: 12, color: "#9ca3af" }}>
                        {cfg.label}
                        <span style={{ marginLeft: 6, color: netColor, fontWeight: 500 }}>● {d.network === "photo_video" ? "Photo/Video" : "Main"}</span>
                        {d.notes && ` · ${d.notes}`}
                      </div>
                    </div>
                    <button style={{ ...dangerBtn, fontSize: 11, padding: "4px 8px" }} onClick={() => deleteDevice(d.id)}>Remove</button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Connections list */}
          {setupConns.length > 0 && (
            <div className="card" style={{ overflow: "hidden" }}>
              <div style={{ padding: "10px 16px", fontWeight: 600, fontSize: 13, borderBottom: "1px solid #f3f4f6", color: "#374151" }}>
                Connections ({setupConns.length})
              </div>
              {setupConns.map((conn, i) => {
                const from = setupDevices.find(d => d.id === conn.from_device_id);
                const to = setupDevices.find(d => d.id === conn.to_device_id);
                const cfg = CONN_TYPES[conn.connection_type] || CONN_TYPES.ethernet;
                return (
                  <div key={conn.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", borderBottom: i < setupConns.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                    <svg width="20" height="10" style={{ flexShrink: 0 }}><line x1="0" y1="5" x2="20" y2="5" stroke={cfg.color} strokeWidth="2" strokeDasharray={cfg.dash} /></svg>
                    <div style={{ flex: 1, fontSize: 13 }}>
                      <span style={{ fontWeight: 500 }}>{from?.label || "?"}</span>
                      <span style={{ color: "#9ca3af", margin: "0 6px" }}>→</span>
                      <span style={{ fontWeight: 500 }}>{to?.label || "?"}</span>
                      {conn.label && <span style={{ color: "#6b7280", marginLeft: 6 }}>({conn.label})</span>}
                      <span className="pill" style={{ background: "#f3f4f6", color: "#374151", fontSize: 11, marginLeft: 8 }}>{cfg.label}</span>
                    </div>
                    <button style={{ ...dangerBtn, fontSize: 11, padding: "4px 8px" }} onClick={() => deleteConnection(conn.id)}>Remove</button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Setup Guide view ── */}
      {selectedEventId && viewMode === "guide" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="card" style={{ padding: m ? "12px 16px" : "14px 20px", background: "#f0f9ff", borderColor: "#bae6fd" }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: "#0369a1", marginBottom: 4 }}>Setup Guide — {selectedEvent?.name}</div>
            <div style={{ fontSize: 13, color: "#0284c7" }}>Follow these steps in order. Start at the router and work outward through the network.</div>
          </div>
          {setupDevices.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
              No devices added yet — switch to Diagram view to build the setup
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {buildGuideSteps().map((step, i) => {
                if (step.type === "device") {
                  const cfg = DEVICE_TYPES[step.device.type] || DEVICE_TYPES.ap;
                  const netColor = step.device.network === "photo_video" ? "#ea580c" : "#2563eb";
                  return (
                    <div key={step.device.id} className="card" style={{ padding: m ? "12px 14px" : "14px 16px", display: "flex", gap: 14, alignItems: "flex-start", borderLeft: `4px solid ${netColor}` }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: netColor + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0, border: `1px solid ${netColor}30` }}>
                        {cfg.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{step.device.label}</div>
                        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                          {cfg.label} · {step.device.network === "photo_video" ? "Photo/Video Network" : "Main Network"}
                          {step.device.notes && <span style={{ fontStyle: "italic" }}> · {step.device.notes}</span>}
                        </div>
                      </div>
                      <div style={{ background: "#f3f4f6", color: "#6b7280", borderRadius: 99, padding: "2px 10px", fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                        {i + 1}
                      </div>
                    </div>
                  );
                } else {
                  const cfg = CONN_TYPES[step.conn.connection_type] || CONN_TYPES.ethernet;
                  return (
                    <div key={step.conn.id + "c"} style={{ display: "flex", gap: 12, alignItems: "center", paddingLeft: m ? 14 : 20 }}>
                      <div style={{ width: 2, background: cfg.color, alignSelf: "stretch", borderRadius: 1, opacity: 0.5, flexShrink: 0 }} />
                      <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#6b7280", padding: "6px 0", flexWrap: "wrap" }}>
                        <svg width="18" height="8" style={{ flexShrink: 0 }}><line x1="0" y1="4" x2="18" y2="4" stroke={cfg.color} strokeWidth="2" strokeDasharray={cfg.dash} /></svg>
                        <span>Connect <strong style={{ color: "#374151" }}>{step.from.label}</strong> → <strong style={{ color: "#374151" }}>{step.to.label}</strong></span>
                        <span style={{ color: cfg.color, fontSize: 12, fontWeight: 500 }}>{cfg.label}</span>
                        {step.conn.label && <span style={{ color: "#9ca3af" }}>({step.conn.label})</span>}
                      </div>
                    </div>
                  );
                }
              })}
            </div>
          )}
        </div>
      )}

      {/* Add Device modal */}
      {showDeviceModal && (
        <Modal title={`Add ${DEVICE_TYPES[pendingPos?.type]?.label || "Device"}`} onClose={() => { setShowDeviceModal(false); setPlacingType(null); }} onSave={saveDevice} saveLabel="Add to Diagram" saving={saving} isMobile={m}>
          <label style={labelStyle}>Label</label>
          <input value={deviceForm.label} onChange={e => setDeviceForm(f => ({ ...f, label: e.target.value }))} style={iStyle} placeholder="e.g. Main Router, AP-Stage-Left" autoFocus />
          <label style={labelStyle}>Network</label>
          <select value={deviceForm.network} onChange={e => setDeviceForm(f => ({ ...f, network: e.target.value }))} style={iStyle}>
            <option value="main">Main Network</option>
            <option value="photo_video">Photo / Video Network</option>
          </select>
          <label style={labelStyle}>Notes (optional)</label>
          <input value={deviceForm.notes} onChange={e => setDeviceForm(f => ({ ...f, notes: e.target.value }))} style={iStyle} placeholder="e.g. SSID: CheerNet, IP: 192.168.1.1" />
        </Modal>
      )}

      {/* Add Connection modal */}
      {showConnModal && (
        <Modal title="Add Connection" onClose={() => setShowConnModal(false)} onSave={saveConnection} saveLabel="Add Connection" saving={saving} isMobile={m}>
          <div style={{ background: "#f8f9fb", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#374151", fontWeight: 500 }}>
            {setupDevices.find(d => d.id === pendingConn?.from)?.label} → {setupDevices.find(d => d.id === pendingConn?.to)?.label}
          </div>
          <label style={labelStyle}>Connection Type</label>
          <select value={connForm.connection_type} onChange={e => setConnForm(f => ({ ...f, connection_type: e.target.value }))} style={iStyle} autoFocus>
            {Object.entries(CONN_TYPES).map(([t, cfg]) => <option key={t} value={t}>{cfg.label}</option>)}
          </select>
          <label style={labelStyle}>Label (optional)</label>
          <input value={connForm.label} onChange={e => setConnForm(f => ({ ...f, label: e.target.value }))} style={iStyle} placeholder="e.g. Cat6, Port 3, Channel 6" />
        </Modal>
      )}
    </div>
  );
}
