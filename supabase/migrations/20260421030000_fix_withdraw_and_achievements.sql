-- =====================================================================
-- Fix #5: Withdrawal balance not being deducted
-- Root cause: the protect_balance_from_auth_reset trigger blocked any
-- legitimate update that brought the balance to exactly 0 (e.g. user
-- withdrawing 100% of their balance). Replace it with a no-op so the
-- previous trigger no longer interferes. Telegram-auth already uses
-- INSERT ... ON CONFLICT DO NOTHING (ignoreDuplicates), so the original
-- protection is no longer needed.
-- =====================================================================

DROP TRIGGER IF EXISTS trg_protect_balance_from_reset ON public.balances;
DROP FUNCTION IF EXISTS public.protect_balance_from_auth_reset();

-- =====================================================================
-- Fix #4: Track which achievements each user has claimed, so big-task
-- rewards (referrals, ads watched, level up, daily check-in streak,
-- tasks completed) can be claimed exactly once per user per achievement.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  achievement_id text NOT NULL,
  reward_amount numeric NOT NULL DEFAULT 0,
  reward_currency_id uuid REFERENCES public.currencies(id) ON DELETE SET NULL,
  xp_reward integer NOT NULL DEFAULT 0,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, achievement_id)
);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read user_achievements" ON public.user_achievements;
CREATE POLICY "Public read user_achievements"
  ON public.user_achievements FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "Public insert user_achievements" ON public.user_achievements;
CREATE POLICY "Public insert user_achievements"
  ON public.user_achievements FOR INSERT TO public
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS user_achievements_user_idx
  ON public.user_achievements (user_id);
