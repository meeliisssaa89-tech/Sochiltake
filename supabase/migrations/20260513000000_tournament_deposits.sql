-- Tournament deposits tracking (local currency deposit submissions)
CREATE TABLE IF NOT EXISTS public.tournament_deposits (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT NOT NULL REFERENCES public.users(telegram_id) ON DELETE CASCADE,
  method_id    TEXT NOT NULL,
  method_name  TEXT NOT NULL,
  currency     TEXT NOT NULL DEFAULT 'USD',
  amount_local NUMERIC NOT NULL,
  rate_usd     NUMERIC NOT NULL DEFAULT 1,
  amount_usd   NUMERIC,
  user_note    TEXT,
  admin_note   TEXT,
  status       TEXT NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at  TIMESTAMPTZ
);

ALTER TABLE public.tournament_deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own deposits"
  ON public.tournament_deposits FOR SELECT
  USING (user_id = current_setting('app.telegram_id', true));

CREATE POLICY "Users submit deposits"
  ON public.tournament_deposits FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role manages deposits"
  ON public.tournament_deposits FOR ALL TO service_role USING (true);

CREATE INDEX IF NOT EXISTS tournament_deposits_user_id_idx ON public.tournament_deposits(user_id);
CREATE INDEX IF NOT EXISTS tournament_deposits_status_idx  ON public.tournament_deposits(status);
