-- Migration: Publisher Shortlinks
-- Allows publishers to create shortened URLs as an alternative (or complement) to writing articles.
-- Every shortlink visit is monetised the same way as an article visit.
-- NO existing tables are altered — purely additive.

-- 1) Main table
CREATE TABLE IF NOT EXISTS public.publisher_shortlinks (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id uuid        NOT NULL REFERENCES public.shortlink_publishers(id) ON DELETE CASCADE,
  title        text,                                  -- optional label shown to publisher
  original_url text        NOT NULL,                  -- destination URL
  short_code   text        NOT NULL UNIQUE,           -- e.g. "aB3xY7"
  visit_count  integer     NOT NULL DEFAULT 0,
  earnings     numeric(18,8) NOT NULL DEFAULT 0,
  is_active    boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS publisher_shortlinks_publisher_idx
  ON public.publisher_shortlinks (publisher_id, created_at DESC);

CREATE INDEX IF NOT EXISTS publisher_shortlinks_code_idx
  ON public.publisher_shortlinks (short_code);

-- Row-level security: service role only (same pattern as all other publisher tables)
ALTER TABLE public.publisher_shortlinks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role only" ON public.publisher_shortlinks;
CREATE POLICY "service role only" ON public.publisher_shortlinks
  FOR ALL USING (false) WITH CHECK (false);

-- 2) Visits table for shortlinks (separate from article visits to keep FKs clean)
CREATE TABLE IF NOT EXISTS public.publisher_shortlink_visits (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  shortlink_id  uuid        NOT NULL REFERENCES public.publisher_shortlinks(id) ON DELETE CASCADE,
  publisher_id  uuid        NOT NULL REFERENCES public.shortlink_publishers(id) ON DELETE CASCADE,
  country       text,
  ip_hash       text,
  user_agent    text,
  referrer      text,
  revenue       numeric(18,8) NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS publisher_shortlink_visits_sl_idx
  ON public.publisher_shortlink_visits (shortlink_id, created_at DESC);

CREATE INDEX IF NOT EXISTS publisher_shortlink_visits_pub_idx
  ON public.publisher_shortlink_visits (publisher_id, created_at DESC);

ALTER TABLE public.publisher_shortlink_visits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role only" ON public.publisher_shortlink_visits;
CREATE POLICY "service role only" ON public.publisher_shortlink_visits
  FOR ALL USING (false) WITH CHECK (false);
