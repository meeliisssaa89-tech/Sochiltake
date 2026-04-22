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
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // ── Verify caller via the bearer access_token from Supabase Auth ──
    const authHeader = req.headers.get('Authorization') || '';
    const accessToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!accessToken) return json({ error: 'Missing access token' }, 401);

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(accessToken);
    if (userErr || !userData?.user?.email) {
      return json({ error: 'Invalid or expired session' }, 401);
    }
    const email = userData.user.email.toLowerCase();

    const admin = createClient(url, serviceKey);

    // ── Allowlist check (or bootstrap the very first admin) ──
    const { data: anyAdmin } = await admin.from('admin_emails').select('email').limit(1);
    const realRows = (anyAdmin || []).filter((r: any) => r.email !== 'change-me@example.com');
    if (realRows.length === 0) {
      // Bootstrap: register the first signed-in Google user as admin
      await admin.from('admin_emails').upsert({ email });
    } else {
      const { data: hit } = await admin
        .from('admin_emails')
        .select('email')
        .eq('email', email)
        .maybeSingle();
      if (!hit) return json({ error: 'Not authorized' }, 403);
    }

    const { action, payload } = await req.json();

    switch (action) {
      case 'whoami': {
        return json({ ok: true, email, isAdmin: true });
      }

      case 'delete_user': {
        const userId = String(payload?.userId || '');
        if (!userId) return json({ error: 'userId required' }, 400);
        const { error } = await admin.from('users').delete().eq('telegram_id', userId);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      case 'set_banned': {
        const userId = String(payload?.userId || '');
        const banned = !!payload?.banned;
        if (!userId) return json({ error: 'userId required' }, 400);
        const { error } = await admin
          .from('users')
          .update({ is_banned: banned })
          .eq('telegram_id', userId);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true, banned });
      }

      case 'adjust_balance': {
        const userId = String(payload?.userId || '');
        const currencyId = String(payload?.currencyId || '');
        const mode = payload?.mode === 'remove' ? 'remove' : 'add';
        const amount = Number(payload?.amount);
        if (!userId || !currencyId || !Number.isFinite(amount) || amount <= 0) {
          return json({ error: 'userId, currencyId and positive amount required' }, 400);
        }
        const { data: bal } = await admin
          .from('balances')
          .select('id, amount')
          .eq('user_id', userId)
          .eq('currency_id', currencyId)
          .maybeSingle();
        if (!bal?.id) {
          if (mode === 'remove') return json({ error: 'No balance row to remove from' }, 400);
          const { error } = await admin
            .from('balances')
            .insert({ user_id: userId, currency_id: currencyId, amount });
          if (error) return json({ error: error.message }, 400);
          return json({ ok: true, newAmount: amount });
        }
        const next = mode === 'add'
          ? Number(bal.amount) + amount
          : Math.max(0, Number(bal.amount) - amount);
        const { error } = await admin.from('balances').update({ amount: next }).eq('id', bal.id);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true, newAmount: next });
      }

      case 'list_admins': {
        const { data } = await admin.from('admin_emails').select('email, created_at').order('created_at');
        return json({ admins: data || [] });
      }

      case 'add_admin': {
        const newEmail = String(payload?.email || '').toLowerCase().trim();
        if (!newEmail || !newEmail.includes('@')) return json({ error: 'Valid email required' }, 400);
        const { error } = await admin.from('admin_emails').upsert({ email: newEmail });
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      case 'remove_admin': {
        const target = String(payload?.email || '').toLowerCase().trim();
        if (!target) return json({ error: 'email required' }, 400);
        if (target === email) return json({ error: 'You cannot remove yourself' }, 400);
        const { error } = await admin.from('admin_emails').delete().eq('email', target);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    console.error('admin-action error', e);
    return json({ error: (e as Error).message || 'Internal error' }, 500);
  }
});
