const { getStore } = require("@netlify/blobs");

const CORS_HEADERS = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, x-sync-secret"
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  var headers = event.headers || {};
  var providedSecret = headers["x-sync-secret"] || headers["X-Sync-Secret"];
  if (providedSecret !== process.env.SYNC_SECRET) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: "unauthorized" }) };
  }

  // Git-connected deploys get Blobs context injected automatically; explicit
  // siteID/token are only used as a fallback if those env vars happen to be set.
  var storeConfig = { name: "hotpigs-state", consistency: "strong" };
  if (process.env.BLOBS_SITE_ID && process.env.BLOBS_TOKEN) {
    storeConfig.siteID = process.env.BLOBS_SITE_ID;
    storeConfig.token = process.env.BLOBS_TOKEN;
  }
  const store = getStore(storeConfig);

  if (event.httpMethod === "GET") {
    const data = await store.get("current", { type: "json" });
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(data || null) };
  }

  if (event.httpMethod === "POST") {
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch (e) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "invalid json" }) };
    }
    if (!body || typeof body !== "object" || !Array.isArray(body.people)) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "invalid state shape" }) };
    }
    body.updatedAt = new Date().toISOString();
    await store.setJSON("current", body);
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: true, updatedAt: body.updatedAt }) };
  }

  return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "method not allowed" }) };
};
