-- code_api: per-visit secure session tokens
CREATE TABLE IF NOT EXISTS public.task_code_sessions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    text NOT NULL,
  task_id    uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  token      text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at    timestamptz
);

CREATE INDEX IF NOT EXISTS task_code_sessions_user_task_idx
  ON public.task_code_sessions (user_id, task_id, created_at DESC);

ALTER TABLE public.task_code_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role only" ON public.task_code_sessions;
CREATE POLICY "service role only" ON public.task_code_sessions
  FOR ALL USING (false) WITH CHECK (false);
