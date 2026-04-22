-- Add 'code_api' task type and supporting columns/tables for external code verification.

-- 1. Extend task_type enum (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'task_type' AND e.enumlabel = 'code_api'
  ) THEN
    ALTER TYPE public.task_type ADD VALUE 'code_api';
  END IF;
END$$;

-- 2. Add columns to tasks for code_api configuration.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS verify_url     text,
  ADD COLUMN IF NOT EXISTS verify_method  text DEFAULT 'POST',
  ADD COLUMN IF NOT EXISTS verify_headers jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS body_template  jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS success_key    text DEFAULT 'success',
  ADD COLUMN IF NOT EXISTS success_value  text DEFAULT 'true',
  ADD COLUMN IF NOT EXISTS max_completions integer,
  ADD COLUMN IF NOT EXISTS user_limit      integer DEFAULT 1;

-- 3. Verification attempts log (each call to the external API).
CREATE TABLE IF NOT EXISTS public.task_code_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    text NOT NULL,
  task_id    uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  code       text NOT NULL,
  status     text NOT NULL,         -- 'success' | 'failed' | 'reused' | 'rate_limited'
  response   jsonb,
  error      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_code_attempts_user_idx ON public.task_code_attempts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS task_code_attempts_task_idx ON public.task_code_attempts (task_id, created_at DESC);

-- Block exact reuse: same task + same code can only succeed once globally.
CREATE UNIQUE INDEX IF NOT EXISTS task_code_attempts_unique_success
  ON public.task_code_attempts (task_id, code)
  WHERE status = 'success';

-- RLS: only service role touches this table.
ALTER TABLE public.task_code_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role all" ON public.task_code_attempts;
CREATE POLICY "service role all" ON public.task_code_attempts FOR ALL USING (false) WITH CHECK (false);
