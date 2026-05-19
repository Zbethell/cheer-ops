export default async function handler(req, res) {
  const { AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET } = process.env;

  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: AZURE_CLIENT_ID,
        client_secret: AZURE_CLIENT_SECRET,
        scope: "https://graph.microsoft.com/.default",
      }),
    }
  );

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    return res.status(500).json({ error: "Failed to get Microsoft token", detail: err });
  }

  const { access_token } = await tokenRes.json();

  const { siteId, listId } = req.query;

  if (!siteId || !listId) {
    return res.status(400).json({ error: "siteId and listId query params are required" });
  }

  // Fetch all pages following @odata.nextLink
  let allItems = [];
  let url = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items?expand=fields&$top=999`;

  while (url) {
    const graphRes = await fetch(url, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!graphRes.ok) {
      const err = await graphRes.text();
      return res.status(500).json({ error: "Failed to fetch SharePoint data", detail: err });
    }

    const data = await graphRes.json();
    allItems = allItems.concat(data.value || []);
    url = data["@odata.nextLink"] || null;
  }

  res.status(200).json(allItems);
}
