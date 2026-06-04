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

    // ── DB2: shortlink database (separate Supabase project for egress isolation) ──
    const slUrl = Deno.env.get('SHORTLINK_DB_URL') || url;
    const slKey = Deno.env.get('SHORTLINK_DB_SERVICE_KEY') || serviceKey;

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
    // shortlink admin client points to DB2
    const slAdmin = createClient(slUrl, slKey);

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


      case 'approve_submission': {
        const { userTaskId, userId, currencyId, rewardAmount, xpReward } = payload || {};
        if (!userTaskId) return json({ error: 'userTaskId required' }, 400);
        const { error: updErr } = await admin
          .from('user_tasks')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', userTaskId);
        if (updErr) return json({ error: updErr.message }, 400);
        // Credit balance
        if (currencyId && Number(rewardAmount) > 0) {
          const { data: bal } = await admin.from('balances').select('id, amount').eq('user_id', userId).eq('currency_id', currencyId).maybeSingle();
          if (bal?.id) {
            await admin.from('balances').update({ amount: Number(bal.amount) + Number(rewardAmount) }).eq('id', bal.id);
          } else {
            await admin.from('balances').insert({ user_id: userId, currency_id: currencyId, amount: Number(rewardAmount) });
          }
        }
        // Add XP
        if (Number(xpReward) > 0) {
          const { data: u } = await admin.from('users').select('exp').eq('telegram_id', userId).maybeSingle();
          if (u) {
            const newExp = (Number(u.exp) || 0) + Number(xpReward);
            await admin.from('users').update({ exp: newExp, level: Math.floor(newExp / 5000) + 1 }).eq('telegram_id', userId);
          }
        }
        // Activity feed
        await admin.from('activity_feed').insert({ user_id: userId, type: 'task_completion', message: 'Submission approved', meta: { reward: rewardAmount } }).catch(() => {});
        return json({ ok: true });
      }

      case 'reject_submission': {
        const { userTaskId } = payload || {};
        if (!userTaskId) return json({ error: 'userTaskId required' }, 400);
        const { error } = await admin
          .from('user_tasks')
          .update({ status: 'rejected', metadata: { rejected_at: new Date().toISOString() } })
          .eq('id', userTaskId);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
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

      // ====== Shortlink site admin actions =====================================
      // Everything is namespaced `shortlink_*` so it stays separated from the main
      // app's controls and cannot accidentally affect the existing features.

      case 'shortlink_get_settings': {
        const { data } = await slAdmin.from('shortlink_settings').select('*').eq('id', 1).maybeSingle();
        if (!data) {
          await slAdmin.from('shortlink_settings').insert({ id: 1 });
          const { data: fresh } = await slAdmin.from('shortlink_settings').select('*').eq('id', 1).maybeSingle();
          return json({ settings: fresh || {} });
        }
        return json({ settings: data });
      }

      case 'shortlink_save_settings': {
        const allowed = [
          'page_count', 'wait_seconds',
          'ai_provider', 'ai_api_key', 'ai_model', 'ai_image_model', 'ai_topics', 'ai_language',
          'site_title', 'brand_color', 'site_url',
          'ad_head_html', 'ad_top_html', 'ad_middle_html', 'ad_bottom_html', 'ad_interstitial_html',
          'publishers_enabled', 'payouts_enabled', 'signup_enabled', 'articles_require_approval',
          'revenue_per_visit', 'min_payout', 'payout_currency_id', 'signup_bonus',
        ];
        const update: Record<string, unknown> = {};
        for (const k of allowed) {
          if (payload && Object.prototype.hasOwnProperty.call(payload, k)) {
            update[k] = (payload as any)[k];
          }
        }
        if (Object.keys(update).length === 0) return json({ ok: true });
        update.updated_at = new Date().toISOString();
        const { error } = await slAdmin.from('shortlink_settings').update(update).eq('id', 1);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      case 'shortlink_list_publishers': {
        const { data, error } = await slAdmin
          .from('shortlink_publishers')
          .select('id, email, display_name, link_code, linked_telegram_id, pending_balance, lifetime_earnings, total_visits, is_blocked, created_at, linked_at')
          .order('created_at', { ascending: false })
          .limit(500);
        if (error) return json({ error: error.message }, 400);
        return json({ publishers: data || [] });
      }

      case 'shortlink_set_publisher_blocked': {
        const id = String(payload?.id || '');
        const blocked = !!payload?.blocked;
        if (!id) return json({ error: 'id required' }, 400);
        const { error } = await slAdmin
          .from('shortlink_publishers')
          .update({ is_blocked: blocked })
          .eq('id', id);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      case 'shortlink_delete_publisher': {
        const id = String(payload?.id || '');
        if (!id) return json({ error: 'id required' }, 400);
        const { error } = await slAdmin.from('shortlink_publishers').delete().eq('id', id);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      case 'shortlink_unlink_publisher': {
        const id = String(payload?.id || '');
        if (!id) return json({ error: 'id required' }, 400);
        const { error } = await slAdmin
          .from('shortlink_publishers')
          .update({ linked_telegram_id: null, linked_at: null })
          .eq('id', id);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      case 'shortlink_list_articles': {
        const status = String(payload?.status || '');
        let q = slAdmin
          .from('shortlink_pub_articles')
          .select('*, shortlink_publishers!inner(email, display_name, linked_telegram_id)')
          .order('created_at', { ascending: false })
          .limit(500);
        if (status) q = q.eq('status', status);
        const { data, error } = await q;
        if (error) return json({ error: error.message }, 400);
        return json({ articles: data || [] });
      }

      case 'shortlink_set_article_status': {
        const id = String(payload?.id || '');
        const status = String(payload?.status || '');
        const reason = payload?.reason ? String(payload.reason) : null;
        if (!id || !['pending', 'approved', 'rejected'].includes(status)) {
          return json({ error: 'id and valid status required' }, 400);
        }
        const { error } = await slAdmin
          .from('shortlink_pub_articles')
          .update({
            status,
            rejection_reason: status === 'rejected' ? reason : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      case 'shortlink_delete_article': {
        const id = String(payload?.id || '');
        if (!id) return json({ error: 'id required' }, 400);
        const { error } = await slAdmin.from('shortlink_pub_articles').delete().eq('id', id);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      case 'shortlink_list_payouts': {
        const status = String(payload?.status || '');
        let q = slAdmin
          .from('shortlink_payouts')
          .select('*, shortlink_publishers!inner(email, display_name)')
          .order('requested_at', { ascending: false })
          .limit(500);
        if (status) q = q.eq('status', status);
        const { data, error } = await q;
        if (error) return json({ error: error.message }, 400);
        // Enrich with currency info from main DB
        const payouts = data || [];
        const currencyIds = [...new Set(payouts.map((p: any) => p.currency_id).filter(Boolean))];
        let currencyMap: Record<string, any> = {};
        if (currencyIds.length > 0) {
          const { data: currencies } = await admin
            .from('currencies')
            .select('id, symbol, name, icon_url')
            .in('id', currencyIds);
          for (const c of currencies || []) currencyMap[c.id] = c;
        }
        const enriched = payouts.map((p: any) => ({ ...p, currencies: currencyMap[p.currency_id] || null }));
        return json({ payouts: enriched });
      }

      case 'shortlink_approve_payout': {
        const id = String(payload?.id || '');
        if (!id) return json({ error: 'id required' }, 400);

        // Load the payout from shortlink DB
        const { data: pay } = await slAdmin
          .from('shortlink_payouts')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        if (!pay) return json({ error: 'Payout not found' }, 404);
        if (pay.status !== 'pending') return json({ error: `Already ${pay.status}` }, 400);

        // Load settings from shortlink DB to find the payout currency
        const { data: sl } = await slAdmin
          .from('shortlink_settings')
          .select('payout_currency_id')
          .eq('id', 1)
          .maybeSingle();
        const currencyId = pay.currency_id || sl?.payout_currency_id;
        if (!currencyId) {
          return json({ error: 'Payout currency not configured' }, 400);
        }

        // Credit the user's main app balance (main DB)
        const { data: bal } = await admin
          .from('balances')
          .select('id, amount')
          .eq('user_id', pay.telegram_id)
          .eq('currency_id', currencyId)
          .maybeSingle();

        const addAmount = Number(pay.amount);
        if (bal?.id) {
          const { error: e1 } = await admin
            .from('balances')
            .update({ amount: Number(bal.amount) + addAmount })
            .eq('id', bal.id);
          if (e1) return json({ error: e1.message }, 400);
        } else {
          const { error: e2 } = await admin
            .from('balances')
            .insert({ user_id: pay.telegram_id, currency_id: currencyId, amount: addAmount });
          if (e2) return json({ error: e2.message }, 400);
        }

        // Bump publisher's lifetime_earnings in shortlink DB
        const { data: pub2 } = await slAdmin
          .from('shortlink_publishers')
          .select('lifetime_earnings')
          .eq('id', pay.publisher_id)
          .maybeSingle();
        if (pub2) {
          await slAdmin
            .from('shortlink_publishers')
            .update({ lifetime_earnings: Number(pub2.lifetime_earnings || 0) + addAmount })
            .eq('id', pay.publisher_id);
        }

        // Mark payout as approved in shortlink DB
        const { error: e3 } = await slAdmin
          .from('shortlink_payouts')
          .update({
            status: 'approved',
            currency_id: currencyId,
            processed_at: new Date().toISOString(),
            admin_note: payload?.note ? String(payload.note) : null,
          })
          .eq('id', id);
        if (e3) return json({ error: e3.message }, 400);

        return json({ ok: true });
      }

      case 'shortlink_reject_payout': {
        const id = String(payload?.id || '');
        if (!id) return json({ error: 'id required' }, 400);

        const { data: pay } = await slAdmin
          .from('shortlink_payouts')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        if (!pay) return json({ error: 'Payout not found' }, 404);
        if (pay.status !== 'pending') return json({ error: `Already ${pay.status}` }, 400);

        // Refund the publisher's pending_balance in shortlink DB
        const { data: pub3 } = await slAdmin
          .from('shortlink_publishers')
          .select('pending_balance')
          .eq('id', pay.publisher_id)
          .maybeSingle();
        if (pub3) {
          await slAdmin
            .from('shortlink_publishers')
            .update({ pending_balance: Number(pub3.pending_balance || 0) + Number(pay.amount) })
            .eq('id', pay.publisher_id);
        }

        const { error } = await slAdmin
          .from('shortlink_payouts')
          .update({
            status: 'rejected',
            processed_at: new Date().toISOString(),
            admin_note: payload?.note ? String(payload.note) : null,
          })
          .eq('id', id);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      case 'shortlink_stats': {
        const [pubsTotal, pubsLinked, articlesTotal, articlesPending, visits, payoutsPending, payoutsPaidSum] = await Promise.all([
          slAdmin.from('shortlink_publishers').select('id', { count: 'exact', head: true }),
          slAdmin.from('shortlink_publishers').select('id', { count: 'exact', head: true }).not('linked_telegram_id', 'is', null),
          slAdmin.from('shortlink_pub_articles').select('id', { count: 'exact', head: true }),
          slAdmin.from('shortlink_pub_articles').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          slAdmin.from('shortlink_pub_visits').select('id', { count: 'exact', head: true }),
          slAdmin.from('shortlink_payouts').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          slAdmin.from('shortlink_payouts').select('amount').eq('status', 'approved'),
        ]);
        const paidSum = (payoutsPaidSum.data || []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
        return json({
          stats: {
            publishers_total: pubsTotal.count || 0,
            publishers_linked: pubsLinked.count || 0,
            articles_total: articlesTotal.count || 0,
            articles_pending: articlesPending.count || 0,
            visits_total: visits.count || 0,
            payouts_pending: payoutsPending.count || 0,
            payouts_paid_total: paidSum,
          },
        });
      }

      // ── AI models management (multiple providers) ──
      case 'shortlink_list_ai_models': {
        const { data } = await slAdmin
          .from('shortlink_ai_models')
          .select('id, provider, display_name, model, base_url, language, is_default, is_active, sort_order, created_at')
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true });
        return json({ models: data || [] });
      }

      case 'shortlink_save_ai_model': {
        const p = (payload || {}) as Record<string, unknown>;
        const id = p.id ? String(p.id) : null;
        const fields: Record<string, unknown> = {
          provider: String(p.provider || 'openai').toLowerCase().trim(),
          display_name: String(p.display_name || '').trim(),
          model: String(p.model || '').trim(),
          base_url: p.base_url ? String(p.base_url).trim() : null,
          language: String(p.language || 'ar').trim(),
          is_default: !!p.is_default,
          is_active: p.is_active === undefined ? true : !!p.is_active,
          sort_order: Number(p.sort_order || 0),
          updated_at: new Date().toISOString(),
        };
        if (!fields.display_name || !fields.model) {
          return json({ error: 'display_name and model are required' }, 400);
        }
        // Only set api_key if provided (to allow editing without leaking)
        if (p.api_key && String(p.api_key).trim()) {
          fields.api_key = String(p.api_key).trim();
        }

        if (id) {
          const { error } = await slAdmin.from('shortlink_ai_models').update(fields).eq('id', id);
          if (error) return json({ error: error.message }, 400);
          return json({ ok: true, id });
        }
        if (!fields.api_key) return json({ error: 'api_key is required for new models' }, 400);
        const { data, error } = await slAdmin
          .from('shortlink_ai_models').insert(fields).select('id').single();
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true, id: data?.id });
      }

      case 'shortlink_delete_ai_model': {
        const id = String((payload as any)?.id || '');
        if (!id) return json({ error: 'id required' }, 400);
        const { error } = await slAdmin.from('shortlink_ai_models').delete().eq('id', id);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      // ── Approved articles list (for the code-task picker) ──
      case 'shortlink_list_published_articles': {
        const limit = Math.min(200, Math.max(1, Number((payload as any)?.limit || 100)));
        const { data, error } = await slAdmin
          .from('shortlink_pub_articles')
          .select('id, slug, title, status, visit_count, earnings, created_at, cover_url, shortlink_publishers!inner(email, display_name)')
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .limit(limit);
        if (error) return json({ error: error.message }, 400);

        const { data: settings } = await slAdmin
          .from('shortlink_settings').select('site_url').eq('id', 1).maybeSingle();
        const siteUrl: string = (settings?.site_url || '').replace(/\/$/, '');
        return json({
          articles: data || [],
          site_url: siteUrl,
        });
      }


      case 'run_tournament_migration': {
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const pgMetaUrl = url.replace('.supabase.co', '.supabase.co');
        const SQL_STATEMENTS = [
          `CREATE TABLE IF NOT EXISTS tournament_games (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, name text NOT NULL, image_url text, is_active boolean DEFAULT true, sort_order int DEFAULT 0, created_at timestamptz DEFAULT now())`,
          `CREATE TABLE IF NOT EXISTS tournament_types (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, name text NOT NULL, sort_order int DEFAULT 0, is_active boolean DEFAULT true)`,
          `CREATE TABLE IF NOT EXISTS tournaments (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, game_id uuid REFERENCES tournament_games(id) ON DELETE CASCADE, type_id uuid REFERENCES tournament_types(id) ON DELETE SET NULL, name text NOT NULL, mode text DEFAULT 'classic', image_url text, entry_fee_usdt numeric DEFAULT 0, prize_pool numeric DEFAULT 0, max_participants int DEFAULT 100, current_participants int DEFAULT 0, status text DEFAULT 'upcoming', starts_at timestamptz, ends_at timestamptz, created_at timestamptz DEFAULT now())`,
          `CREATE TABLE IF NOT EXISTS tournament_balances (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id text NOT NULL UNIQUE, amount numeric DEFAULT 0, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now())`,
          `CREATE TABLE IF NOT EXISTS tournament_entries (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, tournament_id uuid REFERENCES tournaments(id) ON DELETE CASCADE, user_id text NOT NULL, registered_at timestamptz DEFAULT now(), result_rank int, prize_won numeric DEFAULT 0, UNIQUE(tournament_id, user_id))`,
          `INSERT INTO tournament_types (name, sort_order) VALUES ('Single', 0), ('Duo', 1), ('Team', 2) ON CONFLICT DO NOTHING`,
          `ALTER TABLE tournament_games ENABLE ROW LEVEL SECURITY`,
          `ALTER TABLE tournament_types ENABLE ROW LEVEL SECURITY`,
          `ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY`,
          `ALTER TABLE tournament_balances ENABLE ROW LEVEL SECURITY`,
          `ALTER TABLE tournament_entries ENABLE ROW LEVEL SECURITY`,
          `DO $do$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tournament_games' AND policyname='public read tournament_games') THEN CREATE POLICY "public read tournament_games" ON tournament_games FOR SELECT USING (true); END IF; IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tournament_types' AND policyname='public read tournament_types') THEN CREATE POLICY "public read tournament_types" ON tournament_types FOR SELECT USING (true); END IF; IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tournaments' AND policyname='public read tournaments') THEN CREATE POLICY "public read tournaments" ON tournaments FOR SELECT USING (true); END IF; IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tournament_balances' AND policyname='public read tournament_balances') THEN CREATE POLICY "public read tournament_balances" ON tournament_balances FOR SELECT USING (true); CREATE POLICY "public write tournament_balances" ON tournament_balances FOR INSERT WITH CHECK (true); CREATE POLICY "public update tournament_balances" ON tournament_balances FOR UPDATE USING (true); END IF; IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tournament_entries' AND policyname='public read tournament_entries') THEN CREATE POLICY "public read tournament_entries" ON tournament_entries FOR SELECT USING (true); CREATE POLICY "public insert tournament_entries" ON tournament_entries FOR INSERT WITH CHECK (true); END IF; END $do$`,
        ];
        
        const errors: string[] = [];
        for (const stmt of SQL_STATEMENTS) {
          try {
            const res = await fetch(`${url}/rest/v1/rpc/run_sql`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` },
              body: JSON.stringify({ query: stmt }),
            });
            if (!res.ok) {
              // Try postgres meta
              const errBody = await res.text();
              // Ignore "already exists" errors
              if (!errBody.includes('already exists') && !errBody.includes('42P07') && !errBody.includes('42710')) {
                errors.push(`stmt failed: ${errBody.substring(0, 100)}`);
              }
            }
          } catch(e) {
            errors.push((e as Error).message);
          }
        }
        
        // Verify by checking if tables exist
        const { data: tg } = await admin.from('tournament_games').select('id').limit(1);
        const { data: tt } = await admin.from('tournament_types').select('id').limit(1);
        const { data: tn } = await admin.from('tournaments').select('id').limit(1);
        
        const tablesExist = tg !== null && tt !== null && tn !== null;
        return json({ ok: tablesExist, tables_ready: tablesExist, errors: errors.length > 0 ? errors : undefined });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    console.error('admin-action error', e);
    return json({ error: (e as Error).message || 'Internal error' }, 500);
  }
});
