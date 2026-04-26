-- ============================================================================
-- Shortlink Publishers system — author accounts, articles, visits, payouts
-- All features default OFF. Toggle from the main admin panel.
-- ============================================================================

-- 1) Make sure the singleton settings row exists, then extend it with feature flags
CREATE TABLE IF NOT EXISTS public.shortlink_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1)
);
INSERT INTO public.shortlink_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE public.shortlink_settings
  ADD COLUMN IF NOT EXISTS page_count          int          NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS wait_seconds        int          NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS ai_provider         text         DEFAULT 'openai',
  ADD COLUMN IF NOT EXISTS ai_api_key          text,
  ADD COLUMN IF NOT EXISTS ai_model            text         DEFAULT 'gpt-4o-mini',
  ADD COLUMN IF NOT EXISTS ai_image_model      text         DEFAULT 'dall-e-3',
  ADD COLUMN IF NOT EXISTS ai_topics           text[]       DEFAULT ARRAY['technology','crypto','science','health','travel','finance','sports'],
  ADD COLUMN IF NOT EXISTS ai_language         text         DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS site_title          text         DEFAULT 'Articles Hub',
  ADD COLUMN IF NOT EXISTS brand_color         text         DEFAULT '#7c3aed',
  ADD COLUMN IF NOT EXISTS site_url            text,
  ADD COLUMN IF NOT EXISTS ad_head_html        text,
  ADD COLUMN IF NOT EXISTS ad_top_html         text,
  ADD COLUMN IF NOT EXISTS ad_middle_html      text,
  ADD COLUMN IF NOT EXISTS ad_bottom_html      text,
  ADD COLUMN IF NOT EXISTS ad_interstitial_html text,
  ADD COLUMN IF NOT EXISTS admin_password_hash text,
  ADD COLUMN IF NOT EXISTS hmac_secret         text,
  -- Publishers feature flags (all OFF by default)
  ADD COLUMN IF NOT EXISTS publishers_enabled  boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payouts_enabled     boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS signup_enabled      boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS articles_require_approval boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS revenue_per_visit   numeric(18,8) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_payout          numeric(18,8) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS payout_currency_id  uuid,
  ADD COLUMN IF NOT EXISTS signup_bonus        numeric(18,8) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at          timestamptz  NOT NULL DEFAULT now();

-- Make sure shortlink_articles cache table exists (referenced by /api/start.ts)
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

-- 2) Publisher accounts (people who write articles on the shortlink site)
CREATE TABLE IF NOT EXISTS public.shortlink_publishers (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  email               text          NOT NULL UNIQUE,
  password_hash       text          NOT NULL,
  display_name        text,
  link_code           text          NOT NULL UNIQUE, -- redeemed inside Telegram app to link account
  linked_telegram_id  text          UNIQUE,          -- nullable until they link
  pending_balance     numeric(18,8) NOT NULL DEFAULT 0,
  lifetime_earnings   numeric(18,8) NOT NULL DEFAULT 0,
  total_visits        int           NOT NULL DEFAULT 0,
  is_blocked          boolean       NOT NULL DEFAULT false,
  created_at          timestamptz   NOT NULL DEFAULT now(),
  linked_at           timestamptz
);
CREATE INDEX IF NOT EXISTS shortlink_publishers_telegram_idx
  ON public.shortlink_publishers (linked_telegram_id);

-- 3) Articles written by publishers
CREATE TABLE IF NOT EXISTS public.shortlink_pub_articles (
  id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id uuid          NOT NULL REFERENCES public.shortlink_publishers(id) ON DELETE CASCADE,
  slug         text          NOT NULL UNIQUE,
  title        text          NOT NULL,
  content      text          NOT NULL,
  cover_url    text,
  status       text          NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  rejection_reason text,
  visit_count  int           NOT NULL DEFAULT 0,
  earnings     numeric(18,8) NOT NULL DEFAULT 0,
  created_at   timestamptz   NOT NULL DEFAULT now(),
  updated_at   timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shortlink_pub_articles_publisher_idx
  ON public.shortlink_pub_articles (publisher_id, created_at DESC);
CREATE INDEX IF NOT EXISTS shortlink_pub_articles_status_idx
  ON public.shortlink_pub_articles (status, created_at DESC);

-- 4) Visit log for publisher articles (tracks country + revenue per visit)
CREATE TABLE IF NOT EXISTS public.shortlink_pub_visits (
  id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id   uuid          NOT NULL REFERENCES public.shortlink_pub_articles(id) ON DELETE CASCADE,
  publisher_id uuid          NOT NULL REFERENCES public.shortlink_publishers(id) ON DELETE CASCADE,
  country      text,
  ip_hash      text,
  user_agent   text,
  referrer     text,
  revenue      numeric(18,8) NOT NULL DEFAULT 0,
  created_at   timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shortlink_pub_visits_article_idx
  ON public.shortlink_pub_visits (article_id, created_at DESC);
CREATE INDEX IF NOT EXISTS shortlink_pub_visits_publisher_idx
  ON public.shortlink_pub_visits (publisher_id, created_at DESC);
CREATE INDEX IF NOT EXISTS shortlink_pub_visits_country_idx
  ON public.shortlink_pub_visits (publisher_id, country);

-- 5) Payout requests — when publisher converts pending balance into Telegram balance
CREATE TABLE IF NOT EXISTS public.shortlink_payouts (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id  uuid          NOT NULL REFERENCES public.shortlink_publishers(id) ON DELETE CASCADE,
  telegram_id   text          NOT NULL,
  amount        numeric(18,8) NOT NULL,
  currency_id   uuid          REFERENCES public.currencies(id) ON DELETE SET NULL,
  status        text          NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  admin_note    text,
  requested_at  timestamptz   NOT NULL DEFAULT now(),
  processed_at  timestamptz
);
CREATE INDEX IF NOT EXISTS shortlink_payouts_status_idx
  ON public.shortlink_payouts (status, requested_at DESC);
CREATE INDEX IF NOT EXISTS shortlink_payouts_publisher_idx
  ON public.shortlink_payouts (publisher_id, requested_at DESC);

-- 6) Lock everything down to service-role only (the API uses the service-role key)
ALTER TABLE public.shortlink_settings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shortlink_articles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shortlink_publishers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shortlink_pub_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shortlink_pub_visits  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shortlink_payouts     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role only" ON public.shortlink_settings;
CREATE POLICY "service role only" ON public.shortlink_settings   FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "service role only" ON public.shortlink_articles;
CREATE POLICY "service role only" ON public.shortlink_articles   FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "service role only" ON public.shortlink_publishers;
CREATE POLICY "service role only" ON public.shortlink_publishers FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "service role only" ON public.shortlink_pub_articles;
CREATE POLICY "service role only" ON public.shortlink_pub_articles FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "service role only" ON public.shortlink_pub_visits;
CREATE POLICY "service role only" ON public.shortlink_pub_visits FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "service role only" ON public.shortlink_payouts;
CREATE POLICY "service role only" ON public.shortlink_payouts    FOR ALL USING (false) WITH CHECK (false);
