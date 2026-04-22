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
    const { userId, taskId, action, code } = await req.json();

    if (!userId || !taskId) {
      return new Response(
        JSON.stringify({ error: 'userId and taskId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the task
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .eq('is_active', true)
      .single();

    if (taskError || !task) {
      return new Response(
        JSON.stringify({ error: 'Task not found or inactive' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already completed
    const { data: existingTask } = await supabase
      .from('user_tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('task_id', taskId)
      .single();

    if (existingTask?.status === 'completed') {
      return new Response(
        JSON.stringify({ error: 'Task already completed', userTask: existingTask }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle based on task type
    if (task.type === 'telegram_join') {
      return await handleTelegramJoin(supabase, userId, task, existingTask, action);
    } else if (task.type === 'watch_ad') {
      return await handleWatchAd(supabase, userId, task, existingTask, action);
    } else if (task.type === 'social_link') {
      return await handleSocialLink(supabase, userId, task, existingTask, action);
    } else if (task.type === 'code_api') {
      return await handleCodeApi(supabase, userId, task, existingTask, action, code);
    }

    return new Response(
      JSON.stringify({ error: 'Unknown task type' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Verify task error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleTelegramJoin(supabase: any, userId: string, task: any, existingTask: any, action: string) {
  const metadata = task.metadata || {};
  const channelId = metadata.channel_id;

  if (!channelId) {
    return new Response(
      JSON.stringify({ error: 'Channel not configured for this task' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (action === 'start') {
    if (!existingTask) {
      await supabase.from('user_tasks').insert({
        user_id: userId,
        task_id: task.id,
        status: 'pending',
        started_at: new Date().toISOString(),
      });
    }

    const channelUrl = metadata.channel_url || `https://t.me/${channelId.replace('@', '')}`;
    return new Response(
      JSON.stringify({ status: 'started', channelUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!botToken) {
    return new Response(
      JSON.stringify({ error: 'Bot token not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${encodeURIComponent(channelId)}&user_id=${userId}`
    );
    const data = await response.json();

    if (!data.ok) {
      return new Response(
        JSON.stringify({ error: 'Could not verify membership. Make sure the bot is an admin in the channel.', verified: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const memberStatus = data.result?.status;
    const isMember = ['member', 'administrator', 'creator'].includes(memberStatus);

    if (!isMember) {
      return new Response(
        JSON.stringify({ error: 'You have not joined the channel yet', verified: false, status: memberStatus }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return await completeTask(supabase, userId, task, existingTask);
  } catch (err) {
    console.error('Telegram API error:', err);
    return new Response(
      JSON.stringify({ error: 'Telegram verification failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function handleWatchAd(supabase: any, userId: string, task: any, existingTask: any, action: string) {
  const metadata = task.metadata || {};
  const requiredDuration = metadata.duration_seconds || 30;

  if (action === 'start') {
    const now = new Date().toISOString();
    if (existingTask?.started_at) {
      const lastStart = new Date(existingTask.started_at).getTime();
      const cooldownMs = (metadata.cooldown_minutes || 60) * 60 * 1000;
      if (Date.now() - lastStart < cooldownMs && existingTask.status === 'pending') {
        // continue
      } else if (existingTask.status === 'completed') {
        return new Response(
          JSON.stringify({ error: 'Task already completed' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (!existingTask) {
      await supabase.from('user_tasks').insert({
        user_id: userId, task_id: task.id, status: 'pending', started_at: now,
      });
    } else {
      await supabase.from('user_tasks')
        .update({ started_at: now, status: 'pending' })
        .eq('id', existingTask.id);
    }

    return new Response(
      JSON.stringify({ status: 'started', requiredDuration, startedAt: now }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!existingTask?.started_at) {
    return new Response(
      JSON.stringify({ error: 'Task not started yet' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const startedAt = new Date(existingTask.started_at).getTime();
  const elapsed = (Date.now() - startedAt) / 1000;

  if (elapsed < requiredDuration) {
    const remaining = Math.ceil(requiredDuration - elapsed);
    return new Response(
      JSON.stringify({ error: `Please wait ${remaining} more seconds`, verified: false, remaining }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return await completeTask(supabase, userId, task, existingTask);
}

async function handleSocialLink(supabase: any, userId: string, task: any, existingTask: any, action: string) {
  const metadata = task.metadata || {};
  const platform = metadata.platform || 'twitter';

  if (action === 'start') {
    if (!existingTask) {
      await supabase.from('user_tasks').insert({
        user_id: userId, task_id: task.id, status: 'pending', started_at: new Date().toISOString(),
      });
    }

    const url = metadata.url || '#';
    return new Response(
      JSON.stringify({ status: 'started', url, platform }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!existingTask?.started_at) {
    return new Response(
      JSON.stringify({ error: 'Task not started yet' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const startedAt = new Date(existingTask.started_at).getTime();
  const minDelay = (metadata.min_delay_seconds || 10);
  const elapsed = (Date.now() - startedAt) / 1000;

  if (elapsed < minDelay) {
    return new Response(
      JSON.stringify({ error: 'Please complete the action first', verified: false }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return await completeTask(supabase, userId, task, existingTask);
}

// ====== code_api: external code verification ======
async function handleCodeApi(
  supabase: any,
  userId: string,
  task: any,
  existingTask: any,
  action: string,
  code?: string,
) {
  const metadata = task.metadata || {};
  const redirectUrl: string | undefined = metadata.redirect_url;

  // START → record pending and return the redirect URL.
  if (action === 'start') {
    if (!existingTask) {
      await supabase.from('user_tasks').insert({
        user_id: userId, task_id: task.id, status: 'pending', started_at: new Date().toISOString(),
      });
    }
    return new Response(
      JSON.stringify({ status: 'started', url: redirectUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // VERIFY → require code.
  const trimmedCode = (code || '').trim();
  if (!trimmedCode) {
    return new Response(
      JSON.stringify({ error: 'Verification code is required', verified: false }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  if (trimmedCode.length > 256) {
    return new Response(
      JSON.stringify({ error: 'Code is too long', verified: false }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const verifyUrl: string | undefined = task.verify_url;
  if (!verifyUrl) {
    return new Response(
      JSON.stringify({ error: 'Verification endpoint not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Rate limit: max 5 attempts per user/task per minute.
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count: recentCount } = await supabase
    .from('task_code_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('task_id', task.id)
    .gte('created_at', oneMinuteAgo);
  if ((recentCount || 0) >= 5) {
    await supabase.from('task_code_attempts').insert({
      user_id: userId, task_id: task.id, code: trimmedCode, status: 'rate_limited',
    });
    return new Response(
      JSON.stringify({ error: 'Too many attempts. Please wait a minute.', verified: false }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Reuse check: this exact code already succeeded for this task.
  const { data: priorSuccess } = await supabase
    .from('task_code_attempts')
    .select('id')
    .eq('task_id', task.id)
    .eq('code', trimmedCode)
    .eq('status', 'success')
    .maybeSingle();
  if (priorSuccess) {
    await supabase.from('task_code_attempts').insert({
      user_id: userId, task_id: task.id, code: trimmedCode, status: 'reused',
    });
    return new Response(
      JSON.stringify({ error: 'This code has already been used.', verified: false }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // max_completions: count distinct users who completed this task.
  if (task.max_completions && task.max_completions > 0) {
    const { count: doneCount } = await supabase
      .from('user_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('task_id', task.id)
      .eq('status', 'completed');
    if ((doneCount || 0) >= task.max_completions) {
      return new Response(
        JSON.stringify({ error: 'This task has reached its completion limit.', verified: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // user_limit: how many times THIS user can complete this task (default 1).
  const userLimit = task.user_limit ?? 1;
  if (userLimit > 0) {
    const { count: userDone } = await supabase
      .from('user_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('task_id', task.id)
      .eq('user_id', userId)
      .eq('status', 'completed');
    if ((userDone || 0) >= userLimit) {
      return new Response(
        JSON.stringify({ error: 'You already completed this task.', verified: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // Build outbound request.
  const method = (task.verify_method || 'POST').toUpperCase();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (task.verify_headers && typeof task.verify_headers === 'object') {
    for (const [k, v] of Object.entries(task.verify_headers)) {
      headers[k] = substitute(String(v), { user_id: userId, code: trimmedCode });
    }
  }

  const bodyTemplate = task.body_template ?? {};
  const body = substituteDeep(bodyTemplate, { user_id: userId, code: trimmedCode });

  let outboundUrl = substitute(verifyUrl, { user_id: userId, code: trimmedCode });
  let init: RequestInit = { method, headers };

  if (method === 'GET' || method === 'HEAD') {
    // Append body keys as query string for GET.
    const qs = new URLSearchParams();
    Object.entries(body || {}).forEach(([k, v]) => qs.append(k, String(v)));
    if (qs.toString()) outboundUrl += (outboundUrl.includes('?') ? '&' : '?') + qs.toString();
  } else {
    init.body = JSON.stringify(body);
  }

  let externalJson: any = null;
  let externalText = '';
  let externalOk = false;
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 15_000);
    const r = await fetch(outboundUrl, { ...init, signal: ctrl.signal });
    clearTimeout(timeout);
    externalText = await r.text();
    try { externalJson = JSON.parse(externalText); } catch { /* non-JSON */ }
    externalOk = r.ok;
  } catch (e: any) {
    await supabase.from('task_code_attempts').insert({
      user_id: userId, task_id: task.id, code: trimmedCode, status: 'failed', error: e?.message || 'fetch failed',
    });
    return new Response(
      JSON.stringify({ error: 'Could not reach verification service', verified: false }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Evaluate success: success_key on the JSON body must equal success_value.
  const successKey = task.success_key || 'success';
  const expected = String(task.success_value ?? 'true').toLowerCase();
  const actual = String(getPath(externalJson, successKey) ?? '').toLowerCase();
  const success = externalOk && actual === expected;

  if (!success) {
    await supabase.from('task_code_attempts').insert({
      user_id: userId, task_id: task.id, code: trimmedCode, status: 'failed',
      response: externalJson ?? { raw: externalText.slice(0, 500) },
    });
    const apiMessage = (externalJson && (externalJson.message || externalJson.error)) || 'Invalid code';
    return new Response(
      JSON.stringify({ error: apiMessage, verified: false }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Log success (the unique index enforces "no two successes on the same code/task").
  const { error: logErr } = await supabase.from('task_code_attempts').insert({
    user_id: userId, task_id: task.id, code: trimmedCode, status: 'success',
    response: externalJson,
  });
  if (logErr) {
    // Most likely cause: another concurrent request already used this code.
    return new Response(
      JSON.stringify({ error: 'This code has already been used.', verified: false }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return await completeTask(supabase, userId, task, existingTask);
}

function substitute(s: string, vars: Record<string, string>): string {
  return s.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, k) => (vars[k] ?? ''));
}

function substituteDeep(value: any, vars: Record<string, string>): any {
  if (typeof value === 'string') return substitute(value, vars);
  if (Array.isArray(value)) return value.map((v) => substituteDeep(v, vars));
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) out[k] = substituteDeep(v, vars);
    return out;
  }
  return value;
}

function getPath(obj: any, path: string): any {
  if (!obj) return undefined;
  return path.split('.').reduce((acc: any, key: string) => (acc == null ? acc : acc[key]), obj);
}

async function completeTask(supabase: any, userId: string, task: any, existingTask: any) {
  const now = new Date().toISOString();

  if (existingTask) {
    await supabase.from('user_tasks')
      .update({ status: 'completed', completed_at: now })
      .eq('id', existingTask.id);
  } else {
    await supabase.from('user_tasks').insert({
      user_id: userId, task_id: task.id, status: 'completed', started_at: now, completed_at: now,
    });
  }

  if (task.reward_amount > 0 && task.reward_currency_id) {
    const { data: balance } = await supabase
      .from('balances')
      .select('amount')
      .eq('user_id', userId)
      .eq('currency_id', task.reward_currency_id)
      .maybeSingle();

    const newAmount = Number(balance?.amount || 0) + Number(task.reward_amount);
    await supabase
      .from('balances')
      .upsert(
        { user_id: userId, currency_id: task.reward_currency_id, amount: newAmount },
        { onConflict: 'user_id,currency_id' }
      );
  }

  if (task.xp_reward > 0) {
    const { data: userData } = await supabase
      .from('users')
      .select('exp, level')
      .eq('telegram_id', userId)
      .single();

    if (userData) {
      const newExp = userData.exp + task.xp_reward;
      const newLevel = Math.floor(newExp / 5000) + 1;
      await supabase
        .from('users')
        .update({ exp: newExp, level: newLevel })
        .eq('telegram_id', userId);
    }
  }

  return new Response(
    JSON.stringify({
      verified: true,
      reward: task.reward_amount,
      xp: task.xp_reward,
      completed_at: now,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
