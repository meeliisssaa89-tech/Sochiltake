-- ============================================================================
-- Publisher Articles v2: multi-section editor + AI providers + code-task link
-- ============================================================================

-- 1) Multi-section content for publisher articles.
--    Each entry: { "title": text, "content": text, "image_url": text|null }
ALTER TABLE public.shortlink_pub_articles
  ADD COLUMN IF NOT EXISTS sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source   text  NOT NULL DEFAULT 'human'; -- human | ai

-- 2) Multiple AI providers/models that admins can manage from the dashboard.
CREATE TABLE IF NOT EXISTS public.shortlink_ai_models (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  provider    text          NOT NULL,                -- openai | gemini | deepseek | anthropic | openrouter | custom
  display_name text         NOT NULL,                -- e.g. "Gemini 1.5 Pro"
  model       text          NOT NULL,                -- raw model id sent to the provider
  api_key     text          NOT NULL,                -- stored on server, never exposed publicly
  base_url    text,                                  -- optional override (used by openrouter / custom)
  language    text          NOT NULL DEFAULT 'ar',
  is_default  boolean       NOT NULL DEFAULT false,
  is_active   boolean       NOT NULL DEFAULT true,
  sort_order  int           NOT NULL DEFAULT 0,
  created_at  timestamptz   NOT NULL DEFAULT now(),
  updated_at  timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE public.shortlink_ai_models ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role only" ON public.shortlink_ai_models;
CREATE POLICY "service role only" ON public.shortlink_ai_models
  FOR ALL USING (false) WITH CHECK (false);

-- Only one default at a time
CREATE OR REPLACE FUNCTION public.shortlink_ai_models_single_default()
RETURNS trigger AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.shortlink_ai_models
    SET is_default = false
    WHERE id <> NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS shortlink_ai_models_single_default_t ON public.shortlink_ai_models;
CREATE TRIGGER shortlink_ai_models_single_default_t
  BEFORE INSERT OR UPDATE ON public.shortlink_ai_models
  FOR EACH ROW EXECUTE FUNCTION public.shortlink_ai_models_single_default();

-- 3) Allow code_api tasks in the Telegram app to be backed by a specific
--    publisher article instead of the random AI reader.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS publisher_article_id uuid
    REFERENCES public.shortlink_pub_articles(id) ON DELETE SET NULL;

-- 4) Single-article reader sessions (separate from random-articles task_code_sessions)
CREATE TABLE IF NOT EXISTS public.shortlink_pub_sessions (
  id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      text          NOT NULL,
  task_id      uuid,
  article_id   uuid          NOT NULL REFERENCES public.shortlink_pub_articles(id) ON DELETE CASCADE,
  slug         text          NOT NULL,
  token        text          NOT NULL UNIQUE,
  code         text,
  pages_done   int           NOT NULL DEFAULT 0,
  total_pages  int           NOT NULL DEFAULT 1,
  started_at   timestamptz,
  last_page_at timestamptz,
  completed_at timestamptz,
  used_at      timestamptz,
  created_at   timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shortlink_pub_sessions_user_idx
  ON public.shortlink_pub_sessions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS shortlink_pub_sessions_token_idx
  ON public.shortlink_pub_sessions (token);
CREATE INDEX IF NOT EXISTS shortlink_pub_sessions_code_idx
  ON public.shortlink_pub_sessions (code) WHERE code IS NOT NULL;

ALTER TABLE public.shortlink_pub_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role only" ON public.shortlink_pub_sessions;
CREATE POLICY "service role only" ON public.shortlink_pub_sessions
  FOR ALL USING (false) WITH CHECK (false);
