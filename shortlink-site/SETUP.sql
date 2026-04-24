-- ============================================================================
-- Shortlink Site — Supabase schema additions
-- Run this once in your Supabase SQL editor (the SAME project the main app uses).
-- ============================================================================

-- 1) Singleton settings row for the shortlink site (page count, timer, AI key, ad scripts...)
CREATE TABLE IF NOT EXISTS public.shortlink_settings (
  id                  smallint     PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  page_count          int          NOT NULL DEFAULT 5,
  wait_seconds        int          NOT NULL DEFAULT 8,

  -- AI generation
  ai_provider         text                  DEFAULT 'openai',
  ai_api_key          text,
  ai_model            text                  DEFAULT 'gpt-4o-mini',
  ai_image_model      text                  DEFAULT 'dall-e-3',
  ai_topics           text[]                DEFAULT ARRAY['technology','crypto','science','health','travel','finance','sports'],
  ai_language         text                  DEFAULT 'en',

  -- Branding
  site_title          text                  DEFAULT 'Articles Hub',
  brand_color         text                  DEFAULT '#7c3aed',

  -- Ad slots — admin pastes raw HTML / script tags here
  ad_head_html        text,
  ad_top_html         text,
  ad_middle_html      text,
  ad_bottom_html      text,
  ad_interstitial_html text,

  -- Auth
  admin_password_hash text,
  hmac_secret         text,

  updated_at          timestamptz  NOT NULL DEFAULT now()
);

INSERT INTO public.shortlink_settings (id) VALUES (1)
ON CONFLICT DO NOTHING;

-- 2) Cache of generated articles (so we can rotate / re-use)
CREATE TABLE IF NOT EXISTS public.shortlink_articles (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  topic       text,
  title       text          NOT NULL,
  content     text          NOT NULL,
  image_url   text,
  language    text          DEFAULT 'en',
  use_count   int           NOT NULL DEFAULT 0,
  created_at  timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shortlink_articles_topic_idx ON public.shortlink_articles (topic, created_at DESC);

-- 3) Augment task_code_sessions so the shortlink site can track progress + final code
ALTER TABLE public.task_code_sessions
  ADD COLUMN IF NOT EXISTS code         text,
  ADD COLUMN IF NOT EXISTS pages_done   int          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS started_at   timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS articles     jsonb        NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS last_page_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS task_code_sessions_code_unique
  ON public.task_code_sessions (code)
  WHERE code IS NOT NULL;

-- 4) RLS — service role only (the API uses the service-role key)
ALTER TABLE public.shortlink_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role only" ON public.shortlink_settings;
CREATE POLICY "service role only" ON public.shortlink_settings
  FOR ALL USING (false) WITH CHECK (false);

ALTER TABLE public.shortlink_articles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role only" ON public.shortlink_articles;
CREATE POLICY "service role only" ON public.shortlink_articles
  FOR ALL USING (false) WITH CHECK (false);
