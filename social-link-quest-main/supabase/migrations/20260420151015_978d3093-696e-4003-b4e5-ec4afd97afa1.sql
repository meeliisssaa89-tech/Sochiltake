
-- Spin wheel prizes
CREATE TABLE IF NOT EXISTS public.spin_prizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  image_url TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency_id UUID REFERENCES public.currencies(id) ON DELETE SET NULL,
  weight INTEGER NOT NULL DEFAULT 1,
  xp_reward INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.spin_prizes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Spin prizes viewable by all" ON public.spin_prizes FOR SELECT USING (true);
CREATE POLICY "Service role manages spin prizes" ON public.spin_prizes FOR ALL USING (true) WITH CHECK (true);

-- Spin history
CREATE TABLE IF NOT EXISTS public.spin_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  prize_id UUID REFERENCES public.spin_prizes(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency_id UUID,
  spin_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.spin_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Spin history viewable" ON public.spin_history FOR SELECT USING (true);
CREATE POLICY "Service role manages spin history" ON public.spin_history FOR ALL USING (true) WITH CHECK (true);

-- Wallet tokens (admin-configured tokens shown in user wallet)
CREATE TABLE IF NOT EXISTS public.wallet_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  icon_url TEXT,
  contract_address TEXT,
  chain TEXT DEFAULT 'ethereum',
  price_api_url TEXT,
  price_usd NUMERIC NOT NULL DEFAULT 0,
  decimals INTEGER NOT NULL DEFAULT 18,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wallet_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Wallet tokens viewable" ON public.wallet_tokens FOR SELECT USING (true);
CREATE POLICY "Service role manages wallet tokens" ON public.wallet_tokens FOR ALL USING (true) WITH CHECK (true);

-- Default settings
INSERT INTO public.app_settings (key, value) VALUES
  ('spin_config', '{"enabled": true, "free_spins_per_day": 3, "cost_per_spin": 0}'::jsonb),
  ('wallet_config', '{"moralis_api_key": "", "coingecko_api_key": "", "enabled": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Seed sample prizes
INSERT INTO public.spin_prizes (label, amount, weight, xp_reward, sort_order) VALUES
  ('10 PTS', 10, 40, 5, 1),
  ('50 PTS', 50, 20, 10, 2),
  ('100 PTS', 100, 10, 25, 3),
  ('0.01 USDT', 0.01, 15, 50, 4),
  ('500 PTS', 500, 3, 100, 5),
  ('25 PTS', 25, 25, 8, 6),
  ('0.05 USDT', 0.05, 5, 100, 7),
  ('5 PTS', 5, 35, 3, 8)
ON CONFLICT DO NOTHING;
