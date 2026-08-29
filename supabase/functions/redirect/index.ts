import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  const url = new URL(req.url)
  const slug = url.searchParams.get('go')
  if (!slug) return json({ error: 'Missing ?go= parameter' }, 400)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: link } = await supabase
    .from('links')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (!link) return json({ error: 'Link not found' }, 404)

  const country =
    req.headers.get('x-country') ??
    req.headers.get('cf-ipcountry') ??
    null
  const referrer = req.headers.get('referer') ?? null
  const device = url.searchParams.get('device') ?? 'desktop'
  const isApp = device !== 'desktop' && !link.web_only && !!link.app_uri

  await supabase.from('clicks').insert({
    slug,
    platform: link.platform,
    link_type: isApp ? 'app' : 'web',
    device,
    country,
    referrer,
    clicked_at: new Date().toISOString(),
  })

  return json({
    app_uri: link.app_uri ?? null,
    web_url: link.web_url,
    web_only: link.web_only ?? false,
    platform: link.platform,
  })
})
