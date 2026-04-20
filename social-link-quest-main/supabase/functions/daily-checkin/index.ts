import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get today's date in UTC
    const today = new Date().toISOString().split('T')[0];

    // Check if already checked in today
    const { data: todayCheckin } = await supabase
      .from('daily_checkins')
      .select('*')
      .eq('user_id', userId)
      .eq('check_in_date', today)
      .single();

    if (todayCheckin) {
      return new Response(
        JSON.stringify({ error: 'Already checked in today', checkin: todayCheckin }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the most recent checkin to calculate streak
    const { data: lastCheckin } = await supabase
      .from('daily_checkins')
      .select('*')
      .eq('user_id', userId)
      .order('check_in_date', { ascending: false })
      .limit(1)
      .single();

    let streakCount = 1;

    if (lastCheckin) {
      const lastDate = new Date(lastCheckin.check_in_date);
      const todayDate = new Date(today);
      const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        // Consecutive day
        streakCount = lastCheckin.streak_count + 1;
      } else if (diffDays > 1) {
        // Streak broken
        streakCount = 1;
      }
    }

    // Reward scales with streak (capped at 7 for cycle, then repeats)
    const streakDay = ((streakCount - 1) % 7) + 1;
    const rewardTable: Record<number, number> = { 1: 50, 2: 100, 3: 150, 4: 200, 5: 250, 6: 300, 7: 500 };
    const rewardAmount = rewardTable[streakDay] || 50;

    // Get TON currency
    const { data: tonCur } = await supabase
      .from('currencies')
      .select('id')
      .eq('symbol', 'TON')
      .eq('is_active', true)
      .maybeSingle();

    // Fallback to first active currency if TON not found
    let currencyId = tonCur?.id || null;
    if (!currencyId) {
      const { data: fallbackCur } = await supabase
        .from('currencies')
        .select('id')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      currencyId = fallbackCur?.id || null;
    }

    // Insert checkin record
    const { data: checkin, error: checkinError } = await supabase
      .from('daily_checkins')
      .insert({
        user_id: userId,
        check_in_date: today,
        streak_count: streakCount,
        reward_amount: rewardAmount,
        reward_currency_id: currencyId,
      })
      .select()
      .single();

    if (checkinError) {
      console.error('Checkin error:', checkinError);
      return new Response(
        JSON.stringify({ error: 'Failed to record check-in' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update user balance
    if (currencyId) {
      const { data: balance } = await supabase
        .from('balances')
        .select('amount')
        .eq('user_id', userId)
        .eq('currency_id', currencyId)
        .maybeSingle();

      const newAmount = Number(balance?.amount || 0) + Number(rewardAmount);
      await supabase
        .from('balances')
        .upsert(
          { user_id: userId, currency_id: currencyId, amount: newAmount },
          { onConflict: 'user_id,currency_id' }
        );
    }

    // Grant XP
    const xpReward = streakDay * 5;
    const { data: userData } = await supabase
      .from('users')
      .select('exp, level')
      .eq('telegram_id', userId)
      .single();

    if (userData) {
      const newExp = userData.exp + xpReward;
      const newLevel = Math.floor(newExp / 5000) + 1;
      await supabase
        .from('users')
        .update({ exp: newExp, level: newLevel })
        .eq('telegram_id', userId);
    }

    return new Response(
      JSON.stringify({
        checkin,
        reward: rewardAmount,
        streak: streakCount,
        xpReward,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Daily checkin error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
