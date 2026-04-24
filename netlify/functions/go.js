// netlify/functions/go.js
// Handles all redirects. URL: /go?slug=work-work-work
// Logs click to Supabase, then redirects fan to the right destination.

exports.handler = async function (event) {
  const params   = event.queryStringParameters || {};
  const slug     = params.slug;

  if (!slug) {
    return { statusCode: 400, body: "Missing slug" };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return { statusCode: 500, body: "Supabase not configured" };
  }

  // ── Look up the link ───────────────────────────────────────────────────────
  let link;
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/links?slug=eq.${encodeURIComponent(slug)}&select=*&limit=1`,
      {
        headers: {
          apikey:        supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    );
    const rows = await res.json();
    link = rows[0];
  } catch (e) {
    return { statusCode: 500, body: "Database error: " + e.message };
  }

  if (!link) {
    return {
      statusCode: 404,
      headers: { "Content-Type": "text/html" },
      body: `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Link not found</title></head><body style="background:#000;color:#444;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><p>Link not found.</p></body></html>`,
    };
  }

  // ── Gather request metadata ────────────────────────────────────────────────
  const headers  = event.headers || {};
  const ua       = headers["user-agent"] || "";
  const referrer = headers["referer"] || headers["referrer"] || null;
  const country  = headers["x-country"] || headers["x-nf-country"] || null;
  const isMobile = /iphone|ipad|ipod|android/i.test(ua);
  const isTablet = /ipad|tablet|playbook|silk/i.test(ua);
  const device   = isTablet ? "tablet" : isMobile ? "mobile" : "desktop";

  // ── Build the redirect page HTML ───────────────────────────────────────────
  const platform = link.platform;
  const appUri   = link.app_uri;
  const webUrl   = link.web_url;
  const webOnly  = link.web_only;

  const COLORS = { spotify:"#1ed760", apple:"#fc3c44", amazon:"#00a8e1", youtube:"#ff0000" };
  const LABELS = { spotify:"Spotify", apple:"Apple Music", amazon:"Amazon Music", youtube:"YouTube" };
  const color  = COLORS[platform] || "#fff";
  const label  = LABELS[platform] || "Music";

  const css  = `html,body{margin:0;padding:0;background:#000;width:100%;height:100%;display:flex;align-items:center;justify-content:center;}.dots{display:flex;gap:6px;}.dot{width:6px;height:6px;background:${color};border-radius:50%;animation:p 1.2s ease-in-out infinite;}.dot:nth-child(2){animation-delay:.2s}.dot:nth-child(3){animation-delay:.4s}@keyframes p{0%,100%{opacity:.2;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}`;
  const dots = `<div class="dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>`;

  let script;
  if (webOnly || !appUri) {
    script = `window.location.href="${webUrl}";`;
  } else {
    script = `var app="${appUri}",web="${webUrl}",mob=/iphone|ipad|ipod|android/i.test(navigator.userAgent);function go(){if(!mob){window.location.href=web;return;}var t=setTimeout(function(){window.location.href=web;},1800);document.addEventListener("visibilitychange",function(){if(document.hidden)clearTimeout(t);});window.addEventListener("pagehide",function(){clearTimeout(t);});window.location.href=app;}setTimeout(go,100);`;
  }

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Opening ${label}\u2026</title><style>${css}</style></head><body>${dots}<script>${script}<\/script></body></html>`;

  // ── Log click async (don't await — faster redirect) ───────────────────────
  const logClick = fetch(`${supabaseUrl}/rest/v1/clicks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey:         supabaseKey,
      Authorization:  `Bearer ${supabaseKey}`,
      Prefer:         "return=minimal",
    },
    body: JSON.stringify({
      slug,
      platform,
      link_type: (webOnly || !appUri) ? "web" : "app",
      device,
      country,
      referrer,
      clicked_at: new Date().toISOString(),
    }),
  }).catch(function() {});

  // Return the redirect page HTML directly — no extra round trip
  return {
    statusCode: 200,
    headers: { "Content-Type": "text/html" },
    body: html,
  };
};
