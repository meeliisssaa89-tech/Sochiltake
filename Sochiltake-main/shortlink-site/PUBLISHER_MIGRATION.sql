-- ============================================================================
-- Publisher Program — Supabase schema additions (run in the shortlink DB)
-- Run this in your Supabase SQL editor for the shortlink project.
-- ============================================================================

-- 1) Add publisher-control columns to shortlink_settings
ALTER TABLE public.shortlink_settings
  ADD COLUMN IF NOT EXISTS publishers_enabled   boolean    DEFAULT true,
  ADD COLUMN IF NOT EXISTS signup_enabled        boolean    DEFAULT true,
  ADD COLUMN IF NOT EXISTS articles_require_approval boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS signup_bonus          numeric    DEFAULT 0,
  ADD COLUMN IF NOT EXISTS earnings_per_visit    numeric    DEFAULT 0.001,
  ADD COLUMN IF NOT EXISTS min_section_chars     int        DEFAULT 500,
  ADD COLUMN IF NOT EXISTS site_url              text;

-- Enable publishers and signup by default
UPDATE public.shortlink_settings SET
  publishers_enabled = true,
  signup_enabled     = true
WHERE id = 1;

-- 2) Publishers table
CREATE TABLE IF NOT EXISTS public.shortlink_publishers (
  id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  email               text         NOT NULL UNIQUE,
  password_hash       text         NOT NULL,
  display_name        text,
  link_code           text         NOT NULL UNIQUE,
  pending_balance     numeric      NOT NULL DEFAULT 0,
  lifetime_earnings   numeric      NOT NULL DEFAULT 0,
  total_visits        int          NOT NULL DEFAULT 0,
  linked_telegram_id  text,
  is_blocked          boolean      NOT NULL DEFAULT false,
  created_at          timestamptz  NOT NULL DEFAULT now(),
  updated_at          timestamptz  NOT NULL DEFAULT now()
);

-- 3) Publisher articles
CREATE TABLE IF NOT EXISTS public.shortlink_pub_articles (
  id                   uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id         uuid         NOT NULL REFERENCES public.shortlink_publishers(id) ON DELETE CASCADE,
  slug                 text         NOT NULL UNIQUE,
  title                text         NOT NULL,
  content              text,
  cover_url            text,
  sections             jsonb        NOT NULL DEFAULT '[]'::jsonb,
  source               text         DEFAULT 'publisher',
  linked_shortlink_code text,
  status               text         NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','approved','rejected')),
  rejection_reason     text,
  visit_count          int          NOT NULL DEFAULT 0,
  earnings             numeric      NOT NULL DEFAULT 0,
  created_at           timestamptz  NOT NULL DEFAULT now(),
  updated_at           timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pub_articles_publisher_idx ON public.shortlink_pub_articles (publisher_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pub_articles_slug_idx      ON public.shortlink_pub_articles (slug);
CREATE INDEX IF NOT EXISTS pub_articles_status_idx    ON public.shortlink_pub_articles (status, created_at DESC);

-- 4) Publisher shortlinks (separate from main-app shortlinks)
CREATE TABLE IF NOT EXISTS public.publisher_shortlinks (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id  uuid         NOT NULL REFERENCES public.shortlink_publishers(id) ON DELETE CASCADE,
  title         text,
  original_url  text         NOT NULL,
  short_code    text         NOT NULL UNIQUE,
  visit_count   int          NOT NULL DEFAULT 0,
  earnings      numeric      NOT NULL DEFAULT 0,
  is_active     boolean      NOT NULL DEFAULT true,
  created_at    timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pub_shortlinks_publisher_idx ON public.publisher_shortlinks (publisher_id, created_at DESC);

-- 5) AI models table (optional — lets admin configure multiple AI providers)
CREATE TABLE IF NOT EXISTS public.shortlink_ai_models (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  provider     text         NOT NULL DEFAULT 'openai',
  display_name text         NOT NULL,
  model_id     text         NOT NULL,
  is_default   boolean      NOT NULL DEFAULT false,
  is_active    boolean      NOT NULL DEFAULT true,
  sort_order   int          NOT NULL DEFAULT 0,
  created_at   timestamptz  NOT NULL DEFAULT now()
);

-- 6) Publisher sessions (optional — tracks publisher login sessions)
CREATE TABLE IF NOT EXISTS public.shortlink_pub_sessions (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id  uuid         NOT NULL REFERENCES public.shortlink_publishers(id) ON DELETE CASCADE,
  token_hash    text         NOT NULL,
  expires_at    timestamptz  NOT NULL,
  created_at    timestamptz  NOT NULL DEFAULT now()
);

-- 7) RLS — service role only for all publisher tables
ALTER TABLE public.shortlink_publishers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shortlink_pub_articles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publisher_shortlinks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shortlink_ai_models      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shortlink_pub_sessions   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role only" ON public.shortlink_publishers;
CREATE POLICY "service role only" ON public.shortlink_publishers FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "service role only" ON public.shortlink_pub_articles;
CREATE POLICY "service role only" ON public.shortlink_pub_articles FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "service role only" ON public.publisher_shortlinks;
CREATE POLICY "service role only" ON public.publisher_shortlinks FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "service role only" ON public.shortlink_ai_models;
CREATE POLICY "service role only" ON public.shortlink_ai_models FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "service role only" ON public.shortlink_pub_sessions;
CREATE POLICY "service role only" ON public.shortlink_pub_sessions FOR ALL USING (false) WITH CHECK (false);
