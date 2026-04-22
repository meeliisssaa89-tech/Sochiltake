-- Migration: protect balances from being accidentally reset to 0
-- Root cause: telegram-auth upserts balances with amount=0 on every login,
-- which overwrites real balances. This trigger prevents that.

CREATE OR REPLACE FUNCTION protect_balance_from_auth_reset()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If old amount is positive and new amount is exactly 0,
  -- this is almost certainly the telegram-auth initialization upsert.
  -- Keep the existing amount instead.
  IF OLD.amount > 0 AND NEW.amount = 0 THEN
    NEW.amount := OLD.amount;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_balance_from_reset ON public.balances;
CREATE TRIGGER trg_protect_balance_from_reset
  BEFORE UPDATE ON public.balances
  FOR EACH ROW
  EXECUTE FUNCTION protect_balance_from_auth_reset();

-- Also create a safe RPC for initializing a user's balance rows
-- (insert only if not exists, never overwrite)
CREATE OR REPLACE FUNCTION safe_init_user_balances(p_user_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur RECORD;
BEGIN
  FOR cur IN SELECT id FROM currencies WHERE is_active = true LOOP
    INSERT INTO balances (user_id, currency_id, amount)
    VALUES (p_user_id, cur.id, 0)
    ON CONFLICT (user_id, currency_id) DO NOTHING;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION safe_init_user_balances(TEXT) TO anon, authenticated, service_role;
