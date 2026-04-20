-- Add icon_url column to tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS icon_url TEXT;

-- Promo codes table
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  reward_amount NUMERIC NOT NULL DEFAULT 0,
  reward_currency_id UUID REFERENCES public.currencies(id) ON DELETE SET NULL,
  xp_reward INT NOT NULL DEFAULT 0,
  max_uses INT NOT NULL DEFAULT 0,
  used_count INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Promo code redemptions (one per user per code)
CREATE TABLE IF NOT EXISTS public.promo_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_id UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.users(telegram_id) ON DELETE CASCADE,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(promo_id, user_id)
);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read promo codes" ON public.promo_codes;
CREATE POLICY "Public can read promo codes" ON public.promo_codes FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Public can manage promo codes" ON public.promo_codes;
CREATE POLICY "Public can manage promo codes" ON public.promo_codes FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public can manage promo redemptions" ON public.promo_redemptions;
CREATE POLICY "Public can manage promo redemptions" ON public.promo_redemptions FOR ALL TO public USING (true) WITH CHECK (true);
