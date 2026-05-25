import { useState, useEffect } from "react";

const SUPABASE_URL = "https://peylonukcwsqdknchxda.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBleWxvbnVrY3dzcWRrbmNoeGRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MDQxOTYsImV4cCI6MjA5MzQ4MDE5Nn0.fTgnQxWxBDcHk0Xq-4KQJZH9xi4bYwle27tdrjseQ3k";
const ORG_LOGO_PUBLIC_URL = `${SUPABASE_URL}/storage/v1/object/public/logos/org-logo.png`;

const CONTAINER_TYPES = [
  { value: "tote",         label: "Tote",                icon: "📦" },
  { value: "travel_case",  label: "Travel Case",          icon: "🧳" },
  { value: "rolling_bin",  label: "Rolling Bin",          icon: "🗂️" },
  { value: "misc",         label: "Misc / Event-Specific", icon: "📫" },
  { value: "other",        label: "Other",                icon: "📋" },
];
const ctIcon  = (t) => CONTAINER_TYPES.find(x => x.value === t)?.icon  || "📦";
const ctLabel = (t) => CONTAINER_TYPES.find(x => x.value === t)?.label || "Container";

const sbPublic = async (path) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  return text ? JSON.parse(text) : [];
};

export default function ContainerView() {
  const containerId = window.location.pathname.split("/container/")[1]?.split("?")[0];
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [container, setContainer] = useState(null);
  const [items, setItems]         = useState([]);
  const [diagZoom, setDiagZoom]   = useState(false);

  useEffect(() => {
    if (!containerId) { setError("No container ID in URL"); setLoading(false); return; }
    (async () => {
      try {
        const [containers, ciList] = await Promise.all([
          sbPublic(`containers?id=eq.${containerId}&limit=1`),
          sbPublic(`container_items?container_id=eq.${containerId}`),
        ]);
        if (!containers.length) { setError("Container not found"); setLoading(false); return; }
        setContainer(containers[0]);
        if (ciList.length) {
          const ids = ciList.map(ci => ci.item_id).join(",");
          const itemList = await sbPublic(`items?id=in.(${ids})`);
          setItems(ciList.map(ci => ({ ...ci, item: itemList.find(i => i.id === ci.item_id) })));
        }
      } catch { setError("Failed to load container — check your connection"); }
      setLoading(false);
    })();
  }, [containerId]);

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans','Segoe UI',sans-serif", background: "#f8f9fb" }}>
      <div style={{ color: "#9ca3af", fontSize: 16 }}>Loading…</div>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans','Segoe UI',sans-serif", background: "#f8f9fb", padding: 24 }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
      <div style={{ color: "#374151", fontWeight: 600, marginBottom: 4 }}>Oops</div>
      <div style={{ color: "#6b7280", fontSize: 14, textAlign: "center" }}>{error}</div>
    </div>
  );

  return (
    <div style={{ fontFamily: "'DM Sans','Segoe UI',sans-serif", minHeight: "100vh", background: "#f8f9fb", paddingBottom: 48 }}>
      <style>{`* { box-sizing: border-box; margin: 0; padding: 0; } @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>

      {/* Header bar */}
      <div style={{ background: "#1a1a2e", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <img src={ORG_LOGO_PUBLIC_URL} alt="logo" style={{ height: 28, width: "auto", objectFit: "contain" }} onError={e => { e.target.style.display = "none"; }} />
        <div style={{ color: "#64748b", fontSize: 13, fontWeight: 500 }}>Cheer Ops · Container</div>
      </div>

      {/* Container identity */}
      <div style={{ padding: "20px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <span style={{ fontSize: 36 }}>{ctIcon(container.type)}</span>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1a1a2e", lineHeight: 1.2 }}>{container.name}</h1>
            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
              {ctLabel(container.type)}
              {container.color ? ` · ${container.color}` : ""}
              {container.dim_w_ft && container.dim_d_ft ? ` · ${container.dim_w_ft}×${container.dim_d_ft} ft` : ""}
            </div>
          </div>
        </div>
        {container.notes && (
          <p style={{ fontSize: 14, color: "#6b7280", marginTop: 8, lineHeight: 1.5 }}>{container.notes}</p>
        )}
      </div>

      {/* Packing diagram */}
      {container.diagram_url && (
        <div style={{ margin: "20px 20px 0" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 10 }}>📐 Packing Diagram</div>
          <img
            src={container.diagram_url}
            alt="Packing diagram"
            onClick={() => setDiagZoom(true)}
            style={{ width: "100%", borderRadius: 12, border: "1px solid #e5e7eb", display: "block", cursor: "zoom-in" }}
          />
          <div style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", marginTop: 6 }}>Tap to enlarge</div>
        </div>
      )}

      {/* Items list */}
      <div style={{ margin: "20px 20px 0" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 10 }}>
          📦 Contents{items.length > 0 ? ` · ${items.length} item type${items.length !== 1 ? "s" : ""}` : ""}
        </div>
        {items.length > 0 ? (
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
            {items.map((ci, i) => (
              <div key={ci.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderBottom: i < items.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                <div style={{ flex: 1, fontSize: 15, fontWeight: 500, color: "#1a1a2e" }}>{ci.item?.name || "Unknown item"}</div>
                <div style={{ background: "#f3f4f6", color: "#6b7280", padding: "4px 12px", borderRadius: 99, fontSize: 13, fontWeight: 600, flexShrink: 0 }}>×{ci.qty}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "24px 16px", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
            No items assigned to this container
          </div>
        )}
      </div>

      {/* Diagram zoom lightbox */}
      {diagZoom && (
        <div
          onClick={() => setDiagZoom(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <img src={container.diagram_url} alt="Packing diagram" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 8 }} />
          <div style={{ position: "absolute", top: 16, right: 16, color: "#fff", fontSize: 24, cursor: "pointer", background: "rgba(255,255,255,0.1)", width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</div>
        </div>
      )}
    </div>
  );
}
