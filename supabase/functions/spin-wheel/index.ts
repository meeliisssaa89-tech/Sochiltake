// Spin wheel — picks a weighted random prize and awards it
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const { userId } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Get spin config
    const { data: cfg } = await supabase.from('app_settings').select('value').eq('key', 'spin_config').maybeSingle();
    const config = (cfg?.value as any) || { enabled: true, free_spins_per_day: 3, cost_per_spin: 0 };
    if (!config.enabled) {
      return new Response(JSON.stringify({ error: 'Spin disabled' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check daily spins
    const today = new Date().toISOString().split('T')[0];
    const { count: spinsToday } = await supabase
      .from('spin_history')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('spin_date', today);

    if ((spinsToday || 0) >= (config.free_spins_per_day || 3)) {
      return new Response(JSON.stringify({ error: 'No spins left today' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get active prizes
    const { data: prizes } = await supabase.from('spin_prizes').select('*').eq('is_active', true).order('sort_order');
    if (!prizes || prizes.length === 0) {
      return new Response(JSON.stringify({ error: 'No prizes configured' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Weighted random pick
    const totalWeight = prizes.reduce((s: number, p: any) => s + (p.weight || 1), 0);
    let r = Math.random() * totalWeight;
    let chosen: any = prizes[0];
    for (const p of prizes) {
      r -= (p.weight || 1);
      if (r <= 0) { chosen = p; break; }
    }

    // Resolve currency: if prize has currency_id, use it, else use TON
    let currencyId = chosen.currency_id;
    if (!currencyId) {
      const { data: tonCur } = await supabase.from('currencies').select('id').eq('symbol', 'TON').eq('is_active', true).maybeSingle();
      currencyId = tonCur?.id;
      // Fallback to first active currency
      if (!currencyId) {
        const { data: fallbackCur } = await supabase.from('currencies').select('id').eq('is_active', true).order('id', { ascending: true }).limit(1).maybeSingle();
        currencyId = fallbackCur?.id;
      }
    }

    // Credit balance
    if (currencyId && chosen.amount > 0) {
      const { data: bal } = await supabase.from('balances').select('amount').eq('user_id', userId).eq('currency_id', currencyId).maybeSingle();
      const newAmount = Number(bal?.amount || 0) + Number(chosen.amount);
      await supabase.from('balances').upsert({ user_id: userId, currency_id: currencyId, amount: newAmount }, { onConflict: 'user_id,currency_id' });
    }

    // XP
    if (chosen.xp_reward > 0) {
      const { data: u } = await supabase.from('users').select('exp').eq('telegram_id', userId).maybeSingle();
      await supabase.from('users').update({ exp: (u?.exp || 0) + chosen.xp_reward }).eq('telegram_id', userId);
    }

    // History
    await supabase.from('spin_history').insert({ user_id: userId, prize_id: chosen.id, amount: chosen.amount, currency_id: currencyId });

    // Activity
    await supabase.from('activity_feed').insert({ user_id: userId, type: 'spin', message: `Won ${chosen.label}`, meta: { prize_id: chosen.id } });

    return new Response(JSON.stringify({ prize: chosen, spinsLeft: (config.free_spins_per_day || 3) - (spinsToday || 0) - 1 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('spin error', e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
