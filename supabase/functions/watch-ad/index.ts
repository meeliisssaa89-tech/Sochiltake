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

    // Determine reward currency (case-insensitive lookup, with sensible fallback chain)
    const requestedSymbol = String(ads.reward_currency_symbol || 'TON').trim();
    let currencyId: string | null = null;
    let resolvedSymbol: string | null = null;

    // Case-insensitive lookup of the configured symbol
    {
      const { data: cur } = await supabase
        .from('currencies')
        .select('id, symbol, is_active')
        .ilike('symbol', requestedSymbol)
        .limit(1)
        .maybeSingle();
      if (cur?.id) {
        currencyId = cur.id;
        resolvedSymbol = cur.symbol;
        // Auto-activate if needed so user actually sees the balance
        if (cur.is_active === false) {
          await supabase.from('currencies').update({ is_active: true }).eq('id', cur.id);
        }
      }
    }

    // Fallback to TON if requested currency missing
    if (!currencyId && requestedSymbol.toUpperCase() !== 'TON') {
      const { data: tonCur } = await supabase
        .from('currencies')
        .select('id, symbol')
        .ilike('symbol', 'TON')
        .eq('is_active', true)
        .maybeSingle();
      if (tonCur?.id) { currencyId = tonCur.id; resolvedSymbol = tonCur.symbol; }
    }

    // Final fallback: first active currency
    if (!currencyId) {
      const { data: firstCur } = await supabase
        .from('currencies')
        .select('id, symbol')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (firstCur?.id) { currencyId = firstCur.id; resolvedSymbol = firstCur.symbol; }
    }

    if (!currencyId) {
      return new Response(JSON.stringify({ error: 'No active currency configured' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const bulkMode = !!ads.bulk_reward_mode;
    const isLastSlot = slotIndex === (ads.daily_count - 1);
    // In bulk mode: reward=0 per slot, credit completion_reward only on last slot
    const reward = bulkMode
      ? (isLastSlot ? (Number(ads.completion_reward) || Number(ads.reward_per_ad) || 0) : 0)
      : (Number(ads.reward_per_ad) || 0);
    const xp = Number(ads.xp_per_ad) || 0;

    // Insert ad watch (unique per user/date/slot).
    // NOTE: a DB trigger (credit_balance_from_ad_watch) automatically credits
    // the user's balance after this insert succeeds — do NOT credit again here
    // or users will be paid double.
    const { error: insertErr } = await supabase.from('ad_watches').insert({
      user_id: userId,
      watch_date: today,
      slot_index: slotIndex,
      reward_amount: reward,
      reward_currency_id: currencyId,
      xp_reward: xp
    });

    if (insertErr) {
      const isDuplicate = insertErr.message.includes('duplicate') || insertErr.code === '23505';
      return new Response(JSON.stringify({ error: isDuplicate ? 'Slot already claimed' : insertErr.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Safety net: if for some reason the trigger didn't credit (e.g. removed),
    // ensure the balance row exists. Using ON CONFLICT DO NOTHING so we never
    // double-credit when the trigger already ran.
    if (reward > 0) {
      await supabase
        .from('balances')
        .upsert(
          { user_id: userId, currency_id: currencyId, amount: 0 },
          { onConflict: 'user_id,currency_id', ignoreDuplicates: true }
        );
    }

    // Add XP
    if (xp > 0) {
      const { data: u } = await supabase
        .from('users')
        .select('exp')
        .eq('telegram_id', userId)
        .maybeSingle();

      if (u) {
        const newExp = (Number(u.exp) || 0) + xp;
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
      message: bulkMode && isLastSlot ? 'All ads completed — reward earned!' : `Ad #${slotIndex + 1} watched`,
      meta: { reward, xp, symbol: resolvedSymbol }
    });

    return new Response(JSON.stringify({ success: true, reward, xp, symbol: resolvedSymbol }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    console.error('watch-ad error', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
