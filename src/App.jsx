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
  updateEventTrailer: (id, patch) => sb(`event_trailers?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
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
  getUserPerms: (email) => sb(`user_permissions?email=eq.${encodeURIComponent(email)}&limit=1`),
  getAllUserPerms: () => sb("user_permissions?order=created_at"),
  addUserPerm: (p) => sb("user_permissions", { method: "POST", body: JSON.stringify(p) }),
  updateUserPerm: (id, patch) => sb(`user_permissions?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteUserPerm: (id) => sb(`user_permissions?id=eq.${id}`, { method: "DELETE" }),
  uploadDiagram: async (file, eventId, trailerId) => {
    const path = `diagram-${eventId}-${trailerId}`;
    const token = authToken || SUPABASE_KEY;
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/logos/${path}`, {
      method: "POST",
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}`, "Content-Type": file.type, "x-upsert": "true" },
      body: file,
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("Diagram upload failed:", res.status, err);
      throw new Error(err);
    }
    return `${SUPABASE_URL}/storage/v1/object/public/logos/${path}?t=${Date.now()}`;
  },
  uploadLogo: async (file, path) => {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/logos/${path}`, {
      method: "POST",
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Content-Type": file.type, "x-upsert": "true" },
      body: file,
    });
    if (!res.ok) { const err = await res.text(); throw new Error(err); }
    return `${SUPABASE_URL}/storage/v1/object/public/logos/${path}`;
  },
  getContainers: () => sb("containers?order=name"),
  addContainer: (c) => sb("containers", { method: "POST", body: JSON.stringify(c) }),
  updateContainer: (id, patch) => sb(`containers?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteContainer: (id) => sb(`containers?id=eq.${id}`, { method: "DELETE" }),
  getContainerItems: () => sb("container_items"),
  addContainerItem: (ci) => sb("container_items", { method: "POST", body: JSON.stringify(ci) }),
  updateContainerItem: (id, patch) => sb(`container_items?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteContainerItem: (id) => sb(`container_items?id=eq.${id}`, { method: "DELETE" }),
  getEventContainerItems: () => sb("event_container_items"),
  addEventContainerItem: (eci) => sb("event_container_items", { method: "POST", body: JSON.stringify(eci) }),
  updateEventContainerItem: (id, patch) => sb(`event_container_items?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteEventContainerItem: (id) => sb(`event_container_items?id=eq.${id}`, { method: "DELETE" }),
  deleteEventContainerItemsByEvent: (eventId) => sb(`event_container_items?event_id=eq.${eventId}`, { method: "DELETE" }),
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

function wrapSvgText(text, maxChars, maxLines = 4) {
  const words = text.split(" ");
  const lines = [];
  let current = "";
  for (const word of words) {
    if (lines.length >= maxLines) break;
    const test = current ? `${current} ${word}` : word;
    if (test.length <= maxChars) {
      current = test;
    } else {
      if (current) lines.push(current);
      if (lines.length < maxLines)
        current = word.length > maxChars ? word.slice(0, maxChars - 1) + "…" : word;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines.length ? lines : [text.slice(0, maxChars - 1) + "…"];
}

// ─── Trailer Canvas ────────────────────────────────────────────────────────────
function TrailerCanvas({ trailer, packingEntries, setPacking, showToast, eventName }) {
  const length = trailer.length_ft || 53;
  const width = trailer.width_ft || 8;
  const isBarn = trailer.door_type === "barn";
  const FRONT_W = 1;
  const DOOR_W = 1;
  const VW = FRONT_W + length + DOOR_W;
  const VH = width;

  const svgRef = useRef();
  const [dragging, setDragging] = useState(null);
  const [localPos, setLocalPos] = useState({});
  const [selected, setSelected] = useState(null);
  const [zOrder, setZOrder] = useState([]);

  const bringToFront = id => setZOrder(prev => [...prev.filter(z => z !== id), id]);

  const snap = v => Math.round(v * 2) / 2;
  const clampX = (x, iw) => Math.max(0, Math.min(length - iw, x));
  const clampY = (y, ih) => Math.max(0, Math.min(width - ih, y));

  const getItemDims = entry => {
    const w = entry.container?.dim_w_ft || entry.item?.dim_w_ft || entry.ad_hoc_dim_w_ft || 2;
    const d = entry.container?.dim_d_ft || entry.item?.dim_d_ft || entry.ad_hoc_dim_d_ft || 2;
    return entry.diag_rotated ? [d, w] : [w, d];
  };

  const getSvgPt = e => {
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (VW / rect.width),
      y: (e.clientY - rect.top) * (VH / rect.height),
    };
  };

  const getTouchPt = e => {
    const t = e.touches[0] || e.changedTouches[0];
    return getSvgPt({ clientX: t.clientX, clientY: t.clientY });
  };

  const startDrag = (e, entry) => {
    e.preventDefault();
    e.stopPropagation();
    setSelected(entry.id);
    bringToFront(entry.id);
    const pt = e.touches ? getTouchPt(e) : getSvgPt(e);
    const cx = localPos[entry.id]?.x ?? entry.diag_x ?? 0;
    const cy = localPos[entry.id]?.y ?? entry.diag_y ?? 0;
    setDragging({ id: entry.id, sx: pt.x, sy: pt.y, ox: cx, oy: cy });
  };

  const onMove = e => {
    if (!dragging) return;
    const pt = e.touches ? getTouchPt(e) : getSvgPt(e);
    const entry = packingEntries.find(p => p.id === dragging.id);
    if (!entry) return;
    const [iw, ih] = getItemDims(entry);
    const nx = clampX(snap(dragging.ox + (pt.x - dragging.sx)), iw);
    const ny = clampY(snap(dragging.oy + (pt.y - dragging.sy)), ih);
    setLocalPos(prev => ({ ...prev, [dragging.id]: { x: nx, y: ny } }));
  };

  const onUp = async () => {
    if (!dragging) return;
    const id = dragging.id;
    const pos = localPos[id];
    setDragging(null);
    if (pos) {
      try {
        await api.updatePacking(id, { diag_x: pos.x, diag_y: pos.y });
        setPacking(prev => prev.map(p => p.id === id ? { ...p, diag_x: pos.x, diag_y: pos.y } : p));
      } catch { showToast("Error saving position"); }
      setLocalPos(prev => { const n = { ...prev }; delete n[id]; return n; });
    }
  };

  const placeItem = async entry => {
    try {
      await api.updatePacking(entry.id, { diag_x: 0, diag_y: 0 });
      setPacking(prev => prev.map(p => p.id === entry.id ? { ...p, diag_x: 0, diag_y: 0 } : p));
      setSelected(entry.id);
      bringToFront(entry.id);
    } catch { showToast("Error placing item"); }
  };

  const unplaceItem = async entry => {
    try {
      await api.updatePacking(entry.id, { diag_x: null, diag_y: null, diag_rotated: false });
      setPacking(prev => prev.map(p => p.id === entry.id ? { ...p, diag_x: null, diag_y: null, diag_rotated: false } : p));
      if (selected === entry.id) setSelected(null);
    } catch { showToast("Error removing from diagram"); }
  };

  const rotateItem = async entry => {
    const r = !entry.diag_rotated;
    try {
      await api.updatePacking(entry.id, { diag_rotated: r });
      setPacking(prev => prev.map(p => p.id === entry.id ? { ...p, diag_rotated: r } : p));
    } catch { showToast("Error rotating"); }
  };

  const placed = packingEntries.filter(e => e.diag_x != null && e.diag_y != null);
  const unplaced = packingEntries.filter(e => e.diag_x == null || e.diag_y == null);
  const selectedEntry = placed.find(e => e.id === selected);

  // Render placed items with z-order: recently interacted items draw on top
  const sortedPlaced = [
    ...placed.filter(e => !zOrder.includes(e.id)),
    ...zOrder.map(id => placed.find(e => e.id === id)).filter(Boolean),
  ];

  const downloadPNG = () => {
    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const SCALE = Math.max(2, Math.ceil(1800 / rect.width));
    const HEADER = 70;
    const canvasW = Math.round(rect.width * SCALE);
    const canvasH = Math.round(rect.height * SCALE) + HEADER;

    svg.setAttribute("width", canvasW);
    svg.setAttribute("height", Math.round(rect.height * SCALE));
    const svgData = new XMLSerializer().serializeToString(svg);
    svg.removeAttribute("width");
    svg.removeAttribute("height");

    const canvas = document.createElement("canvas");
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.fillStyle = "#111827";
    ctx.font = "bold 20px sans-serif";
    ctx.fillText(eventName || "Event", 20, 26);
    ctx.fillStyle = "#6b7280";
    ctx.font = "13px sans-serif";
    ctx.fillText(`Trailer ${trailer.number} · ${length}ft × ${width}ft`, 20, 48);

    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, HEADER, canvasW, canvasH - HEADER);
      URL.revokeObjectURL(url);
      const a = document.createElement("a");
      a.download = `Trailer-${trailer.number}-${(eventName || "Event").replace(/[^a-z0-9]/gi, "-")}.png`;
      a.href = canvas.toDataURL("image/png");
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };
    img.onerror = () => { URL.revokeObjectURL(url); showToast("Error generating image"); };
    img.src = url;
  };

  const gridLinesX = [];
  for (let x = 0.5; x < length; x += 0.5) gridLinesX.push(parseFloat(x.toFixed(1)));
  const gridLinesY = [];
  for (let y = 0.5; y < width; y += 0.5) gridLinesY.push(parseFloat(y.toFixed(1)));

  return (
    <div style={{ background: "#f8f9fb", borderRadius: 10, padding: 16, border: "1px solid #e5e7eb" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Trailer {trailer.number} — Layout</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 12, color: "#9ca3af" }}>{length}ft × {width}ft · 0.5ft grid</div>
          <button style={{ ...ghostBtn, padding: "4px 10px", fontSize: 12 }} onClick={downloadPNG}>↓ PNG</button>
        </div>
      </div>

      <div style={{ position: "relative", userSelect: "none", touchAction: "none" }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VW} ${VH}`}
          style={{ width: "100%", display: "block", cursor: dragging ? "grabbing" : "default", borderRadius: 4, border: "1.5px solid #374151" }}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onMouseLeave={onUp}
          onTouchMove={e => { e.preventDefault(); onMove(e); }}
          onTouchEnd={onUp}
          onClick={e => { if (e.target === svgRef.current) setSelected(null); }}
        >
          {/* Interior background */}
          <rect x={FRONT_W} y={0} width={length} height={VH} fill="#f9fafb" />

          {/* Grid lines */}
          {gridLinesX.map(x => (
            <line key={`gx-${x}`}
              x1={FRONT_W + x} y1={0} x2={FRONT_W + x} y2={VH}
              stroke={Number.isInteger(x) ? "#e5e7eb" : "#f3f4f6"}
              strokeWidth={Number.isInteger(x) ? 0.04 : 0.025} />
          ))}
          {gridLinesY.map(y => (
            <line key={`gy-${y}`}
              x1={FRONT_W} y1={y} x2={FRONT_W + length} y2={y}
              stroke={Number.isInteger(y) ? "#e5e7eb" : "#f3f4f6"}
              strokeWidth={Number.isInteger(y) ? 0.04 : 0.025} />
          ))}

          {/* Driver / passenger divider */}
          <line x1={FRONT_W} y1={VH / 2} x2={FRONT_W + length} y2={VH / 2}
            stroke="#d1d5db" strokeWidth={0.07} strokeDasharray="0.6 0.35" />

          {/* Side labels */}
          <text x={FRONT_W + 0.4} y={0.6} fill="#9ca3af" fontSize={0.5} fontFamily="sans-serif">Driver</text>
          <text x={FRONT_W + 0.4} y={VH - 0.15} fill="#9ca3af" fontSize={0.5} fontFamily="sans-serif">Passenger</text>

          {/* Placed items — rendered in z-order so recently touched items draw on top */}
          {sortedPlaced.map(entry => {
            const [iw, ih] = getItemDims(entry);
            const ix = FRONT_W + (localPos[entry.id]?.x ?? entry.diag_x ?? 0);
            const iy = localPos[entry.id]?.y ?? entry.diag_y ?? 0;
            const isSel = selected === entry.id;
            const isDraggingThis = dragging?.id === entry.id;
            const isTemp = !entry.item_id && !entry.container_id && !!entry.ad_hoc_name;
            const isContainer = !!entry.container_id;
            const hasDims = (entry.container?.dim_w_ft && entry.container?.dim_d_ft) || (entry.item?.dim_w_ft && entry.item?.dim_d_ft) || (entry.ad_hoc_dim_w_ft && entry.ad_hoc_dim_d_ft);
            const name = entry.container?.name || entry.item?.name || entry.ad_hoc_name || "Item";
            const qty = entry.qty_needed || 1;
            const fontSize = Math.min(0.65, Math.max(0.25, Math.min(iw, ih) * 0.28));
            const fullLabel = name + (qty > 1 ? ` \xd7${qty}` : "");
            const charsPerLine = Math.max(3, Math.floor(iw / (fontSize * 0.52)));
            const lines = wrapSvgText(fullLabel, charsPerLine);
            const lineH = fontSize * 1.25;
            const textBlockH = lines.length * lineH;
            const textStartY = iy + ih / 2 - (textBlockH - lineH) / 2;

            return (
              <g key={entry.id}
                onMouseDown={e => startDrag(e, entry)}
                onTouchStart={e => startDrag(e, entry)}
                style={{ cursor: isDraggingThis ? "grabbing" : "grab" }}>
                {isSel && <rect x={ix + 0.1} y={iy + 0.1} width={iw} height={ih} rx={0.15} fill="rgba(0,0,0,0.1)" />}
                <rect x={ix} y={iy} width={iw} height={ih} rx={0.12}
                  fill={entry.packed ? "#f0fdf4" : isContainer ? (entry.container?.color ? entry.container.color + "22" : "#eff6ff") : isTemp ? "#faf5ff" : "#ffffff"}
                  stroke={isSel ? "#2563eb" : isContainer ? (entry.container?.color || "#2563eb") : isTemp ? "#7c3aed" : hasDims ? "#374151" : "#f59e0b"}
                  strokeWidth={isSel ? 0.13 : 0.07}
                  strokeDasharray={isTemp && !isSel ? "0.25 0.15" : undefined}
                  opacity={isDraggingThis ? 0.85 : 1}
                />
                {lines.map((line, li) => (
                  <text key={li}
                    x={ix + iw / 2} y={textStartY + li * lineH}
                    textAnchor="middle" dominantBaseline="middle"
                    fill="#374151" fontSize={fontSize} fontWeight="500" fontFamily="sans-serif"
                    style={{ pointerEvents: "none" }}>
                    {line}
                  </text>
                ))}
                {!hasDims && (
                  <text x={ix + iw / 2} y={textStartY + lines.length * lineH}
                    textAnchor="middle" dominantBaseline="middle"
                    fill="#f59e0b" fontSize={fontSize * 0.75} fontFamily="sans-serif"
                    style={{ pointerEvents: "none" }}>est. size</text>
                )}
              </g>
            );
          })}

          {/* Front bar — drawn over items so they slide under it */}
          <rect x={0} y={0} width={FRONT_W} height={VH} fill="#1a1a2e" />
          <text x={FRONT_W / 2} y={VH / 2} textAnchor="middle" dominantBaseline="middle"
            fill="#fff" fontSize={0.55} fontWeight="600" fontFamily="sans-serif"
            transform={`rotate(-90, ${FRONT_W / 2}, ${VH / 2})`}>FRONT</text>

          {/* Door bar */}
          {isBarn ? (
            <>
              <rect x={FRONT_W + length} y={0} width={DOOR_W} height={VH / 2 - 0.07} fill="#374151" />
              <rect x={FRONT_W + length} y={VH / 2 + 0.07} width={DOOR_W} height={VH / 2 - 0.07} fill="#374151" />
              <text x={FRONT_W + length + DOOR_W / 2} y={VH / 4} textAnchor="middle" dominantBaseline="middle"
                fill="#fff" fontSize={0.42} fontFamily="sans-serif"
                transform={`rotate(-90, ${FRONT_W + length + DOOR_W / 2}, ${VH / 4})`}>DOOR L</text>
              <text x={FRONT_W + length + DOOR_W / 2} y={3 * VH / 4} textAnchor="middle" dominantBaseline="middle"
                fill="#fff" fontSize={0.42} fontFamily="sans-serif"
                transform={`rotate(-90, ${FRONT_W + length + DOOR_W / 2}, ${3 * VH / 4})`}>DOOR R</text>
            </>
          ) : (
            <>
              <rect x={FRONT_W + length} y={0} width={DOOR_W} height={VH} fill="#374151" />
              <text x={FRONT_W + length + DOOR_W / 2} y={VH / 2} textAnchor="middle" dominantBaseline="middle"
                fill="#fff" fontSize={0.5} fontWeight="600" fontFamily="sans-serif"
                transform={`rotate(-90, ${FRONT_W + length + DOOR_W / 2}, ${VH / 2})`}>DOOR</text>
            </>
          )}

          {/* Outer border */}
          <rect x={0} y={0} width={VW} height={VH} fill="none" stroke="#374151" strokeWidth={0.12} />
        </svg>
      </div>

      {/* Selected item controls */}
      {selectedEntry && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: "#eff6ff", borderRadius: 8, border: "1px solid #bfdbfe", marginTop: 10, fontSize: 13 }}>
          <span style={{ flex: 1, fontWeight: 500, color: "#1d4ed8" }}>
            {selectedEntry.container?.name || selectedEntry.item?.name || selectedEntry.ad_hoc_name}{(selectedEntry.qty_needed || 1) > 1 ? ` \xd7${selectedEntry.qty_needed}` : ""}
            {selectedEntry.container_id && <span style={{ background: "#eff6ff", color: "#2563eb", fontSize: 10, padding: "1px 6px", borderRadius: 4, fontWeight: 600, marginLeft: 6 }}>{ctLabel(selectedEntry.container?.type)}</span>}
            {!selectedEntry.item_id && !selectedEntry.container_id && selectedEntry.ad_hoc_name && <span style={{ background: "#f3e8ff", color: "#7c3aed", fontSize: 10, padding: "1px 6px", borderRadius: 4, fontWeight: 600, marginLeft: 6 }}>TEMP</span>}
          </span>
          <button style={{ ...ghostBtn, padding: "4px 10px", fontSize: 12 }} onClick={() => rotateItem(selectedEntry)}>↻ Rotate</button>
          <button style={{ ...dangerBtn, padding: "4px 10px", fontSize: 12 }} onClick={() => unplaceItem(selectedEntry)}>Remove</button>
          <button style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 16, lineHeight: 1, padding: "2px 6px" }} onClick={() => setSelected(null)}>✕</button>
        </div>
      )}

      {/* Unplaced items panel */}
      {unplaced.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            Unplaced Items ({unplaced.length})
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {unplaced.map(entry => {
              const item = entry.item;
              const isTemp = !entry.item_id && !!entry.ad_hoc_name;
              const hasDims = (item?.dim_w_ft && item?.dim_d_ft) || (entry.ad_hoc_dim_w_ft && entry.ad_hoc_dim_d_ft);
              const dimW = item?.dim_w_ft || entry.ad_hoc_dim_w_ft;
              const dimD = item?.dim_d_ft || entry.ad_hoc_dim_d_ft;
              const qty = entry.qty_needed || 1;
              return (
                <div key={entry.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", background: isTemp ? "#faf5ff" : "#fff", border: `1px solid ${isTemp ? "#e9d5ff" : "#e5e7eb"}`, borderRadius: 8, fontSize: 13 }}>
                  <span style={{ fontWeight: 500 }}>{item?.name || entry.ad_hoc_name || "Item"}{qty > 1 ? ` \xd7${qty}` : ""}</span>
                  {isTemp && <span style={{ background: "#f3e8ff", color: "#7c3aed", fontSize: 10, padding: "1px 5px", borderRadius: 4, fontWeight: 600 }}>TEMP</span>}
                  {hasDims
                    ? <span style={{ color: "#9ca3af", fontSize: 11 }}>{dimW}\xd7{dimD}ft</span>
                    : <span style={{ color: "#f59e0b", fontSize: 11 }}>⚠ no size</span>
                  }
                  <button style={{ ...primaryBtn, padding: "3px 10px", fontSize: 12 }} onClick={() => placeItem(entry)}>Place</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {packingEntries.length === 0 && (
        <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 13, padding: "20px 0" }}>No items in this trailer's packing list</div>
      )}
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

  const openAdd = () => { setForm({ number: "", door_type: "rollup", notes: "", length_ft: 53, width_ft: 8 }); setEditTrailer(null); setShowModal(true); };
  const openEdit = (t) => { setForm({ number: t.number, door_type: t.door_type, notes: t.notes || "", length_ft: t.length_ft || 53, width_ft: t.width_ft || 8 }); setEditTrailer(t); setShowModal(true); };

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
              <div style={{ fontSize: 12, color: "#9ca3af" }}>{t.door_type === "barn" ? "Barn doors" : "Roll-up door"} · {t.length_ft || 53}ft × {t.width_ft || 8}ft{t.notes ? ` · ${t.notes}` : ""}</div>
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
          <label style={labelStyle}>Trailer Dimensions</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="number" value={form.length_ft} onChange={e => setForm(f => ({ ...f, length_ft: e.target.value }))} style={{ ...iStyle, flex: 1 }} placeholder="Length (ft)" min="1" step="1" />
            <span style={{ color: "#9ca3af", fontSize: 13 }}>×</span>
            <input type="number" value={form.width_ft} onChange={e => setForm(f => ({ ...f, width_ft: e.target.value }))} style={{ ...iStyle, flex: 1 }} placeholder="Width (ft)" min="1" step="0.5" />
          </div>
          <label style={labelStyle}>Notes (optional)</label>
          <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={iStyle} placeholder="Any details..." />
        </Modal>
      )}
    </div>
  );
}

// ─── Container Manager ────────────────────────────────────────────────────────
const CONTAINER_TYPES = [
  { value: "tote", label: "Tote", icon: "📦" },
  { value: "travel_case", label: "Travel Case", icon: "🧳" },
  { value: "rolling_bin", label: "Rolling Bin", icon: "🗂️" },
  { value: "misc", label: "Misc / Event-Specific", icon: "📫" },
  { value: "other", label: "Other", icon: "📋" },
];
const CONTAINER_COLORS = ["#1a1a2e", "#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#374151"];
const ctIcon = (type) => CONTAINER_TYPES.find(t => t.value === type)?.icon || "📦";
const ctLabel = (type) => CONTAINER_TYPES.find(t => t.value === type)?.label || "Container";

function ItemSearchInput({ items, value, onChange, placeholder = "Search items...", style = {} }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef();

  const selected = items.find(i => i.id === value);
  const filtered = query.trim()
    ? items.filter(i => `${i.name} ${i.category || ""}`.toLowerCase().includes(query.toLowerCase()))
    : items;

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (item) => { onChange(item.id); setQuery(""); setOpen(false); };
  const clear = () => { onChange(""); setQuery(""); };

  return (
    <div ref={ref} style={{ position: "relative", flex: 1, ...style }}>
      <div style={{ display: "flex", alignItems: "center", border: "1px solid #e5e7eb", borderRadius: 7, background: "#fff", overflow: "hidden" }}>
        {selected && !open ? (
          <div style={{ flex: 1, padding: "7px 10px", fontSize: 13, color: "#111", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {selected.name}{selected.category ? <span style={{ color: "#9ca3af", marginLeft: 6 }}>({selected.category})</span> : null}
          </div>
        ) : (
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={selected ? selected.name : placeholder}
            style={{ flex: 1, border: "none", outline: "none", padding: "7px 10px", fontSize: 13, fontFamily: "inherit", background: "transparent", minWidth: 0 }}
          />
        )}
        {(value || query) && (
          <button onClick={clear} style={{ border: "none", background: "none", cursor: "pointer", padding: "4px 8px", color: "#9ca3af", fontSize: 16, lineHeight: 1 }}>✕</button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 7, boxShadow: "0 4px 12px rgba(0,0,0,0.12)", zIndex: 100, maxHeight: 220, overflowY: "auto", marginTop: 2 }}>
          {filtered.map(item => (
            <div
              key={item.id}
              onMouseDown={() => select(item)}
              style={{ padding: "8px 12px", fontSize: 13, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", background: item.id === value ? "#eff6ff" : "#fff", borderBottom: "1px solid #f3f4f6" }}
              onMouseEnter={e => { if (item.id !== value) e.currentTarget.style.background = "#f9fafb"; }}
              onMouseLeave={e => { if (item.id !== value) e.currentTarget.style.background = "#fff"; }}
            >
              <span style={{ fontWeight: item.id === value ? 600 : 400 }}>{item.name}</span>
              {item.category && <span style={{ fontSize: 11, color: "#9ca3af" }}>{item.category}</span>}
            </div>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 7, boxShadow: "0 4px 12px rgba(0,0,0,0.12)", zIndex: 100, padding: "10px 12px", fontSize: 13, color: "#9ca3af", marginTop: 2 }}>
          No items match "{query}"
        </div>
      )}
    </div>
  );
}

function ContainerManager({ containers, setContainers, containerItems, setContainerItems, items, areas, showToast, isMobile: m }) {
  const [showModal, setShowModal] = useState(false);
  const [editContainer, setEditContainer] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [expandedParentIds, setExpandedParentIds] = useState(new Set());
  const [childFilter, setChildFilter] = useState(false);
  const [form, setForm] = useState({ name: "", type: "tote", color: "", notes: "", area_id: "", dim_w_ft: "", dim_d_ft: "", parent_container_id: "" });
  const [saving, setSaving] = useState(false);
  const [addItemForm, setAddItemForm] = useState({ item_id: "", qty: 1 });
  const [addingItem, setAddingItem] = useState(false);

  const toggleParentExpand = (id) => setExpandedParentIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const iStyle = m ? inputStyleMobile : inputStyle;

  const openAdd = () => { setForm({ name: "", type: "tote", color: "", notes: "", area_id: "", dim_w_ft: "", dim_d_ft: "", parent_container_id: "" }); setEditContainer(null); setShowModal(true); };
  const openEdit = (c) => { setForm({ name: c.name, type: c.type, color: c.color || "", notes: c.notes || "", area_id: c.area_id || "", dim_w_ft: c.dim_w_ft || "", dim_d_ft: c.dim_d_ft || "", parent_container_id: c.parent_container_id || "" }); setEditContainer(c); setShowModal(true); };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, area_id: form.area_id || null, dim_w_ft: form.dim_w_ft !== "" ? parseFloat(form.dim_w_ft) : null, dim_d_ft: form.dim_d_ft !== "" ? parseFloat(form.dim_d_ft) : null, parent_container_id: form.parent_container_id || null };
      if (editContainer) {
        await api.updateContainer(editContainer.id, payload);
        setContainers(prev => prev.map(c => c.id === editContainer.id ? { ...c, ...payload } : c));
        showToast("Container updated");
      } else {
        const created = await api.addContainer(payload);
        setContainers(prev => [...prev, created[0]]);
        showToast("Container added");
      }
      setShowModal(false);
    } catch { showToast("Error saving container"); }
    setSaving(false);
  };

  const remove = async (id) => {
    try {
      await api.deleteContainer(id);
      setContainers(prev => prev.filter(c => c.id !== id));
      setContainerItems(prev => prev.filter(ci => ci.container_id !== id));
      if (expandedId === id) setExpandedId(null);
      showToast("Container removed");
    } catch { showToast("Error removing container"); }
  };

  const addItemToContainer = async (containerId) => {
    if (!addItemForm.item_id) return;
    setAddingItem(true);
    try {
      const created = await api.addContainerItem({ container_id: containerId, item_id: addItemForm.item_id, qty: addItemForm.qty || 1 });
      setContainerItems(prev => [...prev, created[0]]);
      setAddItemForm({ item_id: "", qty: 1 });
      showToast("Item added");
    } catch { showToast("Error adding item"); }
    setAddingItem(false);
  };

  const removeContainerItem = async (id) => {
    try { await api.deleteContainerItem(id); setContainerItems(prev => prev.filter(ci => ci.id !== id)); }
    catch { showToast("Error removing item"); }
  };

  const updateContainerItemQty = async (id, qty) => {
    if (qty < 1) return;
    try { await api.updateContainerItem(id, { qty }); setContainerItems(prev => prev.map(ci => ci.id === id ? { ...ci, qty } : ci)); }
    catch { showToast("Error updating qty"); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Manage Containers</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            style={{ ...ghostBtn, fontSize: 12, padding: "6px 12px", background: childFilter ? "#1a1a2e" : "none", color: childFilter ? "#fff" : "#374151", borderColor: childFilter ? "#1a1a2e" : "#e5e7eb" }}
            onClick={() => setChildFilter(f => !f)}
          >Sub-containers only</button>
          <button style={{ ...primaryBtn, fontSize: 12, padding: "6px 12px" }} onClick={openAdd}>+ Add Container</button>
        </div>
      </div>
      <div className="card" style={{ overflow: "hidden" }}>
        {(() => {
          const childrenOf = (parentId) => containers.filter(c => c.parent_container_id === parentId);

          const renderRow = (c, isChild = false) => {
            const ciList = containerItems.filter(ci => ci.container_id === c.id);
            const area = areas.find(a => a.id === c.area_id);
            const isExpanded = expandedId === c.id;
            const isMisc = c.type === "misc";
            const availableItems = items.filter(it => !ciList.find(ci => ci.item_id === it.id));
            const children = childrenOf(c.id);
            const childrenOpen = expandedParentIds.has(c.id);
            const parentName = isChild ? containers.find(p => p.id === c.parent_container_id)?.name : null;
            return (
              <div key={c.id}>
                <div style={{ borderBottom: "1px solid #f3f4f6", background: isChild ? "#f9fafb" : "#fff" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", paddingLeft: isChild ? 30 : 14 }}>
                    {isChild && <span style={{ color: "#d1d5db", fontSize: 12, marginRight: -4 }}>└</span>}
                    <span style={{ fontSize: 18 }}>{ctIcon(c.type)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 500, fontSize: 14 }}>{c.name}</span>
                        <span style={{ background: "#f3f4f6", color: "#6b7280", padding: "1px 7px", borderRadius: 99, fontSize: 11, fontWeight: 500 }}>{ctLabel(c.type)}</span>
                        {c.color && <span style={{ width: 12, height: 12, borderRadius: "50%", background: c.color, display: "inline-block", border: "1px solid rgba(0,0,0,0.1)", flexShrink: 0 }} />}
                        {parentName && <span style={{ background: "#fef3c7", color: "#b45309", fontSize: 10, padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>inside {parentName}</span>}
                      </div>
                      <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 1 }}>
                        {isMisc ? "Event-specific items" : `${ciList.length} item type${ciList.length !== 1 ? "s" : ""}`}
                        {area ? ` · ${area.name}` : ""}
                        {c.dim_w_ft && c.dim_d_ft ? ` · ${c.dim_w_ft}×${c.dim_d_ft}ft` : ""}
                        {c.notes ? ` · ${c.notes}` : ""}
                      </div>
                    </div>
                    {!isChild && children.length > 0 && (
                      <button style={{ ...ghostBtn, padding: "5px 10px", fontSize: 12 }} onClick={() => toggleParentExpand(c.id)}>
                        {childrenOpen ? `▼ ${children.length} sub` : `▶ ${children.length} sub`}
                      </button>
                    )}
                    {!isMisc && (
                      <button style={{ ...ghostBtn, padding: "5px 10px", fontSize: 12 }} onClick={() => setExpandedId(isExpanded ? null : c.id)}>
                        {isExpanded ? "▲ Items" : "▼ Items"}
                      </button>
                    )}
                    <button style={{ ...ghostBtn, padding: "5px 10px", fontSize: 12 }} onClick={() => openEdit(c)}>Edit</button>
                    <button style={{ ...dangerBtn, padding: "5px 10px" }} onClick={() => remove(c.id)}>Remove</button>
                  </div>
                  {isExpanded && !isMisc && (
                    <div style={{ padding: "0 14px 14px", paddingLeft: isChild ? 46 : 42, display: "flex", flexDirection: "column", gap: 6 }}>
                      {ciList.map(ci => {
                        const item = items.find(it => it.id === ci.item_id);
                        if (!item) return null;
                        return (
                          <div key={ci.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ flex: 1, fontSize: 13, color: "#374151" }}>{item.name}</span>
                            <button style={{ ...ghostBtn, padding: "2px 7px", fontSize: 13, lineHeight: 1 }} onClick={() => updateContainerItemQty(ci.id, ci.qty - 1)}>−</button>
                            <span style={{ fontSize: 13, minWidth: 20, textAlign: "center" }}>{ci.qty}</span>
                            <button style={{ ...ghostBtn, padding: "2px 7px", fontSize: 13, lineHeight: 1 }} onClick={() => updateContainerItemQty(ci.id, ci.qty + 1)}>+</button>
                            <button style={{ ...dangerBtn, padding: "3px 8px" }} onClick={() => removeContainerItem(ci.id)}>✕</button>
                          </div>
                        );
                      })}
                      {ciList.length === 0 && <div style={{ fontSize: 12, color: "#9ca3af" }}>No items yet</div>}
                      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4, borderTop: "1px solid #f3f4f6", paddingTop: 8 }}>
                        <ItemSearchInput items={availableItems} value={addItemForm.item_id} onChange={id => setAddItemForm(f => ({ ...f, item_id: id }))} placeholder="Search items..." />
                        <input type="number" value={addItemForm.qty} onChange={e => setAddItemForm(f => ({ ...f, qty: Number(e.target.value) }))} style={{ ...inputStyle, width: 58, fontSize: 13, padding: "6px 8px" }} min={1} />
                        <button style={{ ...primaryBtn, padding: "6px 12px", fontSize: 12 }} onClick={() => addItemToContainer(c.id)} disabled={addingItem || !addItemForm.item_id}>Add</button>
                      </div>
                    </div>
                  )}
                </div>
                {!isChild && childrenOpen && children.map(child => renderRow(child, true))}
              </div>
            );
          };

          if (childFilter) {
            const childContainers = containers.filter(c => c.parent_container_id);
            if (childContainers.length === 0) return <div style={{ padding: 16, fontSize: 13, color: "#9ca3af", textAlign: "center" }}>No sub-containers yet</div>;
            return childContainers.map(c => renderRow(c, true));
          }

          const topLevel = containers.filter(c => !c.parent_container_id);
          if (topLevel.length === 0) return <div style={{ padding: 16, fontSize: 13, color: "#9ca3af", textAlign: "center" }}>No containers yet</div>;
          return topLevel.map(c => renderRow(c));
        })()}
      </div>

      {showModal && (
        <Modal title={editContainer ? "Edit Container" : "Add Container"} onClose={() => setShowModal(false)} onSave={save} saveLabel={editContainer ? "Save" : "Add Container"} saving={saving} isMobile={m}>
          <label style={labelStyle}>Name</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={iStyle} placeholder="e.g. Medical Tote, Water Tote" autoFocus />
          <label style={labelStyle}>Type</label>
          <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={iStyle}>
            {CONTAINER_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
          </select>
          {form.type === "travel_case" && (
            <>
              <label style={labelStyle}>Linked Area (optional)</label>
              <select value={form.area_id} onChange={e => setForm(f => ({ ...f, area_id: e.target.value }))} style={iStyle}>
                <option value="">No area linked</option>
                {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </>
          )}
          <label style={labelStyle}>Trailer Diagram Size (optional)</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="number" value={form.dim_w_ft} onChange={e => setForm(f => ({ ...f, dim_w_ft: e.target.value }))} style={{ ...iStyle, flex: 1 }} placeholder="Width (ft)" min="0.5" step="0.5" />
            <span style={{ color: "#9ca3af", fontSize: 13 }}>×</span>
            <input type="number" value={form.dim_d_ft} onChange={e => setForm(f => ({ ...f, dim_d_ft: e.target.value }))} style={{ ...iStyle, flex: 1 }} placeholder="Depth (ft)" min="0.5" step="0.5" />
          </div>
          <label style={labelStyle}>Color (optional)</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => setForm(f => ({ ...f, color: "" }))} style={{ width: 28, height: 28, borderRadius: "50%", background: "#fff", border: form.color === "" ? "3px solid #111" : "2px solid #e5e7eb", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>✕</button>
            {CONTAINER_COLORS.map(col => (
              <button key={col} onClick={() => setForm(f => ({ ...f, color: col }))}
                style={{ width: 28, height: 28, borderRadius: "50%", background: col, border: form.color === col ? "3px solid #111" : "2px solid transparent", cursor: "pointer", outline: "none", padding: 0 }} />
            ))}
          </div>
          <label style={labelStyle}>Parent Container (optional)</label>
          <select value={form.parent_container_id} onChange={e => setForm(f => ({ ...f, parent_container_id: e.target.value }))} style={iStyle}>
            <option value="">None — top-level container</option>
            {containers.filter(c => !c.parent_container_id && c.id !== editContainer?.id).map(c => (
              <option key={c.id} value={c.id}>{ctIcon(c.type)} {c.name}</option>
            ))}
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
  const [containers, setContainers] = useState([]);
  const [containerItems, setContainerItems] = useState([]);
  const [eventContainerItems, setEventContainerItems] = useState([]);
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
  const [userPerms, setUserPerms] = useState({ can_view_dashboard: true, can_view_inventory: true, can_view_events: true, can_view_reports: true, can_view_tech: false });

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

  useEffect(() => {
    if (!session || session.user.email === ADMIN_EMAIL) return;
    api.getUserPerms(session.user.email)
      .then(rows => {
        if (!rows[0]) return;
        const p = rows[0];
        setUserPerms(p);
        const ok = (v) => v !== false;
        setView(cur => {
          const accessible = [
            ok(p.can_view_dashboard) && "dashboard",
            ok(p.can_view_inventory) && "inventory",
            ok(p.can_view_events) && "events",
            ok(p.can_view_reports) && "reports",
            p.can_view_tech && "tech",
          ].filter(Boolean);
          const curBase = cur === "event-detail" ? "events" : cur;
          return accessible.includes(curBase) ? cur : (accessible[0] || cur);
        });
      })
      .catch(() => {});
  }, [session]);

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
      const [i, e, p, cats, tr, et, ar, ai, rp, ri, co, ci, eci, logoUrl] = await Promise.all([
        api.getItems(), api.getEvents(), api.getAllPacking(),
        api.getCategories(), api.getTrailers(), api.getEventTrailers(),
        api.getAreas(), api.getAreaItems(), api.getReports(), api.getReportItems(),
        api.getContainers(), api.getContainerItems(), api.getEventContainerItems(),
        checkOrgLogoExists()
      ]);
      setItems(i); setEvents(e); setPacking(p);
      setCategories(cats); setTrailers(tr); setEventTrailers(et);
      setAreas(ar); setAreaItems(ai); setReports(rp); setReportItems(ri);
      setContainers(co); setContainerItems(ci); setEventContainerItems(eci);
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
  const ok = (v) => v !== false;
  const canViewDashboard = isAdmin || ok(userPerms.can_view_dashboard);
  const canViewInventory = isAdmin || ok(userPerms.can_view_inventory);
  const canViewEvents    = isAdmin || ok(userPerms.can_view_events);
  const canViewReports   = isAdmin || ok(userPerms.can_view_reports);
  const canViewTech      = isAdmin || !!userPerms.can_view_tech;
  const canViewContainers = isAdmin || ok(userPerms.can_view_inventory);
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
          {canViewDashboard && <button className={`nav-btn ${view === "dashboard" ? "active" : ""}`} onClick={() => setView("dashboard")}>Dashboard</button>}
          {canViewInventory && <button className={`nav-btn ${view === "inventory" ? "active" : ""}`} onClick={() => setView("inventory")}>Inventory</button>}
          {canViewContainers && <button className={`nav-btn ${view === "containers" ? "active" : ""}`} onClick={() => setView("containers")}>Containers</button>}
          {canViewEvents && <button className={`nav-btn ${["events", "event-detail"].includes(view) ? "active" : ""}`} onClick={() => setView("events")}>Events</button>}
          {canViewReports && <button className={`nav-btn ${view === "reports" ? "active" : ""}`} onClick={() => setView("reports")}>Reports</button>}
          {canViewTech && <button className={`nav-btn ${view === "tech" ? "active" : ""}`} onClick={() => setView("tech")}>Tech Setups</button>}
          {isAdmin && <button className={`nav-btn ${view === "users" ? "active" : ""}`} onClick={() => setView("users")}>Users</button>}
        </>}
        <div style={{ flex: 1 }} />
        {!m && <button style={{ background: "none", border: "none", fontSize: 13, padding: "6px 10px", color: "#9ca3af", cursor: "pointer", fontFamily: "inherit" }} onClick={handleLogout}>Sign out</button>}
        <button style={{ background: "none", border: "none", fontSize: 20, padding: "8px", color: "#9ca3af", cursor: "pointer", lineHeight: 1 }} onClick={() => { setPendingLogo(orgLogo); setShowSettings(true); }}>⚙️</button>
      </div>

      <div style={{ padding: m ? "16px 16px 90px" : "28px 24px", maxWidth: m ? "100%" : 960, margin: "0 auto" }}>
        {view === "dashboard" && canViewDashboard && <Dashboard isMobile={m} items={items} events={events} packing={packing} trailers={trailers} setView={setView} setSelectedEventId={setSelectedEventId} />}
        {view === "inventory" && canViewInventory && <Inventory isMobile={m} items={items} setItems={setItems} categories={categoryNames} packing={packing} showToast={showToast} />}
        {view === "containers" && canViewContainers && <ContainersPage isMobile={m} containers={containers} setContainers={setContainers} containerItems={containerItems} setContainerItems={setContainerItems} items={items} areas={areas} showToast={showToast} />}
        {view === "events" && canViewEvents && <Events isMobile={m} events={events} setEvents={setEvents} packing={packing} setPacking={setPacking} eventTrailers={eventTrailers} setEventTrailers={setEventTrailers} setView={setView} setSelectedEventId={setSelectedEventId} showToast={showToast} />}
        {view === "event-detail" && canViewEvents && selectedEvent && <EventDetail isMobile={m} event={selectedEvent} events={events} setEvents={setEvents} items={items} eventPacking={eventPacking} packing={packing} setPacking={setPacking} trailers={trailers} eventTrailers={eventTrailers} setEventTrailers={setEventTrailers} containers={containers} containerItems={containerItems} eventContainerItems={eventContainerItems} setEventContainerItems={setEventContainerItems} setView={setView} showToast={showToast} />}
        {view === "reports" && canViewReports && <Reports isMobile={m} reports={reports} setReports={setReports} reportItems={reportItems} events={events} areas={areas} setAreas={setAreas} areaItems={areaItems} setAreaItems={setAreaItems} items={items} setItems={setItems} showToast={showToast} />}
        {view === "tech" && canViewTech && <TechSetups isMobile={m} events={events} showToast={showToast} />}
        {view === "users" && isAdmin && <UserManagement isMobile={m} showToast={showToast} currentUserEmail={session.user.email} />}
      </div>

      {m && (
        <nav className="tab-bar">
          {canViewDashboard && <button className={`tab-btn ${view === "dashboard" ? "active" : ""}`} onClick={() => setView("dashboard")}><span className="tab-icon">🏠</span>Dashboard</button>}
          {canViewInventory && <button className={`tab-btn ${view === "inventory" ? "active" : ""}`} onClick={() => setView("inventory")}><span className="tab-icon">📦</span>Inventory</button>}
          {canViewContainers && <button className={`tab-btn ${view === "containers" ? "active" : ""}`} onClick={() => setView("containers")}><span className="tab-icon">🗃️</span>Containers</button>}
          {canViewEvents && <button className={`tab-btn ${["events", "event-detail"].includes(view) ? "active" : ""}`} onClick={() => setView("events")}><span className="tab-icon">📅</span>Events</button>}
          {canViewReports && <button className={`tab-btn ${view === "reports" ? "active" : ""}`} onClick={() => setView("reports")}><span className="tab-icon">📋</span>Reports</button>}
          {canViewTech && <button className={`tab-btn ${view === "tech" ? "active" : ""}`} onClick={() => setView("tech")}><span className="tab-icon">📶</span>Tech</button>}
          {isAdmin && <button className={`tab-btn ${view === "users" ? "active" : ""}`} onClick={() => setView("users")}><span className="tab-icon">👥</span>Users</button>}
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

// ─── Containers Page ──────────────────────────────────────────────────────────
function ContainersPage({ isMobile: m, containers, setContainers, containerItems, setContainerItems, items, areas, showToast }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: m ? 14 : 20 }}>
      <div>
        <h1 style={{ fontSize: m ? 20 : 22, fontWeight: 600, marginBottom: 4 }}>Containers</h1>
        <p style={{ color: "#6b7280", fontSize: 14 }}>Manage totes, travel cases, and rolling bins — and what goes inside each one.</p>
      </div>
      <ContainerManager
        containers={containers}
        setContainers={setContainers}
        containerItems={containerItems}
        setContainerItems={setContainerItems}
        items={items}
        areas={areas}
        showToast={showToast}
        isMobile={m}
      />
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
  const openAdd = () => { setForm({ name: "", category: categories[0] || "", qty: 1, notes: "", dim_w_ft: "", dim_d_ft: "" }); setEditItem(null); setShowModal(true); };
  const openEdit = (item) => { setForm({ name: item.name, category: item.category, qty: item.qty, notes: item.notes || "", dim_w_ft: item.dim_w_ft ?? "", dim_d_ft: item.dim_d_ft ?? "" }); setEditItem(item); setShowModal(true); };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        dim_w_ft: form.dim_w_ft !== "" ? parseFloat(form.dim_w_ft) : null,
        dim_d_ft: form.dim_d_ft !== "" ? parseFloat(form.dim_d_ft) : null,
      };
      if (editItem) {
        await api.updateItem(editItem.id, payload);
        setItems(prev => prev.map(i => i.id === editItem.id ? { ...i, ...payload } : i));
        showToast("Item updated");
      } else {
        const created = await api.addItem(payload);
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
          <label style={labelStyle}>Trailer Diagram Size (optional)</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="number" value={form.dim_w_ft} onChange={e => setForm(f => ({ ...f, dim_w_ft: e.target.value }))} style={{ ...iStyle, flex: 1 }} placeholder="Width (ft)" min="0.5" step="0.5" />
            <span style={{ color: "#9ca3af", fontSize: 13 }}>×</span>
            <input type="number" value={form.dim_d_ft} onChange={e => setForm(f => ({ ...f, dim_d_ft: e.target.value }))} style={{ ...iStyle, flex: 1 }} placeholder="Depth (ft)" min="0.5" step="0.5" />
          </div>
          <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>Floor footprint on the trailer diagram. Width = along trailer length, Depth = driver to passenger.</p>
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
function EventDetail({ isMobile: m, event, events, setEvents, items, eventPacking, packing, setPacking, trailers, eventTrailers, setEventTrailers, containers, containerItems, eventContainerItems, setEventContainerItems, setView, showToast }) {
  const [activeTab, setActiveTab] = useState("all"); // "all" | trailer id
  const [showDiagram, setShowDiagram] = useState(false);
  const [diagramView, setDiagramView] = useState("web"); // "web" | "imported"
  const [uploadingDiagram, setUploadingDiagram] = useState(false);
  const diagramInputRef = useRef();
  const [showAddItem, setShowAddItem] = useState(false);
  const [addItemId, setAddItemId] = useState("");
  const [addQty, setAddQty] = useState(1);
  const [addTrailerId, setAddTrailerId] = useState("");
  const [addMode, setAddMode] = useState("inventory");
  const [adHocName, setAdHocName] = useState("");
  const [adHocDimW, setAdHocDimW] = useState("");
  const [adHocDimD, setAdHocDimD] = useState("");
  const [saving, setSaving] = useState(false);
  const [showCopy, setShowCopy] = useState(false);
  const [copyEventId, setCopyEventId] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [showTrailerManager, setShowTrailerManager] = useState(false);
  const [addContainerId, setAddContainerId] = useState("");
  const [expandedContainerId, setExpandedContainerId] = useState(null);
  const [miscItemForm, setMiscItemForm] = useState({ item_id: "", qty: 1 });
  const [miscSaving, setMiscSaving] = useState(false);
  const [showPackingLists, setShowPackingLists] = useState(false);
  const [packingListTab, setPackingListTab] = useState("trailer");
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
    setSaving(true);
    try {
      if (addMode === "container") {
        if (!addContainerId) { setSaving(false); return; }
        if (eventPacking.find(p => p.container_id === addContainerId)) { showToast("Container already in list"); setSaving(false); return; }
        const entry = { event_id: event.id, container_id: addContainerId, item_id: null, qty_needed: 1, packed: false, returned: false };
        if (addTrailerId) entry.trailer_id = addTrailerId;
        const created = await api.addPacking(entry);
        setPacking(prev => [...prev, created[0]]);
        showToast("Container added");
      } else if (addMode === "temp") {
        if (!adHocName.trim()) { setSaving(false); return; }
        const entry = {
          event_id: event.id, item_id: null,
          ad_hoc_name: adHocName.trim(),
          ad_hoc_dim_w_ft: adHocDimW !== "" ? parseFloat(adHocDimW) : null,
          ad_hoc_dim_d_ft: adHocDimD !== "" ? parseFloat(adHocDimD) : null,
          qty_needed: addQty, packed: false, returned: false,
        };
        if (addTrailerId) entry.trailer_id = addTrailerId;
        const created = await api.addPacking(entry);
        setPacking(prev => [...prev, created[0]]);
        showToast("Temp item added");
      } else {
        if (!addItemId) { setSaving(false); return; }
        if (eventPacking.find(p => p.item_id === addItemId)) { showToast("Already in list"); setSaving(false); return; }
        const entry = { event_id: event.id, item_id: addItemId, qty_needed: addQty, packed: false, returned: false };
        if (addTrailerId) entry.trailer_id = addTrailerId;
        const created = await api.addPacking(entry);
        setPacking(prev => [...prev, created[0]]);
        showToast("Item added");
      }
      setShowAddItem(false);
    } catch { showToast("Error adding item"); }
    setSaving(false);
  };

  const addMiscItem = async (entry) => {
    if (!miscItemForm.item_id) return;
    setMiscSaving(true);
    try {
      const created = await api.addEventContainerItem({ event_id: event.id, container_id: entry.container_id, item_id: miscItemForm.item_id, qty: miscItemForm.qty || 1 });
      setEventContainerItems(prev => [...prev, created[0]]);
      setMiscItemForm({ item_id: "", qty: 1 });
      showToast("Item added");
    } catch { showToast("Error adding item"); }
    setMiscSaving(false);
  };

  const removeMiscItem = async (id) => {
    try { await api.deleteEventContainerItem(id); setEventContainerItems(prev => prev.filter(e => e.id !== id)); }
    catch { showToast("Error removing item"); }
  };

  const updateMiscItemQty = async (id, qty) => {
    if (qty < 1) return;
    try { await api.updateEventContainerItem(id, { qty }); setEventContainerItems(prev => prev.map(e => e.id === id ? { ...e, qty } : e)); }
    catch { showToast("Error updating qty"); }
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
  const availableContainers = containers.filter(c => !eventPacking.find(p => p.container_id === c.id));
  const otherEvents = events.filter(e => e.id !== event.id && packing.some(p => p.event_id === e.id));
  const iStyle = m ? inputStyleMobile : inputStyle;

  // Filter packing by active tab
  const visiblePacking = activeTab === "all"
    ? eventPacking
    : activeTab === "unassigned"
    ? eventPacking.filter(p => !p.trailer_id)
    : eventPacking.filter(p => p.trailer_id === activeTab);

  const activeTrailer = assignedTrailers.find(t => t.id === activeTab);
  const activeEventTrailer = assignedEventTrailers.find(et => et.trailer_id === activeTab);

  const uploadTrailerDiagram = async (file) => {
    if (!file || !activeEventTrailer) return;
    setUploadingDiagram(true);
    try {
      const url = await api.uploadDiagram(file, event.id, activeTrailer.id);
      await api.updateEventTrailer(activeEventTrailer.id, { diagram_url: url });
      setEventTrailers(prev => prev.map(et => et.id === activeEventTrailer.id ? { ...et, diagram_url: url } : et));
      setDiagramView("imported");
      setShowDiagram(true);
      showToast("Diagram uploaded");
    } catch { showToast("Error uploading diagram"); }
    setUploadingDiagram(false);
  };

  const removeTrailerDiagram = async () => {
    if (!activeEventTrailer) return;
    try {
      await api.updateEventTrailer(activeEventTrailer.id, { diagram_url: null });
      setEventTrailers(prev => prev.map(et => et.id === activeEventTrailer.id ? { ...et, diagram_url: null } : et));
      setDiagramView("web");
      showToast("Diagram removed");
    } catch { showToast("Error removing diagram"); }
  };

  // Split container entries from loose items
  const containerPacking = visiblePacking.filter(p => p.container_id).map(p => ({
    ...p, container: containers.find(c => c.id === p.container_id),
  }));
  const loosePacking = visiblePacking.filter(p => !p.container_id);

  // Group loose items by category (temp items go under "Temporary")
  const grouped = {};
  loosePacking.forEach(p => {
    const item = items.find(i => i.id === p.item_id);
    if (!item && !p.ad_hoc_name) return;
    const cat = item?.category || "Temporary";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push({ ...p, item: item || null });
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
            <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexShrink: 0 }}>
              <input ref={diagramInputRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }}
                onChange={e => { if (e.target.files[0]) uploadTrailerDiagram(e.target.files[0]); e.target.value = ""; }} />
              <button onClick={() => diagramInputRef.current.click()} disabled={uploadingDiagram}
                style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, fontFamily: "inherit", cursor: "pointer", border: "1px solid #e5e7eb", background: "#fff", color: "#374151", whiteSpace: "nowrap", opacity: uploadingDiagram ? 0.5 : 1 }}>
                {uploadingDiagram ? "Uploading..." : "⬆ Import PNG"}
              </button>
              <button onClick={() => setShowDiagram(d => !d)}
                style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, fontFamily: "inherit", cursor: "pointer", border: "1px solid #e5e7eb", background: showDiagram ? "#1a1a2e" : "#fff", color: showDiagram ? "#fff" : "#374151", whiteSpace: "nowrap" }}>
                {showDiagram ? "Hide Diagram" : "Show Diagram"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Trailer diagram */}
      {activeTrailer && showDiagram && (
        <div>
          {activeEventTrailer?.diagram_url && (
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              <button onClick={() => setDiagramView("web")}
                style={{ padding: "5px 12px", borderRadius: 7, fontSize: 12, fontFamily: "inherit", cursor: "pointer", border: "1px solid #e5e7eb", background: diagramView === "web" ? "#1a1a2e" : "#fff", color: diagramView === "web" ? "#fff" : "#374151" }}>
                Web Diagram
              </button>
              <button onClick={() => setDiagramView("imported")}
                style={{ padding: "5px 12px", borderRadius: 7, fontSize: 12, fontFamily: "inherit", cursor: "pointer", border: "1px solid #e5e7eb", background: diagramView === "imported" ? "#1a1a2e" : "#fff", color: diagramView === "imported" ? "#fff" : "#374151" }}>
                Imported Image
              </button>
              <button onClick={removeTrailerDiagram}
                style={{ padding: "5px 10px", borderRadius: 7, fontSize: 12, fontFamily: "inherit", cursor: "pointer", border: "1px solid #fca5a5", background: "none", color: "#dc2626", marginLeft: "auto" }}>
                Remove Image
              </button>
            </div>
          )}
          {diagramView === "imported" && activeEventTrailer?.diagram_url ? (
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
              <img src={activeEventTrailer.diagram_url} alt={`Trailer ${activeTrailer.number} diagram`}
                style={{ width: "100%", display: "block", objectFit: "contain", maxHeight: 520 }} />
            </div>
          ) : (
            <TrailerCanvas
              trailer={activeTrailer}
              packingEntries={visiblePacking.map(p => ({ ...p, item: items.find(i => i.id === p.item_id), container: containers.find(c => c.id === p.container_id) }))}
              setPacking={setPacking}
              showToast={showToast}
              eventName={event.name}
            />
          )}
        </div>
      )}

      {/* Packing list header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: m ? 15 : 14, fontWeight: 600 }}>
          {activeTab === "all" ? "All Items" : activeTab === "unassigned" ? "Unassigned Items" : `Trailer ${activeTrailer?.number}`}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {otherEvents.length > 0 && <button style={{ ...ghostBtn, fontSize: m ? 13 : 12, padding: m ? "8px 12px" : "7px 14px" }} onClick={() => { setCopyEventId(otherEvents[0].id); setShowCopy(true); }}>Copy</button>}
          <button style={{ ...ghostBtn, padding: m ? "8px 12px" : "7px 14px", fontSize: m ? 13 : 12 }} onClick={() => { setPackingListTab("trailer"); setShowPackingLists(true); }}>📋 Lists</button>
          <button style={{ ...primaryBtn, padding: m ? "8px 14px" : "8px 16px" }} onClick={() => { setAddContainerId(availableContainers[0]?.id || ""); setAddItemId(availableToAdd[0]?.id || ""); setAddQty(1); setAddTrailerId(activeTab !== "all" && activeTab !== "unassigned" ? activeTab : ""); setAddMode("container"); setAdHocName(""); setAdHocDimW(""); setAdHocDimD(""); setShowAddItem(true); }}>+ Add</button>
        </div>
      </div>

      {containerPacking.length === 0 && Object.keys(grouped).length === 0 && (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
          {activeTab === "unassigned" ? "No unassigned items" : "No items yet — add containers or large items"}
        </div>
      )}

      {/* Container accordion entries */}
      {containerPacking.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Containers</div>
          <div className="card" style={{ overflow: "hidden" }}>
            {containerPacking.map((entry, i) => {
              const c = entry.container;
              if (!c) return null;
              const isMisc = c.type === "misc";
              const ciList = isMisc
                ? eventContainerItems.filter(e => e.event_id === event.id && e.container_id === c.id)
                : containerItems.filter(ci => ci.container_id === c.id);
              const isExpanded = expandedContainerId === entry.id;
              return (
                <div key={entry.id} style={{ borderBottom: i < containerPacking.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                  {m ? (
                    <div style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 16 }}>{ctIcon(c.type)}</span>
                            <span style={{ fontWeight: 500, fontSize: 15 }}>{c.name}</span>
                            <span style={{ background: "#f3f4f6", color: "#6b7280", padding: "1px 7px", borderRadius: 99, fontSize: 11, fontWeight: 500 }}>{ctLabel(c.type)}</span>
                            {c.color && <span style={{ width: 10, height: 10, borderRadius: "50%", background: c.color, display: "inline-block", border: "1px solid rgba(0,0,0,0.1)" }} />}
                            {c.parent_container_id && (() => { const par = containers.find(p => p.id === c.parent_container_id); return par ? <span style={{ background: "#fef3c7", color: "#b45309", fontSize: 10, padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>inside {par.name}</span> : null; })()}
                          </div>
                          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
                            {isMisc ? `${ciList.length} event item${ciList.length !== 1 ? "s" : ""}` : `${ciList.length} item type${ciList.length !== 1 ? "s" : ""}`}
                          </div>
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
                        </div>
                        <button style={{ ...dangerBtn, padding: "6px 10px", marginLeft: 8 }} onClick={() => removeFromList(entry.id)}>✕</button>
                      </div>
                      <div style={{ display: "flex", gap: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, background: entry.packed ? "#f0fdf4" : "#f8f9fb", borderRadius: 8, padding: "10px 14px", cursor: "pointer", border: `1px solid ${entry.packed ? "#bbf7d0" : "#e5e7eb"}` }}
                          onClick={() => toggleField(entry, "packed")}>
                          <div className={`check-box-mobile ${entry.packed ? "checked" : ""}`}>{entry.packed && <Checkmark />}</div>
                          <span style={{ fontSize: 14, fontWeight: 500, color: entry.packed ? "#15803d" : "#374151" }}>Packed</span>
                        </div>
                        <button style={{ ...ghostBtn, flex: 1, fontSize: 13, padding: "10px" }} onClick={() => setExpandedContainerId(isExpanded ? null : entry.id)}>
                          {isExpanded ? "▲ Items" : "▼ Items"}
                        </button>
                      </div>
                      {isExpanded && (
                        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                          {ciList.map(ci => {
                            const it = items.find(x => x.id === ci.item_id);
                            if (!it) return null;
                            return (
                              <div key={ci.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #f3f4f6" }}>
                                <span style={{ flex: 1, fontSize: 13, color: "#374151" }}>{it.name}</span>
                                {isMisc ? (
                                  <>
                                    <button style={{ ...ghostBtn, padding: "2px 7px", fontSize: 13, lineHeight: 1 }} onClick={() => updateMiscItemQty(ci.id, ci.qty - 1)}>−</button>
                                    <span style={{ fontSize: 13, minWidth: 20, textAlign: "center" }}>{ci.qty}</span>
                                    <button style={{ ...ghostBtn, padding: "2px 7px", fontSize: 13, lineHeight: 1 }} onClick={() => updateMiscItemQty(ci.id, ci.qty + 1)}>+</button>
                                    <button style={{ ...dangerBtn, padding: "3px 8px" }} onClick={() => removeMiscItem(ci.id)}>✕</button>
                                  </>
                                ) : (
                                  <span style={{ fontSize: 13, color: "#9ca3af" }}>×{ci.qty}</span>
                                )}
                              </div>
                            );
                          })}
                          {ciList.length === 0 && <div style={{ fontSize: 12, color: "#9ca3af" }}>{isMisc ? "No items added yet" : "No items in loadout"}</div>}
                          {isMisc && (
                            <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4, paddingTop: 8, borderTop: "1px solid #f3f4f6" }}>
                              <select value={miscItemForm.item_id} onChange={e => setMiscItemForm(f => ({ ...f, item_id: e.target.value }))} style={{ ...inputStyleMobile, flex: 1, fontSize: 14 }}>
                                <option value="">Select item...</option>
                                {items.filter(it => !ciList.find(ci => ci.item_id === it.id)).map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                              </select>
                              <input type="number" value={miscItemForm.qty} onChange={e => setMiscItemForm(f => ({ ...f, qty: Number(e.target.value) }))} style={{ ...inputStyleMobile, width: 64, fontSize: 14 }} min={1} />
                              <button style={{ ...primaryBtn, padding: "11px 14px" }} onClick={() => addMiscItem(entry)} disabled={miscSaving || !miscItemForm.item_id}>Add</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div className={`check-box-desktop ${entry.packed ? "checked" : ""}`} onClick={() => toggleField(entry, "packed")}>{entry.packed && <Checkmark />}</div>
                        <span style={{ fontSize: 11, color: "#9ca3af" }}>Packed</span>
                        <span style={{ fontSize: 18 }}>{ctIcon(c.type)}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 14, fontWeight: 500 }}>{c.name}</span>
                            <span style={{ background: "#f3f4f6", color: "#6b7280", padding: "1px 7px", borderRadius: 99, fontSize: 11, fontWeight: 500 }}>{ctLabel(c.type)}</span>
                            {c.color && <span style={{ width: 10, height: 10, borderRadius: "50%", background: c.color, display: "inline-block", border: "1px solid rgba(0,0,0,0.1)" }} />}
                            {c.parent_container_id && (() => { const par = containers.find(p => p.id === c.parent_container_id); return par ? <span style={{ background: "#fef3c7", color: "#b45309", fontSize: 10, padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>inside {par.name}</span> : null; })()}
                          </div>
                          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                            <span style={{ fontSize: 12, color: "#9ca3af" }}>{isMisc ? `${ciList.length} event item${ciList.length !== 1 ? "s" : ""}` : `${ciList.length} item type${ciList.length !== 1 ? "s" : ""}`}</span>
                            {assignedTrailers.length > 0 && assignedTrailers.map(t => (
                              <button key={t.id} onClick={() => assignTrailerToItem(entry, t.id)}
                                style={{ padding: "2px 8px", borderRadius: 99, fontSize: 11, fontFamily: "inherit", cursor: "pointer", fontWeight: 500, border: `1px solid ${entry.trailer_id === t.id ? "#1a1a2e" : "#e5e7eb"}`, background: entry.trailer_id === t.id ? "#1a1a2e" : "#fff", color: entry.trailer_id === t.id ? "#fff" : "#6b7280" }}>
                                🚛 {t.number}
                              </button>
                            ))}
                          </div>
                        </div>
                        <button style={{ ...ghostBtn, padding: "5px 10px", fontSize: 12 }} onClick={() => setExpandedContainerId(isExpanded ? null : entry.id)}>
                          {isExpanded ? "▲ Items" : "▼ Items"}
                        </button>
                        <button style={{ ...dangerBtn, padding: "4px 8px", fontSize: 11 }} onClick={() => removeFromList(entry.id)}>✕</button>
                      </div>
                      {isExpanded && (
                        <div style={{ marginTop: 10, paddingLeft: 56, display: "flex", flexDirection: "column", gap: 4 }}>
                          {ciList.map(ci => {
                            const it = items.find(x => x.id === ci.item_id);
                            if (!it) return null;
                            return (
                              <div key={ci.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ flex: 1, fontSize: 13, color: "#374151" }}>{it.name}</span>
                                {isMisc ? (
                                  <>
                                    <button style={{ ...ghostBtn, padding: "1px 6px", fontSize: 12, lineHeight: 1 }} onClick={() => updateMiscItemQty(ci.id, ci.qty - 1)}>−</button>
                                    <span style={{ fontSize: 13, minWidth: 20, textAlign: "center" }}>{ci.qty}</span>
                                    <button style={{ ...ghostBtn, padding: "1px 6px", fontSize: 12, lineHeight: 1 }} onClick={() => updateMiscItemQty(ci.id, ci.qty + 1)}>+</button>
                                    <button style={{ ...dangerBtn, padding: "2px 7px", fontSize: 11 }} onClick={() => removeMiscItem(ci.id)}>✕</button>
                                  </>
                                ) : (
                                  <span style={{ fontSize: 12, color: "#9ca3af" }}>×{ci.qty}</span>
                                )}
                              </div>
                            );
                          })}
                          {ciList.length === 0 && <div style={{ fontSize: 12, color: "#9ca3af" }}>{isMisc ? "No items added yet" : "No items in loadout"}</div>}
                          {isMisc && (
                            <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6, paddingTop: 6, borderTop: "1px solid #f3f4f6" }}>
                              <select value={miscItemForm.item_id} onChange={e => setMiscItemForm(f => ({ ...f, item_id: e.target.value }))} style={{ ...inputStyle, flex: 1, fontSize: 13, padding: "6px 10px" }}>
                                <option value="">Select item...</option>
                                {items.filter(it => !ciList.find(ci => ci.item_id === it.id)).map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                              </select>
                              <input type="number" value={miscItemForm.qty} onChange={e => setMiscItemForm(f => ({ ...f, qty: Number(e.target.value) }))} style={{ ...inputStyle, width: 58, fontSize: 13, padding: "6px 8px" }} min={1} />
                              <button style={{ ...primaryBtn, padding: "7px 12px", fontSize: 12 }} onClick={() => addMiscItem(entry)} disabled={miscSaving || !miscItemForm.item_id}>Add</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {Object.entries(grouped).map(([cat, entries]) => (
        <div key={cat}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>{cat}</div>
          <div className="card" style={{ overflow: "hidden" }}>
            {entries.map((entry, i) => {
              const entryTrailer = trailers.find(t => t.id === entry.trailer_id);
              const isTemp = !entry.item_id && !!entry.ad_hoc_name;
              const displayName = entry.item?.name || entry.ad_hoc_name || "Item";
              return (
                <div key={entry.id} style={{ padding: m ? "14px 16px" : "12px 16px", borderBottom: i < entries.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                  {m ? (
                    <>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 500, fontSize: 15, textDecoration: entry.returned ? "line-through" : "none", color: entry.returned ? "#9ca3af" : "#111" }}>{displayName}</span>
                            {isTemp && <span style={{ background: "#f3e8ff", color: "#7c3aed", fontSize: 10, padding: "1px 6px", borderRadius: 4, fontWeight: 600, letterSpacing: "0.03em" }}>TEMP</span>}
                          </div>
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
                          {entry.item?.notes && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{entry.item.notes}</div>}
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
                        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 14, fontWeight: 500, textDecoration: entry.returned ? "line-through" : "none", color: entry.returned ? "#9ca3af" : "#111" }}>{displayName}</span>
                          {isTemp && <span style={{ background: "#f3e8ff", color: "#7c3aed", fontSize: 10, padding: "1px 6px", borderRadius: 4, fontWeight: 600, letterSpacing: "0.03em" }}>TEMP</span>}
                        </div>
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
                        {entry.item?.notes && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{entry.item.notes}</div>}
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
          <div style={{ display: "flex", gap: 4, background: "#f3f4f6", borderRadius: 8, padding: 4 }}>
            <button style={{ flex: 1, padding: "7px", border: "none", borderRadius: 6, fontSize: 13, fontFamily: "inherit", cursor: "pointer", fontWeight: 500, background: addMode === "container" ? "#fff" : "transparent", color: addMode === "container" ? "#2563eb" : "#6b7280", boxShadow: addMode === "container" ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }} onClick={() => setAddMode("container")}>📦 Container</button>
            <button style={{ flex: 1, padding: "7px", border: "none", borderRadius: 6, fontSize: 13, fontFamily: "inherit", cursor: "pointer", fontWeight: 500, background: addMode === "inventory" ? "#fff" : "transparent", color: addMode === "inventory" ? "#111" : "#6b7280", boxShadow: addMode === "inventory" ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }} onClick={() => setAddMode("inventory")}>Item</button>
            <button style={{ flex: 1, padding: "7px", border: "none", borderRadius: 6, fontSize: 13, fontFamily: "inherit", cursor: "pointer", fontWeight: 500, background: addMode === "temp" ? "#fff" : "transparent", color: addMode === "temp" ? "#7c3aed" : "#6b7280", boxShadow: addMode === "temp" ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }} onClick={() => setAddMode("temp")}>Temp</button>
          </div>
          {addMode === "container" ? (
            <>
              <label style={labelStyle}>Select Container</label>
              <select value={addContainerId} onChange={e => setAddContainerId(e.target.value)} style={iStyle}>
                {availableContainers.length === 0
                  ? <option value="">All containers already added</option>
                  : availableContainers.map(c => {
                      const parent = containers.find(p => p.id === c.parent_container_id);
                      return <option key={c.id} value={c.id}>{ctIcon(c.type)} {c.name}{parent ? ` — inside ${parent.name}` : ""} ({ctLabel(c.type)})</option>;
                    })
                }
              </select>
              {assignedTrailers.length > 0 && (
                <>
                  <label style={labelStyle}>Assign to Trailer (optional)</label>
                  <select value={addTrailerId} onChange={e => setAddTrailerId(e.target.value)} style={iStyle}>
                    <option value="">No trailer assigned</option>
                    {assignedTrailers.map(t => <option key={t.id} value={t.id}>Trailer {t.number}</option>)}
                  </select>
                </>
              )}
            </>
          ) : addMode === "inventory" ? (
            <>
              <label style={labelStyle}>Select Item</label>
              {availableToAdd.length === 0
                ? <div style={{ fontSize: 13, color: "#9ca3af", padding: "8px 0" }}>All items already added</div>
                : <ItemSearchInput items={availableToAdd} value={addItemId} onChange={setAddItemId} placeholder="Search items..." style={{ flex: "none", width: "100%" }} />
              }
            </>
          ) : (
            <>
              <label style={labelStyle}>Item Name</label>
              <input value={adHocName} onChange={e => setAdHocName(e.target.value)} style={iStyle} placeholder="e.g. Production Co. Speakers" autoFocus />
              <label style={labelStyle}>Diagram Size (optional)</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="number" value={adHocDimW} onChange={e => setAdHocDimW(e.target.value)} style={{ ...iStyle, flex: 1 }} placeholder="Width (ft)" min="0.5" step="0.5" />
                <span style={{ color: "#9ca3af", fontSize: 13 }}>×</span>
                <input type="number" value={adHocDimD} onChange={e => setAdHocDimD(e.target.value)} style={{ ...iStyle, flex: 1 }} placeholder="Depth (ft)" min="0.5" step="0.5" />
              </div>
              <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>Event-specific — won't affect master inventory.</p>
            </>
          )}
          {addMode !== "container" && (
            <>
              <label style={labelStyle}>Qty Needed</label>
              <input type="number" value={addQty} onChange={e => setAddQty(Number(e.target.value))} style={iStyle} min={1} />
            </>
          )}
          {addMode !== "container" && assignedTrailers.length > 0 && (
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

      {showPackingLists && (
        <Modal title="Packing Lists" onClose={() => setShowPackingLists(false)} onSave={() => setShowPackingLists(false)} saveLabel="Done" saving={false} isMobile={m} wide>
          <div style={{ display: "flex", gap: 4, background: "#f3f4f6", borderRadius: 8, padding: 4, marginBottom: 4 }}>
            <button style={{ flex: 1, padding: "7px", border: "none", borderRadius: 6, fontSize: 13, fontFamily: "inherit", cursor: "pointer", fontWeight: 500, background: packingListTab === "trailer" ? "#fff" : "transparent", color: packingListTab === "trailer" ? "#111" : "#6b7280", boxShadow: packingListTab === "trailer" ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }} onClick={() => setPackingListTab("trailer")}>By Trailer</button>
            <button style={{ flex: 1, padding: "7px", border: "none", borderRadius: 6, fontSize: 13, fontFamily: "inherit", cursor: "pointer", fontWeight: 500, background: packingListTab === "container" ? "#fff" : "transparent", color: packingListTab === "container" ? "#111" : "#6b7280", boxShadow: packingListTab === "container" ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }} onClick={() => setPackingListTab("container")}>By Container</button>
          </div>

          {packingListTab === "trailer" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {assignedTrailers.length === 0 && <div style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: 20 }}>No trailers assigned to this event</div>}
              {assignedTrailers.map(t => {
                const tContainers = eventPacking.filter(p => p.container_id && p.trailer_id === t.id).map(p => ({ ...p, container: containers.find(c => c.id === p.container_id) }));
                const tLoose = eventPacking.filter(p => !p.container_id && p.trailer_id === t.id);
                return (
                  <div key={t.id}>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, paddingBottom: 6, borderBottom: "2px solid #1a1a2e" }}>🚛 Trailer {t.number}</div>
                    {tContainers.length === 0 && tLoose.length === 0 && <div style={{ fontSize: 12, color: "#9ca3af" }}>Nothing assigned to this trailer</div>}
                    {tContainers.map(entry => {
                      const c = entry.container;
                      if (!c) return null;
                      const isMisc = c.type === "misc";
                      const ciList = isMisc
                        ? eventContainerItems.filter(e => e.event_id === event.id && e.container_id === c.id)
                        : containerItems.filter(ci => ci.container_id === c.id);
                      return (
                        <div key={entry.id} style={{ marginBottom: 10 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                            <span>{ctIcon(c.type)}</span>
                            <span style={{ fontWeight: 500, fontSize: 13 }}>{c.name}</span>
                            <span style={{ background: "#f3f4f6", color: "#6b7280", padding: "1px 6px", borderRadius: 99, fontSize: 11 }}>{ctLabel(c.type)}</span>
                          </div>
                          {ciList.map(ci => {
                            const it = items.find(x => x.id === ci.item_id);
                            return it ? <div key={ci.id} style={{ fontSize: 12, color: "#374151", paddingLeft: 22, paddingBottom: 2 }}>• {it.name} ×{ci.qty}</div> : null;
                          })}
                          {ciList.length === 0 && <div style={{ fontSize: 12, color: "#9ca3af", paddingLeft: 22 }}>No items</div>}
                        </div>
                      );
                    })}
                    {tLoose.length > 0 && (
                      <div style={{ marginTop: 4 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Loose Items</div>
                        {tLoose.map(p => {
                          const it = items.find(x => x.id === p.item_id);
                          const name = it?.name || p.ad_hoc_name || "Item";
                          return <div key={p.id} style={{ fontSize: 12, color: "#374151", paddingBottom: 2 }}>• {name} ×{p.qty_needed || 1}</div>;
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              {eventPacking.some(p => !p.trailer_id) && (
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, paddingBottom: 6, borderBottom: "2px solid #9ca3af", color: "#6b7280" }}>Unassigned</div>
                  {eventPacking.filter(p => !p.trailer_id).map(p => {
                    const c = containers.find(x => x.id === p.container_id);
                    const it = items.find(x => x.id === p.item_id);
                    const name = c?.name || it?.name || p.ad_hoc_name || "Item";
                    return <div key={p.id} style={{ fontSize: 12, color: "#374151", paddingBottom: 2 }}>• {c ? ctIcon(c.type) + " " : ""}{name}</div>;
                  })}
                </div>
              )}
            </div>
          )}

          {packingListTab === "container" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {eventPacking.filter(p => p.container_id).length === 0 && <div style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: 20 }}>No containers on this event's packing list</div>}
              {eventPacking.filter(p => p.container_id).map(entry => {
                const c = containers.find(x => x.id === entry.container_id);
                if (!c) return null;
                const isMisc = c.type === "misc";
                const ciList = isMisc
                  ? eventContainerItems.filter(e => e.event_id === event.id && e.container_id === c.id)
                  : containerItems.filter(ci => ci.container_id === c.id);
                const trailer = trailers.find(t => t.id === entry.trailer_id);
                return (
                  <div key={entry.id} style={{ borderBottom: "1px solid #f3f4f6", paddingBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                      <span style={{ fontSize: 18 }}>{ctIcon(c.type)}</span>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</span>
                      <span style={{ background: "#f3f4f6", color: "#6b7280", padding: "1px 6px", borderRadius: 99, fontSize: 11 }}>{ctLabel(c.type)}</span>
                      {c.color && <span style={{ width: 10, height: 10, borderRadius: "50%", background: c.color, display: "inline-block", border: "1px solid rgba(0,0,0,0.1)" }} />}
                      {trailer && <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: "auto" }}>🚛 Trailer {trailer.number}</span>}
                    </div>
                    {ciList.length === 0 && <div style={{ fontSize: 12, color: "#9ca3af", paddingLeft: 4 }}>No items {isMisc ? "added for this event" : "in loadout"}</div>}
                    {ciList.map(ci => {
                      const it = items.find(x => x.id === ci.item_id);
                      return it ? (
                        <div key={ci.id} style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 4, paddingBottom: 4 }}>
                          <div style={{ width: 14, height: 14, border: "1.5px solid #d1d5db", borderRadius: 3, flexShrink: 0 }} />
                          <span style={{ fontSize: 13, color: "#374151", flex: 1 }}>{it.name}</span>
                          <span style={{ fontSize: 12, color: "#9ca3af" }}>×{ci.qty}</span>
                        </div>
                      ) : null;
                    })}
                  </div>
                );
              })}
            </div>
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

  // Total qty_used per item across all submitted reports
  const usedByItem = {};
  reportItems.forEach(ri => {
    if (ri.item_id && ri.qty_used > 0)
      usedByItem[ri.item_id] = (usedByItem[ri.item_id] || 0) + ri.qty_used;
  });

  // Low stock: item.qty is already decremented by report submission, so remaining = item.qty.
  // Reconstruct pre-event qty as item.qty + total_used.
  const lowStockItems = items
    .filter(i => i.is_consumable && i.low_threshold > 0)
    .map(i => ({ ...i, used: usedByItem[i.id] || 0, preEventQty: i.qty + (usedByItem[i.id] || 0), remaining: i.qty }))
    .filter(i => i.qty <= i.low_threshold);

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
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 16px", borderBottom: i < lowStockItems.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{item.name}</div>
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>{item.category}</div>
                  </div>
                  <div style={{ display: "flex", gap: m ? 10 : 20, alignItems: "center", flexShrink: 0 }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>Before Event</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "#374151" }}>{item.preEventQty.toLocaleString()}</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>Used</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "#d97706" }}>{item.used.toLocaleString()}</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>Remaining</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: item.remaining === 0 ? "#dc2626" : "#b45309" }}>{item.remaining.toLocaleString()}</div>
                    </div>
                    <div style={{ textAlign: "center", paddingLeft: m ? 8 : 12, borderLeft: "1px solid #f3f4f6" }}>
                      <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>Alert below</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "#6b7280" }}>{item.low_threshold.toLocaleString()}</div>
                    </div>
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
    const newValue = !areaItem.is_consumable;
    try {
      await api.updateAreaItem(areaItem.id, { is_consumable: newValue });
      setAreaItems(prev => prev.map(ai => ai.id === areaItem.id ? { ...ai, is_consumable: newValue } : ai));
      await api.updateItem(areaItem.item_id, { is_consumable: newValue });
      setItems(prev => prev.map(i => i.id === areaItem.item_id ? { ...i, is_consumable: newValue } : i));
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
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", borderBottom: i < itemsNotInArea.length - 1 ? "1px solid #f3f4f6" : "none", background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
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
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [iconScale, setIconScale] = useState(1);
  const viewportRef = useRef();
  const canvasRef = useRef();
  const fpRef = useRef();
  const didDragRef = useRef(false);
  const panRef = useRef({ active: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0 });
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
    const rect = viewportRef.current.getBoundingClientRect();
    const vx = e.clientX - rect.left;
    const vy = e.clientY - rect.top;
    const x_pct = ((vx - panX) / zoom / rect.width) * 100;
    const y_pct = ((vy - panY) / zoom / rect.height) * 100;
    if (x_pct < 0 || x_pct > 100 || y_pct < 0 || y_pct > 100) return;
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
    const rect = viewportRef.current.getBoundingClientRect();
    setDragging({ id: device.id, startX: e.clientX, startY: e.clientY, origX: device.x_pct, origY: device.y_pct, viewportW: rect.width, viewportH: rect.height });
  };

  const onMouseMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - dragging.startX;
    const dy = e.clientY - dragging.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDragRef.current = true;
    const newX = Math.max(2, Math.min(98, dragging.origX + (dx / zoom / dragging.viewportW) * 100));
    const newY = Math.max(2, Math.min(98, dragging.origY + (dy / zoom / dragging.viewportH) * 100));
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

  const doZoom = (delta) => {
    const newZoom = Math.min(4, Math.max(1, zoom + delta));
    if (newZoom === zoom) return;
    const W = viewportRef.current.offsetWidth;
    const H = viewportRef.current.offsetHeight;
    const newPanX = Math.min(0, Math.max(W * (1 - newZoom), W / 2 - (W / 2 - panX) * (newZoom / zoom)));
    const newPanY = Math.min(0, Math.max(H * (1 - newZoom), H / 2 - (H / 2 - panY) * (newZoom / zoom)));
    setZoom(newZoom);
    setPanX(newPanX);
    setPanY(newPanY);
  };

  const handleViewportMouseDown = (e) => {
    if (e.button !== 0 || placingType || !selectedEventId) return;
    panRef.current = { active: true, startX: e.clientX, startY: e.clientY, startPanX: panX, startPanY: panY };
  };

  const handleViewportMouseMove = (e) => {
    if (dragging) { onMouseMove(e); return; }
    if (!panRef.current.active) return;
    const dx = e.clientX - panRef.current.startX;
    const dy = e.clientY - panRef.current.startY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) didDragRef.current = true;
    const W = viewportRef.current.offsetWidth;
    const H = viewportRef.current.offsetHeight;
    setPanX(Math.min(0, Math.max(W * (1 - zoom), panRef.current.startPanX + dx)));
    setPanY(Math.min(0, Math.max(H * (1 - zoom), panRef.current.startPanY + dy)));
  };

  const handleViewportMouseUp = async () => {
    panRef.current.active = false;
    if (dragging) await onMouseUp();
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
    } catch (err) { showToast(err.message || "Upload failed"); }
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
        <select value={selectedEventId} onChange={e => { setSelectedEventId(e.target.value); setPlacingType(null); setConnectingFrom(null); setZoom(1); setPanX(0); setPanY(0); }} style={iStyle}>
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
              <span style={{ fontSize: 12, color: "#d1d5db", margin: "0 2px" }}>|</span>
              <span style={{ fontSize: 12, color: "#9ca3af" }}>Zoom:</span>
              <button onClick={() => doZoom(-0.5)} style={{ ...ghostBtn, fontSize: 13, padding: "3px 9px" }}>−</button>
              <span style={{ fontSize: 12, fontWeight: 500, minWidth: 38, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
              <button onClick={() => doZoom(0.5)} style={{ ...ghostBtn, fontSize: 13, padding: "3px 9px" }}>+</button>
              {zoom !== 1 && <button onClick={() => { setZoom(1); setPanX(0); setPanY(0); }} style={{ fontSize: 11, color: "#9ca3af", background: "none", border: "none", cursor: "pointer", padding: "2px 4px", fontFamily: "inherit" }}>reset</button>}
              <span style={{ fontSize: 12, color: "#d1d5db", margin: "0 2px" }}>|</span>
              <span style={{ fontSize: 12, color: "#9ca3af" }}>Icons:</span>
              <input type="range" min="0.3" max="2" step="0.05" value={iconScale}
                onChange={e => setIconScale(parseFloat(e.target.value))}
                style={{ width: 80, accentColor: "#1a1a2e", cursor: "pointer" }} />
              <span style={{ fontSize: 11, color: "#6b7280", minWidth: 28 }}>{Math.round(iconScale * 100)}%</span>
            </div>
          </div>

          {/* Canvas */}
          <div
            ref={viewportRef}
            style={{
              position: "relative", width: "100%", aspectRatio: m ? "4/3" : "16/9",
              overflow: "hidden", borderRadius: 12, userSelect: "none",
              border: `2px ${placingType ? "dashed #2563eb" : connectingFrom ? "dashed #d97706" : "solid #e5e7eb"}`,
              cursor: placingType ? "crosshair" : connectingFrom ? "cell" : zoom > 1 ? "grab" : "default",
              background: "#f1f5f9",
            }}
            onMouseDown={handleViewportMouseDown}
            onMouseMove={handleViewportMouseMove}
            onMouseUp={handleViewportMouseUp}
            onMouseLeave={handleViewportMouseUp}
            onClick={handleCanvasClick}>
          <div
            ref={canvasRef}
            style={{
              position: "absolute", inset: 0,
              transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
              transformOrigin: "0 0",
            }}>

            {/* Floor plan image */}
            {floorPlanUrl && (
              <img src={floorPlanUrl} alt="" draggable={false}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} />
            )}

            {/* Grid (no floor plan) */}
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
              const iconPx = Math.round((m ? 40 : 48) * iconScale);
              const iconFontPx = Math.round((m ? 20 : 24) * iconScale);
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
                    width: iconPx, height: iconPx, borderRadius: Math.round(10 * iconScale), background: "#fff",
                    border: `2.5px solid ${isFrom ? "#d97706" : netColor}`,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: iconFontPx,
                    boxShadow: isFrom ? "0 0 0 3px #d97706aa" : "0 2px 8px rgba(0,0,0,0.15)",
                  }}>
                    {cfg.icon}
                  </div>
                  <div style={{
                    background: "rgba(255,255,255,0.93)", borderRadius: 4, padding: "2px 6px",
                    fontSize: Math.round(10 * iconScale), fontWeight: 600, color: "#1a1a2e", maxWidth: Math.round(80 * iconScale), textAlign: "center",
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
              Tip: Click a device to start connecting, then click another to link. Drag a device to move it. Drag empty space to pan when zoomed. Esc to cancel.
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

// ─── User Management ──────────────────────────────────────────────────────────
function UserManagement({ isMobile: m, showToast, currentUserEmail }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ email: "", display_name: "", can_view_dashboard: true, can_view_inventory: true, can_view_events: true, can_view_reports: true, can_view_tech: false });
  const [saving, setSaving] = useState(false);
  const iStyle = m ? inputStyleMobile : inputStyle;

  useEffect(() => {
    api.getAllUserPerms()
      .then(rows => setUsers(rows))
      .finally(() => setLoading(false));
  }, []);

  const openAdd = () => {
    setForm({ email: "", display_name: "", can_view_dashboard: true, can_view_inventory: true, can_view_events: true, can_view_reports: true, can_view_tech: false });
    setEditUser(null);
    setShowModal(true);
  };

  const openEdit = (user) => {
    setForm({ email: user.email, display_name: user.display_name || "", can_view_dashboard: user.can_view_dashboard !== false, can_view_inventory: user.can_view_inventory !== false, can_view_events: user.can_view_events !== false, can_view_reports: user.can_view_reports !== false, can_view_tech: !!user.can_view_tech });
    setEditUser(user);
    setShowModal(true);
  };

  const save = async () => {
    if (!editUser && !form.email.trim()) return;
    setSaving(true);
    try {
      if (editUser) {
        await api.updateUserPerm(editUser.id, { display_name: form.display_name, can_view_dashboard: form.can_view_dashboard, can_view_inventory: form.can_view_inventory, can_view_events: form.can_view_events, can_view_reports: form.can_view_reports, can_view_tech: form.can_view_tech });
        setUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, ...form } : u));
        showToast("User updated");
      } else {
        const [created] = await api.addUserPerm({ email: form.email.trim().toLowerCase(), display_name: form.display_name, can_view_dashboard: form.can_view_dashboard, can_view_inventory: form.can_view_inventory, can_view_events: form.can_view_events, can_view_reports: form.can_view_reports, can_view_tech: form.can_view_tech });
        setUsers(prev => [...prev, created]);
        showToast("User added");
      }
      setShowModal(false);
    } catch (err) {
      showToast(err.message?.includes("unique") ? "That email is already added" : "Error saving — check the email is correct");
    }
    setSaving(false);
  };

  const remove = async (id) => {
    if (!window.confirm("Remove this user's permissions? Their Supabase login account will not be deleted.")) return;
    try {
      await api.deleteUserPerm(id);
      setUsers(prev => prev.filter(u => u.id !== id));
      showToast("User removed");
    } catch { showToast("Error removing user"); }
  };

  const PERM_ROWS = [
    { key: "can_view_dashboard", label: "Dashboard",              sub: "Event overview and stats"         },
    { key: "can_view_inventory", label: "Inventory",              sub: "Master inventory list"            },
    { key: "can_view_events",    label: "Events & Packing Lists", sub: "Event details and packing"        },
    { key: "can_view_reports",   label: "Reports",                sub: "Area reports"                     },
    { key: "can_view_tech",      label: "Tech Setups",            sub: "Network diagrams (admin feature)" },
  ];

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Loading users...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: m ? 14 : 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ fontSize: m ? 20 : 22, fontWeight: 600, marginBottom: 4 }}>Users</h1>
          <p style={{ color: "#6b7280", fontSize: 14 }}>Manage who can access CheerOps and what they can see</p>
        </div>
        <button style={{ ...primaryBtn, padding: m ? "9px 14px" : "8px 16px" }} onClick={openAdd}>+ Add User</button>
      </div>

      {/* How-to notice */}
      <div className="card" style={{ padding: m ? "12px 16px" : "14px 20px", background: "#fffbeb", borderColor: "#fde68a" }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: "#92400e", marginBottom: 4 }}>Creating new login accounts</div>
        <div style={{ fontSize: 13, color: "#b45309", lineHeight: 1.5 }}>
          First create the account in <strong>Supabase Dashboard → Authentication → Users → Add User</strong>, then add their email here to assign permissions.
        </div>
      </div>

      {/* Admin card */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ padding: "8px 16px", fontWeight: 600, fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid #f3f4f6", background: "#fafafa" }}>Admin</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px" }}>
          <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#1a1a2e", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15, flexShrink: 0 }}>
            {currentUserEmail[0].toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>You</div>
            <div style={{ fontSize: 12, color: "#9ca3af", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{currentUserEmail}</div>
          </div>
          <span className="pill" style={{ background: "#1a1a2e", color: "#fff", fontSize: 11, flexShrink: 0 }}>Full Access</span>
        </div>
      </div>

      {/* Other users */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ padding: "8px 16px", fontWeight: 600, fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid #f3f4f6", background: "#fafafa" }}>
          Users {users.length > 0 && `(${users.length})`}
        </div>
        {users.length === 0 ? (
          <div style={{ padding: "32px 16px", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
            No users added yet — click Add User to get started
          </div>
        ) : users.map((user, i) => (
          <div key={user.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderBottom: i < users.length - 1 ? "1px solid #f3f4f6" : "none" }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", color: "#374151", fontWeight: 700, fontSize: 15, flexShrink: 0 }}>
              {(user.display_name || user.email)[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 500, fontSize: 14 }}>{user.display_name || user.email}</div>
              {user.display_name && <div style={{ fontSize: 12, color: "#9ca3af", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</div>}
              <div style={{ display: "flex", gap: 5, marginTop: 5, flexWrap: "wrap" }}>
                {user.can_view_dashboard !== false && <span className="pill" style={{ background: "#f0f9ff", color: "#0369a1", fontSize: 11 }}>Dashboard</span>}
                {user.can_view_inventory !== false && <span className="pill" style={{ background: "#f0f9ff", color: "#0369a1", fontSize: 11 }}>Inventory</span>}
                {user.can_view_events !== false && <span className="pill" style={{ background: "#f0f9ff", color: "#0369a1", fontSize: 11 }}>Events</span>}
                {user.can_view_reports !== false && <span className="pill" style={{ background: "#f0f9ff", color: "#0369a1", fontSize: 11 }}>Reports</span>}
                {user.can_view_tech && <span className="pill" style={{ background: "#fef3c7", color: "#d97706", fontSize: 11 }}>Tech Setups</span>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button style={{ ...ghostBtn, fontSize: 12, padding: "5px 10px" }} onClick={() => openEdit(user)}>Edit</button>
              <button style={{ ...dangerBtn, padding: "5px 10px" }} onClick={() => remove(user.id)}>Remove</button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <Modal
          title={editUser ? "Edit User" : "Add User"}
          onClose={() => setShowModal(false)}
          onSave={save}
          saveLabel={editUser ? "Save Changes" : "Add User"}
          saving={saving}
          isMobile={m}>
          {!editUser && (
            <>
              <label style={labelStyle}>Email address</label>
              <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={iStyle} type="email" placeholder="user@example.com" autoFocus />
            </>
          )}
          <label style={labelStyle}>Display Name (optional)</label>
          <input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} style={iStyle} placeholder="e.g. Sarah" autoFocus={!!editUser} />
          <label style={labelStyle}>Permissions</label>
          <div className="card" style={{ overflow: "hidden" }}>
            {PERM_ROWS.map((perm, i) => (
              <div key={perm.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderBottom: i < PERM_ROWS.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{perm.label}</div>
                  <div style={{ fontSize: 12, color: "#9ca3af" }}>{perm.sub}</div>
                </div>
                <div onClick={() => setForm(f => ({ ...f, [perm.key]: !f[perm.key] }))}
                  style={{ width: 42, height: 24, borderRadius: 99, cursor: "pointer", flexShrink: 0, background: form[perm.key] ? "#1a1a2e" : "#e5e7eb", position: "relative", transition: "background 0.2s" }}>
                  <div style={{ position: "absolute", top: 3, left: form[perm.key] ? 21 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
