import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

function detectDevice(ua: string): 'mobile' | 'desktop' {
  return /iPhone|iPad|iPod|Android|Mobile/i.test(ua) ? 'mobile' : 'desktop'
}

function getDeepLink(url: string, device: 'mobile' | 'desktop'): string {
  if (device === 'desktop') return url

  // Spotify: https://open.spotify.com/track/ID → spotify://track/ID
  const spotifyMatch = url.match(/open\.spotify\.com\/(track|album|playlist|artist)\/([A-Za-z0-9]+)/)
  if (spotifyMatch) return `spotify://${spotifyMatch[1]}/${spotifyMatch[2]}`

  // YouTube: https://www.youtube.com/watch?v=ID → youtube://v/ID
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]+)/)
  if (ytMatch) return `youtube://v/${ytMatch[1]}`

  // Apple Music: passes through (iOS opens in app natively)
  // Amazon Music: passes through
  return url
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url)
  // Accept ?slug=, ?go=, or a trailing path segment (e.g. /redirect/my-slug)
  const pathSegments = url.pathname.split('/').filter(Boolean)
  const pathSlug = pathSegments.length > 3 ? pathSegments[pathSegments.length - 1] : null
  const slug = url.searchParams.get('slug') ||
               url.searchParams.get('go') ||
               pathSlug

  if (!slug) {
    return new Response('Missing slug', { status: 400 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { data: link, error } = await supabase
    .from('links')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error || !link) {
    return new Response('Link not found', { status: 404 })
  }

  const ua = req.headers.get('user-agent') || ''
  const device = detectDevice(ua)
  const country =
    req.headers.get('cf-ipcountry') ||
    req.headers.get('x-vercel-ip-country') ||
    req.headers.get('x-country') ||
    'unknown'
  const referrer = req.headers.get('referer') || ''

  // Pick source URL: prefer per-device fields, fall back to generic url field
  const sourceUrl: string =
    (device === 'mobile' ? link.mobile_url : link.desktop_url) || link.url || ''

  if (!sourceUrl) {
    return new Response('No destination URL configured', { status: 404 })
  }

  const destination = getDeepLink(sourceUrl, device)
  const openedApp = destination !== sourceUrl

  // Fire-and-forget click log (don't await — keeps redirect fast)
  supabase.from('clicks').insert({
    link_id: link.id,
    slug,
    device_type: device,
    country,
    referrer,
    destination,
    opened_app: openedApp,
    created_at: new Date().toISOString(),
  }).then(() => {})

  return new Response(null, {
    status: 302,
    headers: {
      Location: destination,
      'Cache-Control': 'no-store',
    },
  })
})
