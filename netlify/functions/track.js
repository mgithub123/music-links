// netlify/functions/track.js
// Logs a click to Supabase then redirects the fan to their destination.
//
// Query params:
//   slug      - the link slug (e.g. "work-work-work")
//   dest      - the destination URL (encoded)
//   platform  - "spotify" | "apple" | "amazon" | "youtube"
//   type      - "app" | "web"  (did we attempt the app URI?)

exports.handler = async function (event) {
  const params   = event.queryStringParameters || {};
  const slug     = params.slug     || "unknown";
  const dest     = params.dest     ? decodeURIComponent(params.dest) : null;
  const platform = params.platform || "unknown";
  const linkType = params.type     || "web"; // "app" or "web"

  // ── Gather request metadata ────────────────────────────────────────────────
  const headers   = event.headers || {};
  const ip        = headers["x-forwarded-for"]?.split(",")[0]?.trim() || null;
  const ua        = headers["user-agent"] || "";
  const referrer  = headers["referer"] || headers["referrer"] || null;

  // Device
  const isMobile  = /iphone|ipad|ipod|android/i.test(ua);
  const isTablet  = /ipad|tablet|playbook|silk/i.test(ua);
  const device    = isTablet ? "tablet" : isMobile ? "mobile" : "desktop";

  // Country via Netlify geo headers (available on all plans)
  const country   = headers["x-country"] || headers["x-nf-country"] || null;

  // ── Log to Supabase ────────────────────────────────────────────────────────
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey && slug !== "unknown") {
    try {
      await fetch(`${supabaseUrl}/rest/v1/clicks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey":        supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
          "Prefer":        "return=minimal",
        },
        body: JSON.stringify({
          slug,
          platform,
          link_type: linkType,
          device,
          country,
          referrer,
          clicked_at: new Date().toISOString(),
        }),
      });
    } catch (e) {
      // Never block the redirect because of a logging failure
      console.error("Supabase log failed:", e.message);
    }
  }

  // ── Redirect ───────────────────────────────────────────────────────────────
  if (!dest) {
    return { statusCode: 400, body: "Missing dest parameter" };
  }

  return {
    statusCode: 302,
    headers: { Location: dest },
    body: "",
  };
};
