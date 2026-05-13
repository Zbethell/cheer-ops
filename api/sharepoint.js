export default async function handler(req, res) {
  const { AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET } = process.env;

  // Get a token from Microsoft
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

  // Call Graph API to get items from a SharePoint list
  const { siteId, listId } = req.query;

  if (!siteId || !listId) {
    return res.status(400).json({ error: "siteId and listId query params are required" });
  }

  const graphRes = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items?expand=fields&$top=999`,
    { headers: { Authorization: `Bearer ${access_token}` } }
  );

  if (!graphRes.ok) {
    const err = await graphRes.text();
    return res.status(500).json({ error: "Failed to fetch SharePoint data", detail: err });
  }

  const data = await graphRes.json();
  res.status(200).json(data.value);
}
