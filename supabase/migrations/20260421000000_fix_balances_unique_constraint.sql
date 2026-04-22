-- Fix duplicate balance rows and add unique constraint
-- This ensures upsert on (user_id, currency_id) works correctly

-- First remove any duplicate rows keeping the one with highest amount
DELETE FROM balances
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, currency_id) id
  FROM balances
  ORDER BY user_id, currency_id, amount DESC
);

-- Add unique constraint so upsert works correctly (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'balances_user_id_currency_id_key'
  ) THEN
    ALTER TABLE balances
      ADD CONSTRAINT balances_user_id_currency_id_key
      UNIQUE (user_id, currency_id);
  END IF;
END $$;
