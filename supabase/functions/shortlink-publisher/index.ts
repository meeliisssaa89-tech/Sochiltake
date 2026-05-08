// Edge function called from the Telegram Mini App (publisher section).
// Actions:
//   - link_code     : link a telegram_id to a publisher account using the link code.
//   - unlink        : unlink the current telegram_id.
//   - me_stats      : return publisher info, articles, visit breakdown, country breakdown, earnings.
//   - request_payout: convert pending_balance into a Telegram-balance payout request.
//
// The features stay disabled until admin enables them in the panel
// (shortlink_settings.publishers_enabled / payouts_enabled).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Shortlink DB (separate project — all shortlink_* tables live here)
    const slUrl = Deno.env.get('SHORTLINK_DB_URL') || url;
    const slKey = Deno.env.get('SHORTLINK_DB_SERVICE_KEY') || serviceKey;
    const slAdmin = createClient(slUrl, slKey);

    const { action, payload } = await req.json();
    const p = payload || {};

    // Always load settings — we need the feature flags.
    const { data: settings } = await slAdmin
      .from('shortlink_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    const publishersEnabled = !!settings?.publishers_enabled;
    const payoutsEnabled = !!settings?.payouts_enabled;

    // Public status — no gating. Lets the Telegram UI know whether to show
    // the publisher card at all.
    if (action === 'status') {
      return json({
        publishers_enabled: publishersEnabled,
        payouts_enabled: payoutsEnabled,
        signup_enabled: !!settings?.signup_enabled,
        site_url: settings?.site_url || null,
        min_payout: Number(settings?.min_payout || 0),
        payout_currency_id: settings?.payout_currency_id || null,
        revenue_per_visit: Number(settings?.revenue_per_visit || 0),
      });
    }

    // Every other action requires the program to be active.
    if (!publishersEnabled) {
      return json({ error: 'Publisher program is not active yet.' }, 403);
    }

    switch (action) {
      case 'link_code': {
        const telegramId = String(p.telegram_id || '').trim();
        const code = String(p.code || '').trim();
        if (!telegramId || !code) return json({ error: 'telegram_id and code required' }, 400);

        const { data: pub } = await slAdmin
          .from('shortlink_publishers')
          .select('*')
          .eq('link_code', code)
          .maybeSingle();
        if (!pub) return json({ error: 'Invalid code' }, 404);
        if (pub.is_blocked) return json({ error: 'This account is blocked.' }, 403);
        if (pub.linked_telegram_id && pub.linked_telegram_id !== telegramId) {
          return json({ error: 'This code is already linked to a different account.' }, 400);
        }

        // Check this telegram_id isn't already linked to another publisher
        const { data: existing } = await slAdmin
          .from('shortlink_publishers')
          .select('id, email')
          .eq('linked_telegram_id', telegramId)
          .neq('id', pub.id)
          .maybeSingle();
        if (existing) {
          return json({ error: `You're already linked to ${existing.email}. Unlink first.` }, 400);
        }

        await slAdmin
          .from('shortlink_publishers')
          .update({ linked_telegram_id: telegramId, linked_at: new Date().toISOString() })
          .eq('id', pub.id);

        return json({ ok: true, publisher_id: pub.id });
      }

      case 'unlink': {
        const telegramId = String(p.telegram_id || '').trim();
        if (!telegramId) return json({ error: 'telegram_id required' }, 400);
        await slAdmin
          .from('shortlink_publishers')
          .update({ linked_telegram_id: null, linked_at: null })
          .eq('linked_telegram_id', telegramId);
        return json({ ok: true });
      }

      case 'me_stats': {
        const telegramId = String(p.telegram_id || '').trim();
        if (!telegramId) return json({ error: 'telegram_id required' }, 400);

        const { data: pub } = await slAdmin
          .from('shortlink_publishers')
          .select('id, email, display_name, link_code, pending_balance, lifetime_earnings, total_visits, is_blocked, created_at')
          .eq('linked_telegram_id', telegramId)
          .maybeSingle();
        if (!pub) return json({ linked: false });

        const { data: articles } = await slAdmin
          .from('shortlink_pub_articles')
          .select('id, slug, title, status, visit_count, earnings, created_at, rejection_reason')
          .eq('publisher_id', pub.id)
          .order('created_at', { ascending: false })
          .limit(100);

        // Country breakdown
        const { data: visits } = await slAdmin
          .from('shortlink_pub_visits')
          .select('country')
          .eq('publisher_id', pub.id)
          .limit(5000);

        const countries: Record<string, number> = {};
        for (const v of visits || []) {
          const c = (v.country || 'XX').toUpperCase();
          countries[c] = (countries[c] || 0) + 1;
        }
        const countryList = Object.entries(countries)
          .map(([code, count]) => ({ code, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 20);

        const { data: payouts } = await slAdmin
          .from('shortlink_payouts')
          .select('id, amount, status, requested_at, processed_at')
          .eq('publisher_id', pub.id)
          .order('requested_at', { ascending: false })
          .limit(20);

        return json({
          linked: true,
          publisher: pub,
          articles: articles || [],
          countries: countryList,
          payouts: payouts || [],
          payouts_enabled: payoutsEnabled,
          min_payout: Number(settings?.min_payout || 1),
          site_url: settings?.site_url || null,
        });
      }

      case 'request_payout': {
        if (!payoutsEnabled) return json({ error: 'Payouts are temporarily disabled.' }, 403);
        const telegramId = String(p.telegram_id || '').trim();
        const amount = Number(p.amount);
        if (!telegramId || !Number.isFinite(amount) || amount <= 0) {
          return json({ error: 'telegram_id and positive amount required' }, 400);
        }

        const minPayout = Number(settings?.min_payout || 1);
        if (amount < minPayout) {
          return json({ error: `Minimum payout is ${minPayout}` }, 400);
        }

        const { data: pub } = await slAdmin
          .from('shortlink_publishers')
          .select('id, pending_balance, is_blocked')
          .eq('linked_telegram_id', telegramId)
          .maybeSingle();
        if (!pub) return json({ error: 'No publisher account linked.' }, 404);
        if (pub.is_blocked) return json({ error: 'Account blocked.' }, 403);
        if (Number(pub.pending_balance) < amount) {
          return json({ error: 'Insufficient balance.' }, 400);
        }

        // Reserve the amount immediately by deducting from pending_balance.
        const newBal = Number(pub.pending_balance) - amount;
        const { error: updErr } = await slAdmin
          .from('shortlink_publishers')
          .update({ pending_balance: newBal })
          .eq('id', pub.id);
        if (updErr) return json({ error: updErr.message }, 400);

        const { error: payErr } = await slAdmin.from('shortlink_payouts').insert({
          publisher_id: pub.id,
          telegram_id: telegramId,
          amount,
          currency_id: settings?.payout_currency_id || null,
          status: 'pending',
        });
        if (payErr) {
          // Rollback the deduction if insert failed.
          await slAdmin
            .from('shortlink_publishers')
            .update({ pending_balance: Number(pub.pending_balance) })
            .eq('id', pub.id);
          return json({ error: payErr.message }, 400);
        }

        return json({ ok: true, new_balance: newBal });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    console.error('shortlink-publisher error', e);
    return json({ error: (e as Error).message || 'Internal error' }, 500);
  }
});
