import { useState, useEffect } from "react";

const SUPABASE_URL = "https://peylonukcwsqdknchxda.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBleWxvbnVrY3dzcWRrbmNoeGRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MDQxOTYsImV4cCI6MjA5MzQ4MDE5Nn0.fTgnQxWxBDcHk0Xq-4KQJZH9xi4bYwle27tdrjseQ3k";
const ORG_LOGO_PUBLIC_URL = `${SUPABASE_URL}/storage/v1/object/public/logos/org-logo.png`;

const CONTAINER_TYPES = [
  { value: "tote",         label: "Tote",                 icon: "📦" },
  { value: "travel_case",  label: "Travel Case",           icon: "🧳" },
  { value: "rolling_bin",  label: "Rolling Bin",           icon: "🗂️" },
  { value: "misc",         label: "Misc / Event-Specific", icon: "📫" },
  { value: "other",        label: "Other",                 icon: "📋" },
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
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [container, setContainer]     = useState(null);
  const [items, setItems]             = useState([]);
  const [subContainers, setSubContainers] = useState([]); // [{ ...container, items: [...] }]
  const [diagZoom, setDiagZoom]       = useState(false);

  useEffect(() => {
    if (!containerId) { setError("No container ID in URL"); setLoading(false); return; }
    (async () => {
      try {
        // Fetch container, its direct items, and its children all in parallel
        const [containers, ciList, children] = await Promise.all([
          sbPublic(`containers?id=eq.${containerId}&limit=1`),
          sbPublic(`container_items?container_id=eq.${containerId}`),
          sbPublic(`containers?parent_container_id=eq.${containerId}&order=name`),
        ]);

        if (!containers.length) { setError("Container not found"); setLoading(false); return; }
        setContainer(containers[0]);

        // Resolve direct items
        if (ciList.length) {
          const ids = ciList.map(ci => ci.item_id).join(",");
          const itemList = await sbPublic(`items?id=in.(${ids})`);
          setItems(ciList.map(ci => ({ ...ci, item: itemList.find(i => i.id === ci.item_id) })));
        }

        // Resolve each child container's items
        if (children.length) {
          const childCiLists = await Promise.all(
            children.map(child => sbPublic(`container_items?container_id=eq.${child.id}`))
          );
          // Batch-fetch all unique item IDs needed across all children
          const allChildItemIds = [...new Set(childCiLists.flat().map(ci => ci.item_id))];
          const allChildItems = allChildItemIds.length
            ? await sbPublic(`items?id=in.(${allChildItemIds.join(",")})`)
            : [];
          setSubContainers(children.map((child, idx) => ({
            ...child,
            items: childCiLists[idx].map(ci => ({ ...ci, item: allChildItems.find(i => i.id === ci.item_id) })),
          })));
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

  const totalItems = items.length + subContainers.reduce((sum, sc) => sum + sc.items.length, 0);

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

      {/* Direct items */}
      {items.length > 0 && (
        <div style={{ margin: "20px 20px 0" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 10 }}>
            📦 Items in this container · {items.length} type{items.length !== 1 ? "s" : ""}
          </div>
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
            {items.map((ci, i) => (
              <div key={ci.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderBottom: i < items.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                <div style={{ flex: 1, fontSize: 15, fontWeight: 500, color: "#1a1a2e" }}>{ci.item?.name || "Unknown item"}</div>
                <div style={{ background: "#f3f4f6", color: "#6b7280", padding: "4px 12px", borderRadius: 99, fontSize: 13, fontWeight: 600, flexShrink: 0 }}>×{ci.qty}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sub-containers */}
      {subContainers.length > 0 && (
        <div style={{ margin: "20px 20px 0" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 10 }}>
            🗃️ Sub-containers · {subContainers.length}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {subContainers.map(sc => (
              <div key={sc.id} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
                {/* Sub-container header */}
                <div style={{ padding: "12px 16px", background: "#f9fafb", borderBottom: sc.items.length > 0 ? "1px solid #e5e7eb" : "none", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>{ctIcon(sc.type)}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15, color: "#1a1a2e" }}>{sc.name}</div>
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>
                      {ctLabel(sc.type)}
                      {sc.items.length > 0 ? ` · ${sc.items.length} item type${sc.items.length !== 1 ? "s" : ""}` : " · empty"}
                    </div>
                  </div>
                </div>
                {/* Sub-container items */}
                {sc.items.length > 0 && sc.items.map((ci, i) => (
                  <div key={ci.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px 11px 28px", borderBottom: i < sc.items.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                    <div style={{ flex: 1, fontSize: 14, color: "#374151" }}>{ci.item?.name || "Unknown item"}</div>
                    <div style={{ background: "#f3f4f6", color: "#6b7280", padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600, flexShrink: 0 }}>×{ci.qty}</div>
                  </div>
                ))}
                {sc.items.length === 0 && (
                  <div style={{ padding: "10px 16px 10px 28px", fontSize: 13, color: "#9ca3af" }}>No items assigned</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {totalItems === 0 && subContainers.length === 0 && (
        <div style={{ margin: "20px 20px 0", background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "24px 16px", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
          No items or sub-containers assigned to this container
        </div>
      )}

      {/* Diagram zoom lightbox */}
      {diagZoom && (
        <div onClick={() => setDiagZoom(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <img src={container.diagram_url} alt="Packing diagram" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 8 }} />
          <div style={{ position: "absolute", top: 16, right: 16, color: "#fff", fontSize: 24, cursor: "pointer", background: "rgba(255,255,255,0.1)", width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</div>
        </div>
      )}
    </div>
  );
}
