-- =====================================================================
-- Admin authentication & user-management hardening:
--   * admin_emails allowlist (Supabase Google OAuth gate)
--   * keep direct user mutations blocked from anon (we now go through
--     the secured `admin-action` edge function which uses the service
--     role *after* verifying the caller is an allow-listed admin).
--   * Make sure the achievement claim path can succeed even when the
--     achievement reward currency reference is stale (set to NULL).
-- =====================================================================

-- 1) Admin allowlist ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_emails (
  email      text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_emails read for everyone" ON public.admin_emails;
CREATE POLICY "admin_emails read for everyone"
  ON public.admin_emails FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "admin_emails service role manages" ON public.admin_emails;
CREATE POLICY "admin_emails service role manages"
  ON public.admin_emails FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Seed slot — replace this email from the SQL editor or via the
-- admin-action invite endpoint. If no admins exist yet, the very first
-- Google sign-in self-registers (handled in the edge function).
INSERT INTO public.admin_emails (email) VALUES ('change-me@example.com')
ON CONFLICT DO NOTHING;

-- 2) Sanity check on the achievement reward currency -------------------
-- When admins delete a currency, dangling reward_currency_id refs in
-- the activity_achievements JSON could break the claim. Nothing to do
-- in SQL for JSON, but we guarantee the FK in user_achievements is
-- nullable so the claim insert never fails for that reason.
ALTER TABLE public.user_achievements
  ALTER COLUMN reward_currency_id DROP NOT NULL;
