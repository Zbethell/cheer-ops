import { useState, useEffect, useCallback } from "react";

// ─── Supabase Config ──────────────────────────────────────────────────────────
const SUPABASE_URL = "https://peylonukcwsqdknchxda.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBleWxvbnVrY3dzcWRrbmNoeGRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MDQxOTYsImV4cCI6MjA5MzQ4MDE5Nn0.fTgnQxWxBDcHk0Xq-4KQJZH9xi4bYwle27tdrjseQ3k";

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
};

const CATEGORIES = ["AV / Tech", "Signage / Decor", "Apparel / Merch", "Office / Admin", "Competition / Floor", "Other"];
const STATUS_CONFIG = {
  completed: { label: "Completed", color: "#6b7280", bg: "#f3f4f6" },
  active: { label: "Active", color: "#059669", bg: "#ecfdf5" },
  upcoming: { label: "Upcoming", color: "#2563eb", bg: "#eff6ff" },
};

function Checkmark() {
  return <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function Modal({ title, onClose, onSave, saveLabel, saving, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500, padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", width: "100%", maxWidth: 440, padding: 24 }}>
        <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 20 }}>{title}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>{children}</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button style={{ background: "none", border: "1px solid #e5e7eb", padding: "7px 14px", borderRadius: 7, fontSize: 13, color: "#374151", cursor: "pointer" }} onClick={onClose}>Cancel</button>
          <button style={{ background: "#1a1a2e", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.5 : 1 }} onClick={onSave} disabled={saving}>{saving ? "Saving..." : saveLabel}</button>
        </div>
      </div>
    </div>
  );
}

const labelStyle = { fontSize: 13, fontWeight: 500, color: "#374151" };
const inputStyle = { padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 14, width: "100%", background: "#fff", outline: "none", fontFamily: "inherit" };

export default function App() {
  const [items, setItems] = useState([]);
  const [events, setEvents] = useState([]);
  const [packing, setPacking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState("dashboard");
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [i, e, p] = await Promise.all([api.getItems(), api.getEvents(), api.getAllPacking()]);
      setItems(i); setEvents(e); setPacking(p); setError(null);
    } catch { setError("Could not connect to database. Make sure your Supabase tables are set up correctly."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "DM Sans, sans-serif", color: "#6b7280" }}>Loading Cheer Ops...</div>;
  if (error) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "DM Sans, sans-serif", gap: 16, padding: 24 }}>
      <div style={{ fontSize: 32 }}>⚠️</div>
      <div style={{ fontWeight: 600 }}>Connection Error</div>
      <div style={{ color: "#6b7280", fontSize: 14, textAlign: "center", maxWidth: 400 }}>{error}</div>
      <button style={{ background: "#1a1a2e", color: "#fff", border: "none", padding: "8px 20px", borderRadius: 7, cursor: "pointer" }} onClick={loadAll}>Retry</button>
    </div>
  );

  const selectedEvent = events.find(e => e.id === selectedEventId);
  const eventPacking = packing.filter(p => p.event_id === selectedEventId);

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif", minHeight: "100vh", background: "#f8f9fb", color: "#1a1a2e" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        button { cursor: pointer; font-family: inherit; }
        input, select, textarea { font-family: inherit; }
        .nav-btn { background: none; border: none; padding: 8px 14px; border-radius: 6px; font-size: 14px; font-weight: 500; color: #6b7280; transition: all 0.15s; cursor: pointer; }
        .nav-btn:hover { background: #f3f4f6; color: #111; }
        .nav-btn.active { background: #1a1a2e; color: #fff; }
        .card { background: #fff; border-radius: 10px; border: 1px solid #e5e7eb; }
        .pill { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 99px; font-size: 12px; font-weight: 500; }
        .checkbox-custom { width: 18px; height: 18px; border: 2px solid #d1d5db; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; flex-shrink: 0; }
        .checkbox-custom.checked { background: #1a1a2e; border-color: #1a1a2e; }
        .toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: #1a1a2e; color: #fff; padding: 10px 20px; border-radius: 8px; font-size: 14px; z-index: 1000; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
      `}</style>

      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "0 24px", display: "flex", alignItems: "center", gap: 8, height: 56 }}>
        <span style={{ fontWeight: 600, fontSize: 16, marginRight: 12, letterSpacing: "-0.3px" }}>⭐ Cheer Ops</span>
        <button className={`nav-btn ${view === "dashboard" ? "active" : ""}`} onClick={() => setView("dashboard")}>Dashboard</button>
        <button className={`nav-btn ${view === "inventory" ? "active" : ""}`} onClick={() => setView("inventory")}>Inventory</button>
        <button className={`nav-btn ${["events", "event-detail"].includes(view) ? "active" : ""}`} onClick={() => setView("events")}>Events</button>
      </div>

      <div style={{ padding: "28px 24px", maxWidth: 960, margin: "0 auto" }}>
        {view === "dashboard" && <Dashboard items={items} events={events} packing={packing} setView={setView} setSelectedEventId={setSelectedEventId} />}
        {view === "inventory" && <Inventory items={items} setItems={setItems} showToast={showToast} />}
        {view === "events" && <Events events={events} setEvents={setEvents} packing={packing} setPacking={setPacking} setView={setView} setSelectedEventId={setSelectedEventId} showToast={showToast} />}
        {view === "event-detail" && selectedEvent && <EventDetail event={selectedEvent} events={events} setEvents={setEvents} items={items} eventPacking={eventPacking} packing={packing} setPacking={setPacking} setView={setView} showToast={showToast} />}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function Dashboard({ items, events, packing, setView, setSelectedEventId }) {
  const activeEvent = events.find(e => e.status === "active");
  const upcomingEvents = events.filter(e => e.status === "upcoming");
  const activePacking = activeEvent ? packing.filter(p => p.event_id === activeEvent.id) : [];
  const itemsOut = activePacking.filter(p => p.packed && !p.returned).length;
  const packingProgress = activePacking.length > 0 ? Math.round((activePacking.filter(p => p.packed).length / activePacking.length) * 100) : null;

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>Dashboard</h1>
      <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 24 }}>Your season at a glance</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        {[{ label: "Total Items", value: items.length, sub: "in master inventory" }, { label: "Items Out", value: itemsOut, sub: activeEvent ? `at ${activeEvent.name}` : "no active event" }, { label: "Events", value: events.length, sub: `${upcomingEvents.length} upcoming` }].map(s => (
          <div key={s.label} className="card" style={{ padding: "18px 20px" }}>
            <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-1px" }}>{s.value}</div>
            <div style={{ fontSize: 13, fontWeight: 500, marginTop: 2 }}>{s.label}</div>
            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>
      {activeEvent && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <span className="pill" style={{ background: "#ecfdf5", color: "#059669", marginBottom: 6, display: "inline-flex" }}>● Active Event</span>
              <div style={{ fontWeight: 600, fontSize: 16 }}>{activeEvent.name}</div>
              <div style={{ fontSize: 13, color: "#6b7280" }}>{activeEvent.location} · {activeEvent.date}</div>
            </div>
            <button style={{ background: "#1a1a2e", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer" }} onClick={() => { setSelectedEventId(activeEvent.id); setView("event-detail"); }}>Open →</button>
          </div>
          {packingProgress !== null && (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, background: "#f3f4f6", borderRadius: 99, height: 8, overflow: "hidden" }}>
                <div style={{ width: `${packingProgress}%`, background: "#1a1a2e", height: "100%", borderRadius: 99, transition: "width 0.3s" }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap" }}>{packingProgress}% packed</span>
            </div>
          )}
        </div>
      )}
      {upcomingEvents.length > 0 && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 14 }}>Upcoming Events</div>
          {upcomingEvents.map((e, i) => (
            <div key={e.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 10, marginBottom: i < upcomingEvents.length - 1 ? 10 : 0, borderBottom: i < upcomingEvents.length - 1 ? "1px solid #f3f4f6" : "none" }}>
              <div><div style={{ fontWeight: 500, fontSize: 14 }}>{e.name}</div><div style={{ fontSize: 12, color: "#6b7280" }}>{e.location} · {e.date}</div></div>
              <button style={{ background: "none", border: "1px solid #e5e7eb", padding: "7px 14px", borderRadius: 7, fontSize: 12, color: "#374151", cursor: "pointer" }} onClick={() => { setSelectedEventId(e.id); setView("event-detail"); }}>View Packing List</button>
            </div>
          ))}
        </div>
      )}
      {events.length === 0 && <div className="card" style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>No events yet — go to Events to add your season schedule</div>}
    </div>
  );
}

function Inventory({ items, setItems, showToast }) {
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: "", category: CATEGORIES[0], qty: 1, notes: "" });
  const [saving, setSaving] = useState(false);

  const filtered = items.filter(i => (filterCat === "All" || i.category === filterCat) && i.name.toLowerCase().includes(search.toLowerCase()));
  const openAdd = () => { setForm({ name: "", category: CATEGORIES[0], qty: 1, notes: "" }); setEditItem(null); setShowModal(true); };
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
    } catch { showToast("Error saving — check connection"); }
    setSaving(false);
  };

  const remove = async (id) => {
    try { await api.deleteItem(id); setItems(prev => prev.filter(i => i.id !== id)); showToast("Item removed"); }
    catch { showToast("Error removing item"); }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div><h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Master Inventory</h1><p style={{ color: "#6b7280", fontSize: 14 }}>{items.length} items tracked</p></div>
        <button style={{ background: "#1a1a2e", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer" }} onClick={openAdd}>+ Add Item</button>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items..." style={{ ...inputStyle, flex: "1 1 160px" }} />
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={inputStyle}>
          {["All", ...CATEGORIES].map(c => <option key={c}>{c}</option>)}
        </select>
      </div>
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
                  <button style={{ background: "none", border: "1px solid #e5e7eb", padding: "5px 10px", borderRadius: 6, fontSize: 12, color: "#374151", cursor: "pointer", marginRight: 6 }} onClick={() => openEdit(item)}>Edit</button>
                  <button style={{ background: "none", border: "1px solid #fca5a5", padding: "5px 10px", borderRadius: 6, fontSize: 12, color: "#dc2626", cursor: "pointer" }} onClick={() => remove(item.id)}>Remove</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>No items found</td></tr>}
          </tbody>
        </table>
      </div>
      {showModal && (
        <Modal title={editItem ? "Edit Item" : "Add Item"} onClose={() => setShowModal(false)} onSave={save} saveLabel={editItem ? "Save Changes" : "Add Item"} saving={saving}>
          <label style={labelStyle}>Item Name</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} placeholder="e.g. Wireless Microphone" autoFocus />
          <label style={labelStyle}>Category</label>
          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inputStyle}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
          <label style={labelStyle}>Quantity</label>
          <input type="number" value={form.qty} onChange={e => setForm(f => ({ ...f, qty: Number(e.target.value) }))} style={inputStyle} min={1} />
          <label style={labelStyle}>Notes (optional)</label>
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ ...inputStyle, height: 72, resize: "vertical" }} placeholder="Any details to remember..." />
        </Modal>
      )}
    </div>
  );
}

function Events({ events, setEvents, packing, setPacking, setView, setSelectedEventId, showToast }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", date: "", location: "", status: "upcoming" });
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const created = await api.addEvent(form);
      setEvents(prev => [...prev, created[0]]);
      showToast("Event created"); setShowModal(false);
    } catch { showToast("Error creating event"); }
    setSaving(false);
  };

  const remove = async (id) => {
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
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div><h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Events</h1><p style={{ color: "#6b7280", fontSize: 14 }}>{events.length} events this season</p></div>
        <button style={{ background: "#1a1a2e", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer" }} onClick={() => { setForm({ name: "", date: "", location: "", status: "upcoming" }); setShowModal(true); }}>+ Add Event</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {sorted.map(e => {
          const ep = packing.filter(p => p.event_id === e.id);
          const sc = STATUS_CONFIG[e.status] || STATUS_CONFIG.upcoming;
          return (
            <div key={e.id} className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span className="pill" style={{ background: sc.bg, color: sc.color, fontSize: 11 }}>{sc.label}</span>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{e.name}</span>
                </div>
                <div style={{ fontSize: 13, color: "#6b7280" }}>{e.location}{e.date ? ` · ${e.date}` : ""}</div>
                {ep.length > 0 && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>{ep.filter(p => p.packed).length}/{ep.length} packed · {ep.filter(p => p.returned).length}/{ep.length} returned</div>}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ background: "none", border: "1px solid #e5e7eb", padding: "7px 14px", borderRadius: 7, fontSize: 12, color: "#374151", cursor: "pointer" }} onClick={() => { setSelectedEventId(e.id); setView("event-detail"); }}>Packing List →</button>
                <button style={{ background: "none", border: "1px solid #fca5a5", padding: "5px 10px", borderRadius: 6, fontSize: 12, color: "#dc2626", cursor: "pointer" }} onClick={() => remove(e.id)}>Delete</button>
              </div>
            </div>
          );
        })}
        {events.length === 0 && <div className="card" style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>No events yet</div>}
      </div>
      {showModal && (
        <Modal title="Add Event" onClose={() => setShowModal(false)} onSave={add} saveLabel="Create Event" saving={saving}>
          <label style={labelStyle}>Event Name</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} placeholder="e.g. Nationals Qualifier – Ottawa" autoFocus />
          <label style={labelStyle}>Date</label>
          <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} />
          <label style={labelStyle}>Location</label>
          <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} style={inputStyle} placeholder="e.g. Toronto, ON" />
          <label style={labelStyle}>Status</label>
          <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
            <option value="upcoming">Upcoming</option><option value="active">Active</option><option value="completed">Completed</option>
          </select>
        </Modal>
      )}
    </div>
  );
}

function EventDetail({ event, events, setEvents, items, eventPacking, packing, setPacking, setView, showToast }) {
  const [showAddItem, setShowAddItem] = useState(false);
  const [addItemId, setAddItemId] = useState("");
  const [addQty, setAddQty] = useState(1);
  const [saving, setSaving] = useState(false);
  const [showCopy, setShowCopy] = useState(false);
  const [copyEventId, setCopyEventId] = useState("");

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

  const grouped = {};
  eventPacking.forEach(p => {
    const item = items.find(i => i.id === p.item_id);
    if (!item) return;
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push({ ...p, item });
  });

  return (
    <div>
      <button style={{ background: "none", border: "1px solid #e5e7eb", padding: "7px 14px", borderRadius: 7, fontSize: 13, color: "#374151", cursor: "pointer", marginBottom: 20 }} onClick={() => setView("events")}>← Back to Events</button>
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <span className="pill" style={{ background: sc.bg, color: sc.color, marginBottom: 8, display: "inline-flex" }}>{sc.label}</span>
            <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{event.name}</h1>
            <div style={{ fontSize: 14, color: "#6b7280" }}>{event.location}{event.date ? ` · ${event.date}` : ""}</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {event.status !== "active" && <button style={{ background: "none", border: "1px solid #e5e7eb", padding: "6px 12px", borderRadius: 7, fontSize: 12, cursor: "pointer" }} onClick={() => updateStatus("active")}>Mark Active</button>}
            {event.status !== "completed" && <button style={{ background: "none", border: "1px solid #e5e7eb", padding: "6px 12px", borderRadius: 7, fontSize: 12, cursor: "pointer" }} onClick={() => updateStatus("completed")}>Mark Completed</button>}
            {event.status !== "upcoming" && <button style={{ background: "none", border: "1px solid #e5e7eb", padding: "6px 12px", borderRadius: 7, fontSize: 12, cursor: "pointer" }} onClick={() => updateStatus("upcoming")}>Mark Upcoming</button>}
          </div>
        </div>
        {total > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#6b7280", marginBottom: 6 }}><span>Packing progress</span><span>{totalPacked} / {total} packed</span></div>
            <div style={{ background: "#f3f4f6", borderRadius: 99, height: 8, overflow: "hidden" }}><div style={{ width: `${progress}%`, background: "#1a1a2e", height: "100%", borderRadius: 99, transition: "width 0.3s" }} /></div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Packing List</div>
        <div style={{ display: "flex", gap: 8 }}>
          {otherEvents.length > 0 && <button style={{ background: "none", border: "1px solid #e5e7eb", padding: "7px 14px", borderRadius: 7, fontSize: 12, cursor: "pointer" }} onClick={() => { setCopyEventId(otherEvents[0].id); setShowCopy(true); }}>Copy from Event</button>}
          <button style={{ background: "#1a1a2e", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer" }} onClick={() => { setAddItemId(availableToAdd[0]?.id || ""); setAddQty(1); setShowAddItem(true); }}>+ Add Item</button>
        </div>
      </div>

      {Object.keys(grouped).length === 0 && <div className="card" style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>No items yet — add from inventory or copy from another event</div>}

      {Object.entries(grouped).map(([cat, entries]) => (
        <div key={cat} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{cat}</div>
          <div className="card" style={{ overflow: "hidden" }}>
            {entries.map((entry, i) => (
              <div key={entry.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: i < entries.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div className={`checkbox-custom ${entry.packed ? "checked" : ""}`} onClick={() => toggleField(entry, "packed")}>{entry.packed && <Checkmark />}</div>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>Packed</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, textDecoration: entry.returned ? "line-through" : "none", color: entry.returned ? "#9ca3af" : "#111" }}>{entry.item.name}</span>
                  <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: 8 }}>×{entry.qty_needed}</span>
                  {entry.item.notes && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{entry.item.notes}</div>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>Returned</span>
                  <div className={`checkbox-custom ${entry.returned ? "checked" : ""}`} onClick={() => toggleField(entry, "returned")}>{entry.returned && <Checkmark />}</div>
                </div>
                <button style={{ background: "none", border: "1px solid #fca5a5", padding: "4px 8px", borderRadius: 6, fontSize: 11, color: "#dc2626", cursor: "pointer" }} onClick={() => removeFromList(entry.id)}>✕</button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {showAddItem && (
        <Modal title="Add Item to Packing List" onClose={() => setShowAddItem(false)} onSave={addToList} saveLabel="Add to List" saving={saving}>
          <label style={labelStyle}>Select Item</label>
          <select value={addItemId} onChange={e => setAddItemId(e.target.value)} style={inputStyle}>
            {availableToAdd.length === 0 ? <option value="">All items already added</option> : availableToAdd.map(i => <option key={i.id} value={i.id}>{i.name} ({i.category})</option>)}
          </select>
          <label style={labelStyle}>Qty Needed</label>
          <input type="number" value={addQty} onChange={e => setAddQty(Number(e.target.value))} style={inputStyle} min={1} />
        </Modal>
      )}

      {showCopy && (
        <Modal title="Copy Packing List From Event" onClose={() => setShowCopy(false)} onSave={copyFromEvent} saveLabel="Copy Items" saving={saving}>
          <label style={labelStyle}>Copy from which event?</label>
          <select value={copyEventId} onChange={e => setCopyEventId(e.target.value)} style={inputStyle}>{otherEvents.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
          <p style={{ fontSize: 12, color: "#6b7280" }}>Items already on this list won't be duplicated. All copied items start as unpacked.</p>
        </Modal>
      )}
    </div>
  );
}
