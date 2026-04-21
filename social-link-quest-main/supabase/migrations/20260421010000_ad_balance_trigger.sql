-- Trigger: auto-credit user balance whenever an ad_watch is inserted
-- Runs as SECURITY DEFINER (database owner) → bypasses RLS completely

-- Add unique constraint on balances(user_id, currency_id) if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'balances_user_id_currency_id_key'
  ) THEN
    ALTER TABLE balances
      ADD CONSTRAINT balances_user_id_currency_id_key
      UNIQUE (user_id, currency_id);
  END IF;
END $$;

-- Trigger function: credits balance after ad_watch insert
CREATE OR REPLACE FUNCTION credit_balance_from_ad_watch()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.reward_currency_id IS NULL OR NEW.reward_amount <= 0 THEN
    RETURN NEW;
  END IF;

  UPDATE balances
  SET amount = amount + NEW.reward_amount
  WHERE user_id = NEW.user_id
    AND currency_id = NEW.reward_currency_id;

  IF NOT FOUND THEN
    INSERT INTO balances (user_id, currency_id, amount)
    VALUES (NEW.user_id, NEW.reward_currency_id, NEW.reward_amount)
    ON CONFLICT (user_id, currency_id)
    DO UPDATE SET amount = balances.amount + EXCLUDED.amount;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger to ad_watches table
DROP TRIGGER IF EXISTS trigger_credit_balance_on_ad_watch ON ad_watches;

CREATE TRIGGER trigger_credit_balance_on_ad_watch
  AFTER INSERT ON ad_watches
  FOR EACH ROW
  EXECUTE FUNCTION credit_balance_from_ad_watch();
