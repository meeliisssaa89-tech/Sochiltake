import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { userId, achievementId } = await req.json();
    if (!userId || !achievementId) {
      return new Response(JSON.stringify({ error: 'userId and achievementId required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Already claimed?
    const { data: existing } = await supabase
      .from('user_achievements')
      .select('id')
      .eq('user_id', userId)
      .eq('achievement_id', achievementId)
      .maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ error: 'Achievement already claimed' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Load achievement definition from app_settings
    const { data: settingRow } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'activity_achievements')
      .maybeSingle();
    const list: any[] = Array.isArray(settingRow?.value) ? settingRow.value : [];
    const ach = list.find((a) => a.id === achievementId && a.is_active !== false);
    if (!ach) {
      return new Response(JSON.stringify({ error: 'Achievement not found or inactive' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Compute current progress for this goal
    const goalType = String(ach.goal_type || '');
    const goalValue = Number(ach.goal_value) || 0;
    let current = 0;

    if (goalType === 'tasks_completed') {
      const { count } = await supabase
        .from('user_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'completed');
      current = count || 0;
    } else if (goalType === 'referrals') {
      const { count } = await supabase
        .from('referrals')
        .select('id', { count: 'exact', head: true })
        .eq('inviter_id', userId);
      current = count || 0;
    } else if (goalType === 'ads_watched') {
      const { count } = await supabase
        .from('ad_watches')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);
      current = count || 0;
    } else if (goalType === 'checkin_streak') {
      const { data: last } = await supabase
        .from('daily_checkins')
        .select('streak_count')
        .eq('user_id', userId)
        .order('check_in_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      current = Number((last as any)?.streak_count) || 0;
    } else if (goalType === 'level') {
      const { data: u } = await supabase
        .from('users')
        .select('level')
        .eq('telegram_id', userId)
        .maybeSingle();
      current = Number((u as any)?.level) || 1;
    } else if (goalType === 'spins') {
      const { count } = await supabase
        .from('spin_history' as any)
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);
      current = count || 0;
    } else if (goalType === 'daily_logins') {
      const { count } = await supabase
        .from('daily_checkins')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);
      current = count || 0;
    }

    if (current < goalValue) {
      return new Response(JSON.stringify({ error: 'Goal not reached', current, required: goalValue }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Resolve reward currency (admin selects by id; fall back to symbol if provided)
    let currencyId: string | null = ach.reward_currency_id || null;
    if (!currencyId && ach.reward_currency_symbol) {
      const { data: cur } = await supabase
        .from('currencies')
        .select('id')
        .ilike('symbol', String(ach.reward_currency_symbol))
        .maybeSingle();
      currencyId = (cur as any)?.id || null;
    }

    const rewardAmount = Number(ach.reward_amount) || 0;
    const xpReward = Number(ach.xp_reward) || 0;

    // Insert claim record FIRST (acts as the lock — unique on user_id+achievement_id)
    const { error: claimErr } = await supabase
      .from('user_achievements')
      .insert({
        user_id: userId,
        achievement_id: achievementId,
        reward_amount: rewardAmount,
        reward_currency_id: currencyId,
        xp_reward: xpReward,
      });
    if (claimErr) {
      const isDup = claimErr.message.includes('duplicate') || claimErr.code === '23505';
      return new Response(JSON.stringify({ error: isDup ? 'Already claimed' : claimErr.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Credit balance
    if (currencyId && rewardAmount > 0) {
      const { data: bal } = await supabase
        .from('balances')
        .select('id, amount')
        .eq('user_id', userId)
        .eq('currency_id', currencyId)
        .maybeSingle();
      if (bal?.id) {
        await supabase
          .from('balances')
          .update({ amount: Number((bal as any).amount) + rewardAmount })
          .eq('id', (bal as any).id);
      } else {
        await supabase
          .from('balances')
          .insert({ user_id: userId, currency_id: currencyId, amount: rewardAmount });
      }
    }

    // Add XP
    if (xpReward > 0) {
      const { data: u } = await supabase
        .from('users')
        .select('exp')
        .eq('telegram_id', userId)
        .maybeSingle();
      if (u) {
        const newExp = (Number((u as any).exp) || 0) + xpReward;
        await supabase
          .from('users')
          .update({ exp: newExp, level: Math.floor(newExp / 5000) + 1 })
          .eq('telegram_id', userId);
      }
    }

    // Activity feed entry
    await supabase.from('activity_feed').insert({
      user_id: userId,
      type: 'achievement_claimed',
      message: `Achievement claimed: ${ach.title_en || ach.title_ar || achievementId}`,
      meta: { reward: rewardAmount, xp: xpReward, achievement_id: achievementId }
    });

    return new Response(JSON.stringify({ success: true, reward: rewardAmount, xp: xpReward }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    console.error('claim-achievement error', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
