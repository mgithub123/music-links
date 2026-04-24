// netlify/functions/links.js
// GET  /links          → list all links
// POST /links          → create a new link

exports.handler = async function (event) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "Supabase not configured" }) };
  }

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // ── GET — list links ───────────────────────────────────────────────────────
  if (event.httpMethod === "GET") {
    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/links?select=*&order=created_at.desc`,
        {
          headers: {
            apikey:        supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
        }
      );
      const rows = await res.json();
      return { statusCode: 200, headers, body: JSON.stringify(rows) };
    } catch (e) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
    }
  }

  // ── POST — create link ─────────────────────────────────────────────────────
  if (event.httpMethod === "POST") {
    let body;
    try { body = JSON.parse(event.body); }
    catch (e) { return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) }; }

    const { slug, platform, app_uri, web_url, web_only, original_url } = body;

    if (!slug || !platform || !web_url) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing required fields" }) };
    }

    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/links`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey:         supabaseKey,
          Authorization:  `Bearer ${supabaseKey}`,
          Prefer:         "return=representation",
        },
        body: JSON.stringify({
          slug,
          platform,
          app_uri:      app_uri || null,
          web_url,
          web_only:     web_only || false,
          original_url: original_url || web_url,
          created_at:   new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        // Slug already exists
        if (err.code === "23505") {
          return { statusCode: 409, headers, body: JSON.stringify({ error: "slug_taken" }) };
        }
        throw new Error(err.message || res.status);
      }

      const rows = await res.json();
      return { statusCode: 201, headers, body: JSON.stringify(rows[0]) };
    } catch (e) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
    }
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
};
