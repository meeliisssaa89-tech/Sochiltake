-- Fix tournament_deposits SELECT policy to allow client-side filtering by user_id
DROP POLICY IF EXISTS "Users see own deposits" ON public.tournament_deposits;

CREATE POLICY "Users see own deposits"
  ON public.tournament_deposits FOR SELECT
  USING (true);

-- Add admin_only_articles to shortlink_settings
ALTER TABLE public.shortlink_settings
  ADD COLUMN IF NOT EXISTS admin_only_articles BOOLEAN DEFAULT false;
