import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PLATFORM_COLORS: Record<string, string> = {
  spotify: '#1ed760',
  apple: '#fc3c44',
  amazon: '#00a8e1',
  youtube: '#ff0000',
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url)
  const slug = url.searchParams.get('go')

  if (!slug) {
    return new Response('Missing ?go= parameter', { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: link } = await supabase
    .from('links')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (!link) {
    return new Response(
      '<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body style="margin:0;background:#000;color:#333;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;">Link not found.</body></html>',
      { status: 404, headers: { 'Content-Type': 'text/html' } },
    )
  }

  // Device detection from User-Agent
  const ua = req.headers.get('user-agent') ?? ''
  const isTablet = /ipad|tablet/i.test(ua)
  const isMobile = /iphone|ipad|ipod|android/i.test(ua)
  const device = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop'

  // Country detection — Supabase edge nodes forward these headers
  const country =
    req.headers.get('x-country') ??
    req.headers.get('cf-ipcountry') ??
    null

  const referrer = req.headers.get('referer') ?? null
  const isApp = isMobile && !link.web_only && !!link.app_uri

  // Log click (await to guarantee write before response exits)
  await supabase.from('clicks').insert({
    slug,
    platform: link.platform,
    link_type: isApp ? 'app' : 'web',
    device,
    country,
    referrer,
    clicked_at: new Date().toISOString(),
  })

  // Desktop or web-only: straight 302
  if (!isMobile || link.web_only || !link.app_uri) {
    return new Response(null, {
      status: 302,
      headers: { Location: link.web_url },
    })
  }

  // Mobile with app URI: serve HTML that tries app deep link then falls back
  const color = PLATFORM_COLORS[link.platform] ?? '#fff'
  const appUri = link.app_uri as string
  const webUrl = link.web_url as string

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Opening…</title>
<style>
html,body{margin:0;padding:0;background:#000;width:100%;height:100%;display:flex;align-items:center;justify-content:center;}
.dots{display:flex;gap:6px;}
.dot{width:6px;height:6px;background:${color};border-radius:50%;animation:p 1.2s ease-in-out infinite;}
.dot:nth-child(2){animation-delay:.2s}
.dot:nth-child(3){animation-delay:.4s}
@keyframes p{0%,100%{opacity:.2;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}
</style>
</head>
<body>
<div class="dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
<script>
var t=setTimeout(function(){window.location.href=${JSON.stringify(webUrl)};},1800);
document.addEventListener('visibilitychange',function(){if(document.hidden)clearTimeout(t);});
window.addEventListener('pagehide',function(){clearTimeout(t);});
window.location.href=${JSON.stringify(appUri)};
</script>
</body>
</html>`

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
})
