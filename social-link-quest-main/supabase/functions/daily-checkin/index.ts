import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_REWARDS = [50, 100, 150, 200, 250, 300, 500];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { userId } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const today = new Date().toISOString().split('T')[0];

    // Already checked in today?
    const { data: todayCheckin } = await supabase
      .from('daily_checkins').select('*')
      .eq('user_id', userId).eq('check_in_date', today).maybeSingle();
    if (todayCheckin) {
      return new Response(JSON.stringify({ error: 'Already checked in today', checkin: todayCheckin }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Calculate streak
    const { data: lastCheckin } = await supabase
      .from('daily_checkins').select('*')
      .eq('user_id', userId).order('check_in_date', { ascending: false }).limit(1).maybeSingle();

    let streakCount = 1;
    if (lastCheckin) {
      const diffDays = Math.floor(
        (new Date(today).getTime() - new Date(lastCheckin.check_in_date).getTime()) / 86400000
      );
      if (diffDays === 1) streakCount = lastCheckin.streak_count + 1;
      else if (diffDays > 1) streakCount = 1;
    }

    // ── Pull admin-configured rewards & currency ─────────────────────
    const { data: settingsRows } = await supabase
      .from('app_settings').select('key, value')
      .in('key', ['checkin_rewards', 'checkin_currency_symbol']);
    const settings: Record<string, any> = {};
    (settingsRows || []).forEach((r: any) => { settings[r.key] = r.value; });

    const rewardDays: number[] =
      Array.isArray(settings.checkin_rewards?.days) ? settings.checkin_rewards.days : DEFAULT_REWARDS;
    const currencySymbol: string = (settings.checkin_currency_symbol || 'TON').toString();

    const streakDay = ((streakCount - 1) % 7) + 1;
    const rewardAmount = Number(rewardDays[streakDay - 1] ?? rewardDays[0] ?? 50);

    // Resolve currency (case-insensitive). Falls back to first active currency.
    const { data: cur } = await supabase
      .from('currencies').select('id, symbol')
      .ilike('symbol', currencySymbol).eq('is_active', true).maybeSingle();
    let currencyId: string | null = cur?.id || null;
    if (!currencyId) {
      const { data: fb } = await supabase
        .from('currencies').select('id').eq('is_active', true)
        .order('created_at', { ascending: true }).limit(1).maybeSingle();
      currencyId = fb?.id || null;
    }

    // Insert checkin
    const { data: checkin, error: checkinError } = await supabase
      .from('daily_checkins').insert({
        user_id: userId, check_in_date: today,
        streak_count: streakCount, reward_amount: rewardAmount, reward_currency_id: currencyId,
      }).select().single();
    if (checkinError) {
      console.error('Checkin error:', checkinError);
      return new Response(JSON.stringify({ error: 'Failed to record check-in' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Credit balance
    if (currencyId) {
      const { data: bal } = await supabase
        .from('balances').select('amount')
        .eq('user_id', userId).eq('currency_id', currencyId).maybeSingle();
      const newAmount = Number(bal?.amount || 0) + rewardAmount;
      await supabase.from('balances').upsert(
        { user_id: userId, currency_id: currencyId, amount: newAmount },
        { onConflict: 'user_id,currency_id' }
      );
    }

    // XP
    const xpReward = streakDay * 5;
    const { data: u } = await supabase.from('users').select('exp, level').eq('telegram_id', userId).single();
    if (u) {
      const newExp = u.exp + xpReward;
      await supabase.from('users')
        .update({ exp: newExp, level: Math.floor(newExp / 5000) + 1 })
        .eq('telegram_id', userId);
    }

    return new Response(
      JSON.stringify({ checkin, reward: rewardAmount, currencySymbol, streak: streakCount, xpReward }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Daily checkin error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
