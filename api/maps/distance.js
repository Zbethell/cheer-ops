const { AZURE_MAPS_KEY } = process.env;

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const { fromLat, fromLon, toLat, toLon } = req.query;
  if (!fromLat || !fromLon || !toLat || !toLon) return res.status(400).json({ error: "Coordinates required" });
  try {
    const url = `https://atlas.microsoft.com/route/directions/json?api-version=1.0&subscription-key=${AZURE_MAPS_KEY}&query=${fromLat},${fromLon}:${toLat},${toLon}&travelMode=car`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(await r.text());
    const data = await r.json();
    const meters = data.routes?.[0]?.summary?.lengthInMeters;
    if (!meters) throw new Error("No route found");
    res.json({ km: Math.round((meters / 1000) * 10) / 10 });
  } catch (e) {
    console.error("Maps distance error:", e.message);
    res.status(500).json({ error: e.message });
  }
}
