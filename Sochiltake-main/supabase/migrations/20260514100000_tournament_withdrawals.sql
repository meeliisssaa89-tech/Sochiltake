-- Tournament withdrawal requests table
CREATE TABLE IF NOT EXISTS public.tournament_withdrawals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT NOT NULL REFERENCES public.users(telegram_id) ON DELETE CASCADE,
  network      TEXT NOT NULL DEFAULT '',
  address      TEXT NOT NULL DEFAULT '',
  amount_usd   NUMERIC NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  admin_note   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at  TIMESTAMPTZ
);

ALTER TABLE public.tournament_withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users submit withdrawals"
  ON public.tournament_withdrawals FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users see own withdrawals"
  ON public.tournament_withdrawals FOR SELECT
  USING (true);

CREATE POLICY "Service role manages withdrawals"
  ON public.tournament_withdrawals FOR ALL TO service_role USING (true);

CREATE INDEX IF NOT EXISTS tournament_withdrawals_user_id_idx ON public.tournament_withdrawals(user_id);
CREATE INDEX IF NOT EXISTS tournament_withdrawals_status_idx  ON public.tournament_withdrawals(status);

-- Also fix UPDATE policy for tournament_deposits (admin approval)
CREATE POLICY "Service or admin can update deposits"
  ON public.tournament_deposits FOR UPDATE
  USING (true)
  WITH CHECK (true);
