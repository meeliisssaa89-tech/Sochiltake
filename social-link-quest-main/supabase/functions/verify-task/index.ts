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
    const { userId, taskId, action } = await req.json();

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
    // Create or update user_task as pending
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

  // Verify membership
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

    // Complete the task and grant rewards
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

    // Check cooldown (1 hour between ad watches)
    if (existingTask?.started_at) {
      const lastStart = new Date(existingTask.started_at).getTime();
      const cooldownMs = (metadata.cooldown_minutes || 60) * 60 * 1000;
      if (Date.now() - lastStart < cooldownMs && existingTask.status === 'pending') {
        // Already watching, continue
      } else if (existingTask.status === 'completed') {
        return new Response(
          JSON.stringify({ error: 'Task already completed' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (!existingTask) {
      await supabase.from('user_tasks').insert({
        user_id: userId,
        task_id: task.id,
        status: 'pending',
        started_at: now,
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

  // Verify completion - check server-side timer
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
        user_id: userId,
        task_id: task.id,
        status: 'pending',
        started_at: new Date().toISOString(),
      });
    }

    const url = metadata.url || '#';
    return new Response(
      JSON.stringify({ status: 'started', url, platform }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // For social links, auto-approve after a delay (admin can configure)
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

async function completeTask(supabase: any, userId: string, task: any, existingTask: any) {
  const now = new Date().toISOString();

  // Update or insert user_task as completed
  if (existingTask) {
    await supabase.from('user_tasks')
      .update({ status: 'completed', completed_at: now })
      .eq('id', existingTask.id);
  } else {
    await supabase.from('user_tasks').insert({
      user_id: userId,
      task_id: task.id,
      status: 'completed',
      started_at: now,
      completed_at: now,
    });
  }

  // Grant currency reward
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

  // Grant XP
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
