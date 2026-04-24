-- Allow tasks to grant rewards in MULTIPLE currencies at once.
-- The primary `reward_amount` + `reward_currency_id` columns continue to work as before
-- (kept for backwards compatibility). `extra_rewards` is a JSONB array of additional
-- rewards in the shape: [{ "currency_id": "<uuid>", "amount": <number> }, ...]
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS extra_rewards jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.tasks.extra_rewards IS
  'Additional rewards granted on completion. Array of { currency_id, amount }.';
