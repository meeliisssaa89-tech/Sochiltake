-- =====================================================================
--  Round 2 fixes:
--   1) Allow deleting users from admin (add ON DELETE CASCADE on user-
--      linked tables that were missing it).
--   5) Per-currency withdrawal rules: min/max amount + required referrals.
--   4) Daily check-in reward currency choice (used by daily-checkin fn).
-- =====================================================================

-- ── 1. Cascade-delete user data when a user is removed ──────────────────
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conrelid::regclass AS tbl, conname
    FROM   pg_constraint
    WHERE  contype = 'f'
      AND  conrelid IN (
        'public.ad_watches'::regclass,
        'public.activity_feed'::regclass,
        'public.spin_history'::regclass,
        'public.user_achievements'::regclass
      )
      AND  pg_get_constraintdef(oid) ILIKE '%users(telegram_id)%'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;
END$$;

-- Recreate them as CASCADE; some of these tables had no FK at all, so
-- IF NOT EXISTS via DO block.
ALTER TABLE public.ad_watches
  ADD CONSTRAINT ad_watches_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(telegram_id) ON DELETE CASCADE;

ALTER TABLE public.activity_feed
  ADD CONSTRAINT activity_feed_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(telegram_id) ON DELETE CASCADE;

ALTER TABLE public.spin_history
  ADD CONSTRAINT spin_history_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(telegram_id) ON DELETE CASCADE;

ALTER TABLE public.user_achievements
  ADD CONSTRAINT user_achievements_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(telegram_id) ON DELETE CASCADE;

-- ── 5. Per-currency withdrawal limits ──────────────────────────────────
ALTER TABLE public.currencies
  ADD COLUMN IF NOT EXISTS min_withdraw_amount   numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_withdraw_amount   numeric,
  ADD COLUMN IF NOT EXISTS required_referrals    integer NOT NULL DEFAULT 0;

-- ── 4. Daily check-in: configurable currency ───────────────────────────
INSERT INTO public.app_settings (key, value)
VALUES ('checkin_currency_symbol', '"TON"'::jsonb)
ON CONFLICT (key) DO NOTHING;
