import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { userId, slotIndex } = await req.json();
    if (!userId || slotIndex === undefined) {
      return new Response(JSON.stringify({ error: 'userId and slotIndex required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Load ads config
    const { data: settingsRows } = await supabase.from('app_settings').select('key, value');
    const settings: Record<string, any> = {};
    (settingsRows || []).forEach((s: any) => { settings[s.key] = s.value; });
    const ads = settings.ads_daily || { daily_count: 10, reward_per_ad: 10, xp_per_ad: 5 };

    if (!ads.enabled && ads.enabled !== undefined) {
      return new Response(JSON.stringify({ error: 'Ads are disabled' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (slotIndex >= ads.daily_count) {
      return new Response(JSON.stringify({ error: 'Daily limit reached' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const today = new Date().toISOString().split('T')[0];

    // Determine reward currency — try configured symbol first, then TON, then first active
    const symbol = settings.reward_currency_symbol || 'TON';
    let currencyId: string | null = null;

    const { data: cur } = await supabase
      .from('currencies')
      .select('id')
      .eq('symbol', symbol)
      .eq('is_active', true)
      .maybeSingle();
    currencyId = cur?.id || null;

    // Fallback: use TON if configured symbol not found
    if (!currencyId && symbol !== 'TON') {
      const { data: tonCur } = await supabase
        .from('currencies')
        .select('id')
        .eq('symbol', 'TON')
        .eq('is_active', true)
        .maybeSingle();
      currencyId = tonCur?.id || null;
    }

    // Final fallback: first active currency
    if (!currencyId) {
      const { data: firstCur } = await supabase
        .from('currencies')
        .select('id')
        .eq('is_active', true)
        .order('id', { ascending: true })
        .limit(1)
        .maybeSingle();
      currencyId = firstCur?.id || null;
    }

    // Insert ad watch (unique per user/date/slot)
    const { error: insertErr } = await supabase.from('ad_watches').insert({
      user_id: userId,
      watch_date: today,
      slot_index: slotIndex,
      reward_amount: ads.reward_per_ad,
      reward_currency_id: currencyId,
      xp_reward: ads.xp_per_ad
    });

    if (insertErr) {
      const isDuplicate = insertErr.message.includes('duplicate') || insertErr.code === '23505';
      return new Response(JSON.stringify({ error: isDuplicate ? 'Slot already claimed' : insertErr.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Credit balance
    if (currencyId && ads.reward_per_ad > 0) {
      const { data: bal } = await supabase
        .from('balances')
        .select('amount')
        .eq('user_id', userId)
        .eq('currency_id', currencyId)
        .maybeSingle();

      const newAmount = Number(bal?.amount || 0) + Number(ads.reward_per_ad);
      await supabase
        .from('balances')
        .upsert(
          { user_id: userId, currency_id: currencyId, amount: newAmount },
          { onConflict: 'user_id,currency_id' }
        );
    }

    // Add XP
    if (ads.xp_per_ad > 0) {
      const { data: u } = await supabase
        .from('users')
        .select('exp')
        .eq('telegram_id', userId)
        .maybeSingle();

      if (u) {
        const newExp = (Number(u.exp) || 0) + Number(ads.xp_per_ad);
        await supabase
          .from('users')
          .update({ exp: newExp, level: Math.floor(newExp / 5000) + 1 })
          .eq('telegram_id', userId);
      }
    }

    // Activity feed
    await supabase.from('activity_feed').insert({
      user_id: userId,
      type: 'ad_watched',
      message: `Ad #${slotIndex + 1} watched`,
      meta: { reward: ads.reward_per_ad, xp: ads.xp_per_ad }
    });

    return new Response(JSON.stringify({ success: true, reward: ads.reward_per_ad, xp: ads.xp_per_ad }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    console.error('watch-ad error', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
