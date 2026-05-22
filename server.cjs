require("dotenv").config();
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json({ limit: "20mb" }));

const { AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, DOC_INTEL_KEY, DOC_INTEL_ENDPOINT, AZURE_MAPS_KEY } = process.env;

const SITE_ID = "canadiancheer.sharepoint.com,3de101e2-cad1-4d01-b8f2-581326ad7ef2,b28c2a3b-2636-4279-9c6a-ba34c5edfcb9";
const EXPENSES_LIST_ID = "33fd6b8c-b4df-47bd-af5b-b17ee2bfcf51";
const SHAREPOINT_DRIVE_ID = "b!4gHhPdHKAU248lgTJq1-8jsqjLI2JnlCnGq6NMXt_LkVJJY25OMISagOm60QPCvf"; // Accounting library

async function getMicrosoftToken() {
  const res = await fetch(
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
  const data = await res.json();
  if (!data.access_token) throw new Error(`Token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function analyzeReceipt(fileBuffer, mimeType) {
  const analyzeRes = await fetch(
    `${DOC_INTEL_ENDPOINT}/documentintelligence/documentModels/prebuilt-receipt:analyze?api-version=2024-11-30`,
    {
      method: "POST",
      headers: { "Ocp-Apim-Subscription-Key": DOC_INTEL_KEY, "Content-Type": mimeType || "image/jpeg" },
      body: fileBuffer,
    }
  );
  if (!analyzeRes.ok) throw new Error(`Doc Intel submit failed: ${await analyzeRes.text()}`);
  const pollUrl = analyzeRes.headers.get("Operation-Location");
  if (!pollUrl) throw new Error("No Operation-Location header returned");

  // Poll until complete (max 30s)
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const pollRes = await fetch(pollUrl, { headers: { "Ocp-Apim-Subscription-Key": DOC_INTEL_KEY } });
    if (!pollRes.ok) throw new Error(`Polling failed: ${await pollRes.text()}`);
    const result = await pollRes.json();
    if (result.status === "failed") throw new Error("Document analysis failed");
    if (result.status !== "succeeded") continue;

    const doc = result.analyzeResult?.documents?.[0];
    if (!doc) return {};
    const f = doc.fields || {};

    const currency = (field) => field?.valueCurrency?.amount ?? field?.valueNumber ?? null;
    const items = (f.Items?.valueArray || []).map((item) => {
      const o = item.valueObject || {};
      return [o.Description?.valueString, o.TotalPrice ? `$${currency(o.TotalPrice)?.toFixed(2)}` : null]
        .filter(Boolean).join(" – ");
    }).filter(Boolean);

    return {
      merchantName:      f.MerchantName?.valueString || null,
      extractedTotal:    currency(f.Total),
      extractedSubtotal: currency(f.Subtotal),
      extractedTax:      currency(f.TotalTax),
      extractedItems:    items.join("\n") || null,
      extractedDate:     f.TransactionDate?.valueDate || null,
    };
  }
  throw new Error("Document analysis timed out");
}

// POST /api/submit-expense
app.post("/api/submit-expense", async (req, res) => {
  const { submitterName, submitterEmail, company, lineItems } = req.body;

  if (!submitterName || !submitterEmail || !company || !Array.isArray(lineItems) || lineItems.length === 0) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  for (const item of lineItems) {
    if (!item.category || !item.expenseDate || item.amount == null) {
      return res.status(400).json({ error: "Each line item requires category, expenseDate, and amount" });
    }
  }

  try {
    const msToken = await getMicrosoftToken();
    const expenseToken = crypto.randomUUID();
    const submittedDate = new Date().toLocaleDateString("en-CA");

    await Promise.all(lineItems.map(async (item, i) => {
      let receiptURL = "";
      let extracted = {};

      if (item.receiptBase64 && item.receiptFileName) {
        const fileBuffer = Buffer.from(item.receiptBase64, "base64");
        const ext = item.receiptFileName.split(".").pop().replace(/[^a-zA-Z0-9]/g, "") || "jpg";
        const namePart = submitterName.trim().replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");
        const categoryPart = item.category.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");
        const amountPart = parseFloat(item.amount).toFixed(2);
        const dateStr = item.expenseDate || new Date().toISOString().split("T")[0];
        const suffix = lineItems.length > 1 ? `_${i + 1}of${lineItems.length}` : "";
        const safeName = `${dateStr}_${namePart}_${categoryPart}_$${amountPart}${suffix}.${ext}`;

        const [uploadRes] = await Promise.all([
          fetch(
            `https://graph.microsoft.com/v1.0/drives/${SHAREPOINT_DRIVE_ID}/root:/Expense%20Receipts/${encodeURIComponent(safeName)}:/content`,
            {
              method: "PUT",
              headers: { Authorization: `Bearer ${msToken}`, "Content-Type": item.receiptMimeType || "application/octet-stream" },
              body: fileBuffer,
            }
          ),
          analyzeReceipt(fileBuffer, item.receiptMimeType).then((r) => { extracted = r; }).catch((e) => console.error("Receipt analysis failed:", e.message)),
        ]);

        if (uploadRes.ok) {
          receiptURL = (await uploadRes.json()).webUrl || "";
        } else {
          console.error("Receipt upload failed:", await uploadRes.text());
        }
      }

      const titleSuffix = lineItems.length > 1 ? ` (${i + 1}/${lineItems.length})` : "";
      const createRes = await fetch(
        `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${EXPENSES_LIST_ID}/items`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${msToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            fields: {
              Title: `${submitterName} – ${submittedDate}${titleSuffix}`,
              SubmitterName: submitterName,
              SubmitterEmail: submitterEmail,
              Amount: parseFloat(item.amount),
              Category: item.category,
              Company: company,
              ExpenseDate: item.expenseDate,
              Description: item.description || "",
              ReceiptURL: receiptURL,
              Status: "Pending",
              Token: expenseToken,
              ...(extracted.merchantName      != null && { MerchantName:      extracted.merchantName }),
              ...(extracted.extractedTotal    != null && { ExtractedTotal:    extracted.extractedTotal }),
              ...(extracted.extractedSubtotal != null && { ExtractedSubtotal: extracted.extractedSubtotal }),
              ...(extracted.extractedTax      != null && { ExtractedTax:      extracted.extractedTax }),
              ...(extracted.extractedItems    != null && { ExtractedItems:    extracted.extractedItems }),
              ...(extracted.extractedDate     != null && { ExtractedDate:     extracted.extractedDate }),
              ...(item.startLocation && { StartLocation: item.startLocation }),
              ...(item.endLocation   && { EndLocation:   item.endLocation }),
              ...(item.totalKMs      != null && { TotalKMs:    parseFloat(item.totalKMs) }),
              ...(item.mileageRate   != null && { MileageRate: parseFloat(item.mileageRate) }),
            },
          }),
        }
      );
      if (!createRes.ok) throw new Error(await createRes.text());
    }));

    res.json({ success: true, token: expenseToken });
  } catch (e) {
    console.error("Submit expense error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/expense-status?token=xxx
app.get("/api/expense-status", async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: "token required" });

  try {
    const msToken = await getMicrosoftToken();
    const filter = `fields/Token eq '${token.replace(/'/g, "''")}'`;
    const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${EXPENSES_LIST_ID}/items?$expand=fields&$filter=${encodeURIComponent(filter)}&$top=100`;
    const r = await fetch(url, {
      headers: {
        Authorization: `Bearer ${msToken}`,
        Prefer: "HonorNonIndexedQueriesWarningMayFailRandomly",
      },
    });
    if (!r.ok) throw new Error(await r.text());
    const { value } = await r.json();
    if (!value || value.length === 0) return res.status(404).json({ error: "Expense not found" });

    const lineItems = value.map((item) => {
      const f = item.fields;
      return {
        id: item.id,
        category: f.Category || "", expenseDate: f.ExpenseDate || "",
        amount: f.Amount || 0, description: f.Description || "",
        receiptURL: f.ReceiptURL || "", merchantName: f.MerchantName || null,
        startLocation: f.StartLocation || null, endLocation: f.EndLocation || null,
        totalKMs: f.TotalKMs ?? null, mileageRate: f.MileageRate ?? null,
      };
    });
    const first = value[0].fields;
    const overallStatus = value.every((i) => i.fields.Status === "Paid") ? "Paid" : "Pending";
    res.json({
      submitterName: first.SubmitterName || "",
      company:       first.Company       || "",
      status:        overallStatus,
      submittedAt:   first.Created || value[0].createdDateTime || null,
      totalAmount:   lineItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0),
      lineItems,
    });
  } catch (e) {
    console.error("Expense status error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/expenses-list
app.get("/api/expenses-list", async (req, res) => {
  try {
    const token = await getMicrosoftToken();
    const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${EXPENSES_LIST_ID}/items?$expand=fields&$top=999`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(await r.text());
    const { value } = await r.json();
    const items = value
      .map((i) => ({
        id: i.id,
        submitterName: i.fields.SubmitterName || "",
        submitterEmail: i.fields.SubmitterEmail || "",
        amount: i.fields.Amount || 0,
        category: i.fields.Category || "",
        expenseDate: i.fields.ExpenseDate || "",
        description: i.fields.Description || "",
        status: i.fields.Status || "Pending",
        receiptURL: i.fields.ReceiptURL || "",
        token: i.fields.Token || "",
        submittedAt: i.fields.Created || i.createdDateTime || null,
        merchantName:      i.fields.MerchantName      || null,
        extractedTotal:    i.fields.ExtractedTotal     ?? null,
        extractedSubtotal: i.fields.ExtractedSubtotal  ?? null,
        extractedTax:      i.fields.ExtractedTax       ?? null,
        extractedItems:    i.fields.ExtractedItems      || null,
        company:           i.fields.Company             || "",
        startLocation:     i.fields.StartLocation      || null,
        endLocation:       i.fields.EndLocation        || null,
        totalKMs:          i.fields.TotalKMs           ?? null,
        mileageRate:       i.fields.MileageRate        ?? null,
        extractedDate:     i.fields.ExtractedDate       || null,
      }))
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    res.json(items);
  } catch (e) {
    console.error("Expenses list error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/receipt-proxy?url=<encoded>&key=<anon-key>
const RECEIPT_PROXY_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBleWxvbnVrY3dzcWRrbmNoeGRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MDQxOTYsImV4cCI6MjA5MzQ4MDE5Nn0.fTgnQxWxBDcHk0Xq-4KQJZH9xi4bYwle27tdrjseQ3k";
const SHAREPOINT_HOST = "https://canadiancheer.sharepoint.com";
app.get("/api/receipt-proxy", async (req, res) => {
  const { url, key } = req.query;
  if (!url || key !== RECEIPT_PROXY_TOKEN) return res.status(401).json({ error: "Unauthorized" });
  const decoded = decodeURIComponent(url);
  if (!decoded.startsWith(SHAREPOINT_HOST)) return res.status(400).json({ error: "Invalid URL" });
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
});

// PATCH /api/expense-report-update?token=xxx
app.patch("/api/expense-report-update", async (req, res) => {
  const { token } = req.query;
  const { status } = req.body;
  if (!token || !status) return res.status(400).json({ error: "token and status required" });
  try {
    const msToken = await getMicrosoftToken();
    const filter = `fields/Token eq '${token.replace(/'/g, "''")}'`;
    const listUrl = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${EXPENSES_LIST_ID}/items?$expand=fields&$filter=${encodeURIComponent(filter)}&$top=100`;
    const listRes = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${msToken}`, Prefer: "HonorNonIndexedQueriesWarningMayFailRandomly" },
    });
    if (!listRes.ok) throw new Error(await listRes.text());
    const { value } = await listRes.json();
    if (!value || value.length === 0) return res.status(404).json({ error: "Report not found" });
    await Promise.all(value.map((item) =>
      fetch(`https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${EXPENSES_LIST_ID}/items/${item.id}/fields`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${msToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ Status: status }),
      })
    ));
    res.json({ success: true, updated: value.length });
  } catch (e) {
    console.error("Report update error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/expense-update/:id
app.patch("/api/expense-update/:id", async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: "status required" });
  try {
    const token = await getMicrosoftToken();
    const r = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${EXPENSES_LIST_ID}/items/${req.params.id}/fields`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ Status: status }),
      }
    );
    if (!r.ok) throw new Error(await r.text());
    res.json({ success: true });
  } catch (e) {
    console.error("Expense update error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

const DEFAULT_CONFIG = {
  formTitle: "Expense Report",
  formSubtitle: "Submit your expense for reimbursement. You'll receive a link to track its status.",
  categories: ["Meal", "Gas", "Office Supplies", "Mileage"],
  mileageRate: 0.70,
  expenseCompanies: ["Pro", "Pro Gym Services", "EVO"],
  labels: {
    name: "Your Name",
    email: "Email Address",
    amount: "Amount ($)",
    date: "Date of Expense",
    category: "Category",
    company: "Company",
    description: "Description",
    receipt: "Receipt Photo",
    startLocation: "Start Location",
    endLocation: "End Location",
    totalKMs: "Total KMs",
  },
};

// GET /api/maps/search?q=...
app.get("/api/maps/search", async (req, res) => {
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
});

// GET /api/maps/distance?fromLat=&fromLon=&toLat=&toLon=
app.get("/api/maps/distance", async (req, res) => {
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
});

// GET /api/expense-config
app.get("/api/expense-config", async (req, res) => {
  try {
    const token = await getMicrosoftToken();
    const r = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${SHAREPOINT_DRIVE_ID}/root:/expense-config.json:/content`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (r.status === 404) return res.json(DEFAULT_CONFIG);
    if (!r.ok) throw new Error(await r.text());
    const config = await r.json();
    res.json({ ...DEFAULT_CONFIG, ...config, labels: { ...DEFAULT_CONFIG.labels, ...(config.labels || {}) } });
  } catch (e) {
    console.error("Get config error:", e.message);
    res.json(DEFAULT_CONFIG);
  }
});

// POST /api/expense-config
app.post("/api/expense-config", async (req, res) => {
  try {
    const token = await getMicrosoftToken();
    const r = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${SHAREPOINT_DRIVE_ID}/root:/expense-config.json:/content`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      }
    );
    if (!r.ok) throw new Error(await r.text());
    res.json({ success: true });
  } catch (e) {
    console.error("Save config error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.listen(3001, () => console.log("API server running at http://localhost:3001"));
