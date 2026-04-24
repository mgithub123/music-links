# Music Links — Setup Guide

## What changed
Links are now stored in Supabase — no Netlify deploys needed when publishing. 
Every link lives at: `yoursite.netlify.app/go?slug=your-slug`

---

## Step 1 — Supabase: run this SQL

In Supabase → SQL Editor → New query, run:

```sql
create table links (
  id           bigserial primary key,
  slug         text unique not null,
  platform     text,
  app_uri      text,
  web_url      text,
  web_only     boolean default false,
  original_url text,
  created_at   timestamptz default now()
);

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

---

## Step 2 — Netlify: environment variables

In Netlify → Site configuration → Environment variables, add:
- `SUPABASE_URL` = your Supabase project URL (e.g. https://xxxx.supabase.co)
- `SUPABASE_ANON_KEY` = your Supabase anon/legacy key

Then trigger a redeploy.

---

## Step 3 — Connect dashboard to Supabase

Visit `yoursite.netlify.app/?settings` — it will prompt you for your Supabase URL and key. Enter them once and the dashboard works.

---

## How it works

- You publish a link → saved to Supabase, no deploy
- Fan clicks `yoursite.netlify.app/go?slug=work-work-work`
- Netlify function looks up the slug, logs the click, serves the redirect
- Dashboard reads click data directly from Supabase
