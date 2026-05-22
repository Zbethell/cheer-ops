import { getMicrosoftToken, ADMIN_TOKEN } from "./_lib.js";

const SHAREPOINT_HOST = "https://canadiancheer.sharepoint.com";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const { url, key } = req.query;
  if (!url || key !== ADMIN_TOKEN) return res.status(401).json({ error: "Unauthorized" });

  const decoded = decodeURIComponent(url);
  if (!decoded.startsWith(SHAREPOINT_HOST)) {
    return res.status(400).json({ error: "Invalid receipt URL" });
  }

  try {
    const msToken = await getMicrosoftToken();
    const encoded = "u!" + Buffer.from(decoded).toString("base64")
      .replace(/=+$/, "").replace(/\//g, "_").replace(/\+/g, "-");

    const fileRes = await fetch(
      `https://graph.microsoft.com/v1.0/shares/${encoded}/driveItem/content`,
      { headers: { Authorization: `Bearer ${msToken}` } }
    );

    if (!fileRes.ok) return res.status(fileRes.status).end();

    const contentType = fileRes.headers.get("content-type") || "application/octet-stream";
    const buffer = await fileRes.arrayBuffer();

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(Buffer.from(buffer));
  } catch (e) {
    console.error("Receipt proxy error:", e.message);
    res.status(500).json({ error: e.message });
  }
}
