-- Tasks: renewal and global completions counter
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS renewal_hours INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS current_completions INTEGER NOT NULL DEFAULT 0;

-- user_tasks: per-user completion counter (for renewable tasks)
ALTER TABLE public.user_tasks
  ADD COLUMN IF NOT EXISTS completion_count INTEGER NOT NULL DEFAULT 0;

-- Index for efficient renewal queries
CREATE INDEX IF NOT EXISTS idx_user_tasks_completed_at ON public.user_tasks(completed_at)
  WHERE status = 'completed';

-- Pre-seed shortlink binding in app_settings if missing
INSERT INTO public.app_settings (key, value)
VALUES ('ads_shortlink_binding', '"none"')
ON CONFLICT (key) DO NOTHING;
