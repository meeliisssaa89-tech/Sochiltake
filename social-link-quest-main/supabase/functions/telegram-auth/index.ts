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
    const { initData, startParam, demo } = await req.json();

    let tgUser: any;

    if (demo) {
      // Demo mode for browser preview (no Telegram WebApp available)
      tgUser = {
        id: 123456789,
        username: 'cyber_user',
        first_name: 'Cyber',
        last_name: 'Pulse',
        language_code: 'en',
      };
    } else {
      if (!initData) {
        return new Response(
          JSON.stringify({ error: 'initData is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
      if (!botToken) {
        return new Response(
          JSON.stringify({ error: 'Bot token not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Parse initData
      const params = new URLSearchParams(initData);
      const hash = params.get('hash');
      params.delete('hash');

      const sortedParams = Array.from(params.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

      const encoder = new TextEncoder();
      const secretKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode('WebAppData'),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const secretHash = await crypto.subtle.sign('HMAC', secretKey, encoder.encode(botToken));

      const dataKey = await crypto.subtle.importKey(
        'raw',
        secretHash,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signature = await crypto.subtle.sign('HMAC', dataKey, encoder.encode(sortedParams));

      const computedHash = Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      if (computedHash !== hash) {
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const userDataStr = params.get('user');
      if (!userDataStr) {
        return new Response(
          JSON.stringify({ error: 'No user data' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      tgUser = JSON.parse(userDataStr);
    }

    // Connect to Supabase with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const telegramId = String(tgUser.id);

    // Upsert user
    const { data: user, error: userError } = await supabase
      .from('users')
      .upsert({
        telegram_id: telegramId,
        username: tgUser.username || null,
        first_name: tgUser.first_name || null,
        last_name: tgUser.last_name || null,
        photo_url: tgUser.photo_url || null,
        language: tgUser.language_code || 'en',
      }, { onConflict: 'telegram_id' })
      .select()
      .single();

    if (userError) {
      console.error('User upsert error:', userError);
      return new Response(
        JSON.stringify({ error: 'Failed to create user' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle referral
    if (startParam && startParam.startsWith('ref_')) {
      const inviterId = startParam.replace('ref_', '');
      if (inviterId !== telegramId) {
        // Check if referral already exists
        const { data: existingRef } = await supabase
          .from('referrals')
          .select('id')
          .eq('invitee_id', telegramId)
          .single();

        if (!existingRef) {
          await supabase.from('referrals').insert({
            inviter_id: inviterId,
            invitee_id: telegramId,
          });
          // Update referred_by
          await supabase.from('users').update({ referred_by: inviterId }).eq('telegram_id', telegramId);
        }
      }
    }

    // Ensure user has default currency balances (only insert if not already exists — never overwrite existing amounts)
    const { data: currencies } = await supabase
      .from('currencies')
      .select('id')
      .eq('is_active', true);

    if (currencies) {
      for (const currency of currencies) {
        await supabase
          .from('balances')
          .upsert({
            user_id: telegramId,
            currency_id: currency.id,
            amount: 0,
          }, { onConflict: 'user_id,currency_id', ignoreDuplicates: true });
      }
    }

    // Get user balances
    const { data: balances } = await supabase
      .from('balances')
      .select('*, currencies(*)')
      .eq('user_id', telegramId);

    // Check admin role
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', telegramId);

    const isAdmin = roles?.some(r => r.role === 'admin') || false;

    return new Response(
      JSON.stringify({
        user,
        balances,
        isAdmin,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Auth error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
