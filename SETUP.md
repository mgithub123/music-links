# Music Links — Setup Guide

## What this is
A self-hosted music deep link generator with click analytics. You host it on Netlify (free), analytics go to Supabase (free).

---

## Step 1 — Push to GitHub

1. Create a new repo on GitHub (e.g. `music-links`)
2. Upload these files:
   ```
   index.html
   netlify.toml
   netlify/functions/track.js
   ```
3. Push to GitHub

---

## Step 2 — Connect to Netlify

1. Go to [app.netlify.com](https://app.netlify.com) → Add new site → Import from Git
2. Choose your GitHub repo
3. Build settings: leave everything blank (no build command needed)
4. Click **Deploy site**

Your generator is now live at e.g. `yourband.netlify.app`

---

## Step 3 — Set up Supabase (for analytics)

1. Go to [supabase.com](https://supabase.com) → New project (free)
2. Once created, go to **SQL Editor** and run:

```sql
create table clicks (
  id          bigserial primary key,
  slug        text,
  platform    text,
  link_type   text,
  device      text,
  country     text,
  referrer    text,
  clicked_at  timestamptz default now()
);
```

3. Go to **Settings → API** and copy:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon public key**

---

## Step 4 — Add environment variables to Netlify

1. In Netlify → Site settings → Environment variables → Add a variable
2. Add:
   - `SUPABASE_URL` = your Supabase project URL
   - `SUPABASE_ANON_KEY` = your Supabase anon key
3. **Redeploy** the site (Deploys → Trigger deploy)

---

## Step 5 — Use it

1. Visit your Netlify site URL
2. **Generator tab:**
   - Add your Netlify personal access token (one-time, from [app.netlify.com/user/applications](https://app.netlify.com/user/applications))
   - Paste any music link
   - Name it, hit **Publish** → you get a live URL instantly
3. **Dashboard tab:**
   - Enter your Supabase URL + anon key (one-time)
   - See all your click data in real time

---

## How tracking works

When a fan clicks your link:
1. The redirect page fires a request to `/track` with the slug, platform, and link type
2. The Netlify function logs the click to Supabase (device, country, referrer are captured server-side)
3. The fan is redirected to the app or web player

No third-party tracking. No cookies. All data is yours.
