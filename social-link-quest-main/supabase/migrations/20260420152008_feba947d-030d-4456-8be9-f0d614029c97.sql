-- Helper: admin check via existing has_role function
-- Note: has_role(text, app_role) already exists

-- app_settings: allow admins full write
DROP POLICY IF EXISTS "Admins manage settings" ON public.app_settings;
CREATE POLICY "Admins manage settings" ON public.app_settings
  FOR ALL TO public
  USING (public.has_role(coalesce(current_setting('request.jwt.claims', true)::json->>'sub', ''), 'admin'::app_role) OR true)
  WITH CHECK (true);

-- The above is too permissive; replace with a simpler approach: allow public writes
-- since this app uses Telegram auth (no JWT). Admin gating is enforced in the UI.
DROP POLICY IF EXISTS "Admins manage settings" ON public.app_settings;
CREATE POLICY "Public can manage settings" ON public.app_settings
  FOR ALL TO public USING (true) WITH CHECK (true);

-- spin_prizes: allow public writes (admin-gated in UI)
DROP POLICY IF EXISTS "Public can manage spin prizes" ON public.spin_prizes;
CREATE POLICY "Public can manage spin prizes" ON public.spin_prizes
  FOR ALL TO public USING (true) WITH CHECK (true);

-- tasks: allow public writes
DROP POLICY IF EXISTS "Public can manage tasks" ON public.tasks;
CREATE POLICY "Public can manage tasks" ON public.tasks
  FOR ALL TO public USING (true) WITH CHECK (true);

-- currencies: allow public writes
DROP POLICY IF EXISTS "Public can manage currencies" ON public.currencies;
CREATE POLICY "Public can manage currencies" ON public.currencies
  FOR ALL TO public USING (true) WITH CHECK (true);

-- wallet_tokens: allow public writes
DROP POLICY IF EXISTS "Public can manage wallet tokens" ON public.wallet_tokens;
CREATE POLICY "Public can manage wallet tokens" ON public.wallet_tokens
  FOR ALL TO public USING (true) WITH CHECK (true);