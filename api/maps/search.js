const { AZURE_MAPS_KEY } = process.env;

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);
  try {
    const url = `https://atlas.microsoft.com/search/fuzzy/json?api-version=1.0&subscription-key=${AZURE_MAPS_KEY}&query=${encodeURIComponent(q)}&countrySet=CA&language=en-US&typeahead=true&limit=6`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(await r.text());
    const data = await r.json();
    const results = (data.results || [])
      .filter((item) => item.address?.freeformAddress && item.position)
      .map((item) => ({
        address: item.address.freeformAddress,
        lat: item.position.lat,
        lon: item.position.lon,
      }));
    res.json(results);
  } catch (e) {
    console.error("Maps search error:", e.message);
    res.json([]);
  }
}
