import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const { message, parse_mode = 'HTML', media_url, media_type, buttons = [] } = await req.json();
    if (!message && !media_url) return new Response(JSON.stringify({ error: 'message or media required' }), { status: 400, headers: corsHeaders });

    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!botToken) return new Response(JSON.stringify({ error: 'Bot token missing' }), { status: 500, headers: corsHeaders });

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: broadcast } = await supabase.from('broadcasts').insert({
      message, parse_mode, media_url, media_type, buttons, status: 'sending'
    }).select().single();

    const { data: users } = await supabase.from('users').select('telegram_id').eq('is_banned', false);

    const reply_markup = buttons.length ? { inline_keyboard: [buttons.map((b: any) => ({ text: b.text, url: b.url }))] } : undefined;

    let sent = 0, failed = 0;
    for (const u of (users || [])) {
      try {
        let endpoint = 'sendMessage';
        const body: any = { chat_id: u.telegram_id, parse_mode, reply_markup };
        if (media_url) {
          if (media_type === 'photo') { endpoint = 'sendPhoto'; body.photo = media_url; body.caption = message; }
          else if (media_type === 'video') { endpoint = 'sendVideo'; body.video = media_url; body.caption = message; }
          else if (media_type === 'animation') { endpoint = 'sendAnimation'; body.animation = media_url; body.caption = message; }
          else if (media_type === 'sticker') { endpoint = 'sendSticker'; body.sticker = media_url; }
          else { body.text = message; }
        } else {
          body.text = message;
        }
        const r = await fetch(`https://api.telegram.org/bot${botToken}/${endpoint}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        });
        const d = await r.json();
        if (d.ok) sent++; else failed++;
      } catch { failed++; }
      await new Promise(r => setTimeout(r, 35));
    }

    await supabase.from('broadcasts').update({ sent_count: sent, failed_count: failed, status: 'done', finished_at: new Date().toISOString() }).eq('id', broadcast!.id);
    return new Response(JSON.stringify({ sent, failed }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('broadcast error', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: corsHeaders });
  }
});
