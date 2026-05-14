-- Add referral_earning task type
ALTER TYPE public.task_type ADD VALUE IF NOT EXISTS 'referral_earning';

-- Tournament withdrawals table (user-facing tournament wallet withdrawals)
CREATE TABLE IF NOT EXISTS public.tournament_withdrawals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT NOT NULL REFERENCES public.users(telegram_id) ON DELETE CASCADE,
  amount       NUMERIC NOT NULL,
  currency_id  UUID REFERENCES public.currencies(id),
  wallet_address TEXT,
  method_name  TEXT NOT NULL DEFAULT 'Manual',
  status       TEXT NOT NULL DEFAULT 'pending',
  admin_note   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at  TIMESTAMPTZ
);

ALTER TABLE public.tournament_withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own tournament withdrawals"
  ON public.tournament_withdrawals FOR SELECT USING (true);
CREATE POLICY "Users insert own tournament withdrawals"
  ON public.tournament_withdrawals FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins manage tournament withdrawals"
  ON public.tournament_withdrawals FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS tournament_withdrawals_user_id_idx ON public.tournament_withdrawals(user_id);
CREATE INDEX IF NOT EXISTS tournament_withdrawals_status_idx  ON public.tournament_withdrawals(status);

-- Add deposit credit currency setting placeholder
INSERT INTO public.app_settings (key, value)
VALUES ('tournament_deposit_credit_currency_id', 'null')
ON CONFLICT (key) DO NOTHING;
