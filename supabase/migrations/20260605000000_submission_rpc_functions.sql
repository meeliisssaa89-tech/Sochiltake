-- ============================================================
-- Submission RPC functions (SECURITY DEFINER – bypass RLS)
-- Run this in Supabase SQL Editor once.
-- ============================================================

-- 1. Allow users to insert pending task rows (for submissions)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_tasks' AND policyname = 'Allow insert user tasks'
  ) THEN
    CREATE POLICY "Allow insert user tasks" ON public.user_tasks
      FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.users WHERE telegram_id = user_id)
      );
  END IF;
END $$;

-- 2. Allow users to update their own pending tasks (resubmit)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_tasks' AND policyname = 'Allow update pending user tasks'
  ) THEN
    CREATE POLICY "Allow update pending user tasks" ON public.user_tasks
      FOR UPDATE USING (status = 'pending') WITH CHECK (status = 'pending');
  END IF;
END $$;

-- 3. submit_task_submission – saves form data without exposing RLS to frontend
CREATE OR REPLACE FUNCTION public.submit_task_submission(
  p_user_id  text,
  p_task_id  uuid,
  p_metadata jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id     uuid;
  v_status text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM tasks WHERE id = p_task_id AND is_active = true) THEN
    RETURN jsonb_build_object('error', 'Task not found or inactive');
  END IF;

  SELECT id, status INTO v_id, v_status
  FROM user_tasks WHERE user_id = p_user_id AND task_id = p_task_id;

  IF v_status = 'completed' THEN
    RETURN jsonb_build_object('error', 'Task already completed');
  END IF;

  IF v_id IS NOT NULL THEN
    UPDATE user_tasks SET
      metadata   = p_metadata,
      status     = 'pending',
      started_at = NOW()
    WHERE id = v_id;
  ELSE
    INSERT INTO user_tasks(user_id, task_id, status, started_at, metadata)
    VALUES (p_user_id, p_task_id, 'pending', NOW(), p_metadata);
  END IF;

  RETURN jsonb_build_object('ok', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- 4. admin_approve_submission – status + balance + XP update
CREATE OR REPLACE FUNCTION public.admin_approve_submission(
  p_user_task_id uuid,
  p_user_id      text,
  p_currency_id  uuid    DEFAULT NULL,
  p_reward_amount numeric DEFAULT 0,
  p_xp_reward    int     DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE user_tasks SET status = 'completed', completed_at = NOW()
  WHERE id = p_user_task_id;

  IF p_reward_amount > 0 AND p_currency_id IS NOT NULL THEN
    INSERT INTO balances(user_id, currency_id, amount)
    VALUES (p_user_id, p_currency_id, p_reward_amount)
    ON CONFLICT (user_id, currency_id)
    DO UPDATE SET amount = balances.amount + p_reward_amount;
  END IF;

  IF p_xp_reward > 0 THEN
    UPDATE users SET exp = COALESCE(exp, 0) + p_xp_reward
    WHERE telegram_id = p_user_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- 5. admin_reject_submission
CREATE OR REPLACE FUNCTION public.admin_reject_submission(
  p_user_task_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE user_tasks SET status = 'rejected'
  WHERE id = p_user_task_id;
  RETURN jsonb_build_object('ok', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;
