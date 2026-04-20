
-- 1) Remove FG currency entirely; ensure default reward currency is configurable via app_settings
UPDATE public.balances SET amount = 0 WHERE currency_id IN (SELECT id FROM public.currencies WHERE symbol = 'FG');
DELETE FROM public.balances WHERE currency_id IN (SELECT id FROM public.currencies WHERE symbol = 'FG');
UPDATE public.tasks SET reward_currency_id = NULL WHERE reward_currency_id IN (SELECT id FROM public.currencies WHERE symbol = 'FG');
UPDATE public.daily_checkins SET reward_currency_id = NULL WHERE reward_currency_id IN (SELECT id FROM public.currencies WHERE symbol = 'FG');
DELETE FROM public.currencies WHERE symbol = 'FG';

-- 2) Seed a default custom reward currency named "Points" (admin can edit)
INSERT INTO public.currencies (symbol, name, name_ar, decimals, exchange_rate, is_active)
SELECT 'PTS', 'Points', 'نقاط', 0, 1.0, true
WHERE NOT EXISTS (SELECT 1 FROM public.currencies WHERE symbol = 'PTS');

-- 3) Seed app_settings keys
INSERT INTO public.app_settings (key, value) VALUES
  ('reward_currency_symbol', '"PTS"'::jsonb),
  ('referral_reward', '{"amount": 100, "xp": 50, "text_en": "Earn 100 Points + 50 XP for every friend that joins!", "text_ar": "احصل على 100 نقطة + 50 خبرة لكل صديق ينضم!"}'::jsonb),
  ('checkin_rewards', '[50,100,150,200,250,300,500]'::jsonb),
  ('ads_daily', '{"daily_count": 10, "reward_per_ad": 10, "xp_per_ad": 5, "duration_seconds": 15, "enabled": true}'::jsonb),
  ('ads_sdk_html', '""'::jsonb),
  ('ads_zones', '{"daily_ad_zone": "", "task_ad_zone": ""}'::jsonb),
  ('app_icons', '{}'::jsonb),
  ('bot_username', '"Eg_Token_bot"'::jsonb),
  ('bot_webapp_url', '"https://social-link-quest.lovable.app"'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 4) Daily ad watches log
CREATE TABLE IF NOT EXISTS public.ad_watches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  watch_date DATE NOT NULL DEFAULT CURRENT_DATE,
  slot_index INTEGER NOT NULL,
  reward_amount NUMERIC NOT NULL DEFAULT 0,
  reward_currency_id UUID,
  xp_reward INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, watch_date, slot_index)
);

ALTER TABLE public.ad_watches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ad watches viewable by all" ON public.ad_watches;
CREATE POLICY "Ad watches viewable by all" ON public.ad_watches FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role manages ad watches" ON public.ad_watches;
CREATE POLICY "Service role manages ad watches" ON public.ad_watches FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5) Broadcast logs
CREATE TABLE IF NOT EXISTS public.broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT NOT NULL,
  parse_mode TEXT DEFAULT 'HTML',
  media_url TEXT,
  media_type TEXT,
  buttons JSONB DEFAULT '[]'::jsonb,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Broadcasts viewable" ON public.broadcasts;
CREATE POLICY "Broadcasts viewable" ON public.broadcasts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role manages broadcasts" ON public.broadcasts;
CREATE POLICY "Service role manages broadcasts" ON public.broadcasts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 6) Activity feed (for green dot indicator)
CREATE TABLE IF NOT EXISTS public.activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_user_created ON public.activity_feed (user_id, created_at DESC);

ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Activity viewable by all" ON public.activity_feed;
CREATE POLICY "Activity viewable by all" ON public.activity_feed FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role manages activity" ON public.activity_feed;
CREATE POLICY "Service role manages activity" ON public.activity_feed FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 7) Enable realtime for live updates (green dot indicator)
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_feed;
ALTER PUBLICATION supabase_realtime ADD TABLE public.balances;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_tasks;
