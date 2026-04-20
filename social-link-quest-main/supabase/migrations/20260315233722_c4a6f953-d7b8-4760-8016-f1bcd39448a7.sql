
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.task_type AS ENUM ('telegram_join', 'watch_ad', 'social_link');
CREATE TYPE public.task_status AS ENUM ('pending', 'completed');

CREATE TABLE public.users (
  telegram_id TEXT PRIMARY KEY,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  photo_url TEXT,
  level INTEGER NOT NULL DEFAULT 1,
  exp INTEGER NOT NULL DEFAULT 0,
  language TEXT NOT NULL DEFAULT 'en',
  is_banned BOOLEAN NOT NULL DEFAULT false,
  referred_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.users(telegram_id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

CREATE TABLE public.currencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_ar TEXT,
  icon_url TEXT,
  decimals INTEGER NOT NULL DEFAULT 0,
  exchange_rate NUMERIC NOT NULL DEFAULT 1.0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.users(telegram_id) ON DELETE CASCADE,
  currency_id UUID NOT NULL REFERENCES public.currencies(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  UNIQUE(user_id, currency_id)
);

CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_en TEXT NOT NULL,
  title_ar TEXT,
  description_en TEXT,
  description_ar TEXT,
  type task_type NOT NULL,
  reward_amount NUMERIC NOT NULL DEFAULT 0,
  reward_currency_id UUID REFERENCES public.currencies(id),
  xp_reward INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_required BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.users(telegram_id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  status task_status NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, task_id)
);

CREATE TABLE public.daily_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.users(telegram_id) ON DELETE CASCADE,
  check_in_date DATE NOT NULL DEFAULT CURRENT_DATE,
  streak_count INTEGER NOT NULL DEFAULT 1,
  reward_amount NUMERIC NOT NULL DEFAULT 0,
  reward_currency_id UUID REFERENCES public.currencies(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, check_in_date)
);

CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id TEXT NOT NULL REFERENCES public.users(telegram_id) ON DELETE CASCADE,
  invitee_id TEXT NOT NULL REFERENCES public.users(telegram_id) ON DELETE CASCADE,
  reward_granted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(invitee_id)
);

CREATE TABLE public.social_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.users(telegram_id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  account_id TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, platform)
);

CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.users(telegram_id) ON DELETE CASCADE,
  currency_id UUID NOT NULL REFERENCES public.currencies(id),
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  wallet_address TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id TEXT, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users are viewable by all" ON public.users FOR SELECT USING (true);
CREATE POLICY "Service role can manage users" ON public.users FOR ALL TO service_role USING (true);

CREATE POLICY "Service role manages roles" ON public.user_roles FOR ALL TO service_role USING (true);

CREATE POLICY "Currencies viewable by all" ON public.currencies FOR SELECT USING (true);
CREATE POLICY "Service role manages currencies" ON public.currencies FOR ALL TO service_role USING (true);

CREATE POLICY "Balances viewable by all" ON public.balances FOR SELECT USING (true);
CREATE POLICY "Service role manages balances" ON public.balances FOR ALL TO service_role USING (true);

CREATE POLICY "Active tasks viewable by all" ON public.tasks FOR SELECT USING (is_active = true);
CREATE POLICY "Service role manages tasks" ON public.tasks FOR ALL TO service_role USING (true);

CREATE POLICY "User tasks viewable by all" ON public.user_tasks FOR SELECT USING (true);
CREATE POLICY "Service role manages user tasks" ON public.user_tasks FOR ALL TO service_role USING (true);

CREATE POLICY "Checkins viewable by all" ON public.daily_checkins FOR SELECT USING (true);
CREATE POLICY "Service role manages checkins" ON public.daily_checkins FOR ALL TO service_role USING (true);

CREATE POLICY "Referrals viewable by all" ON public.referrals FOR SELECT USING (true);
CREATE POLICY "Service role manages referrals" ON public.referrals FOR ALL TO service_role USING (true);

CREATE POLICY "Social links viewable" ON public.social_links FOR SELECT USING (true);
CREATE POLICY "Service role manages social links" ON public.social_links FOR ALL TO service_role USING (true);

CREATE POLICY "Settings viewable by all" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Service role manages settings" ON public.app_settings FOR ALL TO service_role USING (true);

CREATE POLICY "Withdrawals viewable" ON public.withdrawals FOR SELECT USING (true);
CREATE POLICY "Service role manages withdrawals" ON public.withdrawals FOR ALL TO service_role USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_app_settings_updated_at BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_balances_user ON public.balances(user_id);
CREATE INDEX idx_user_tasks_user ON public.user_tasks(user_id);
CREATE INDEX idx_user_tasks_task ON public.user_tasks(task_id);
CREATE INDEX idx_daily_checkins_user ON public.daily_checkins(user_id);
CREATE INDEX idx_referrals_inviter ON public.referrals(inviter_id);
CREATE INDEX idx_social_links_user ON public.social_links(user_id);
CREATE INDEX idx_withdrawals_user ON public.withdrawals(user_id);
