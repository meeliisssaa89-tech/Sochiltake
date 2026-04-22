// Telegram bot webhook — handles /start with referral param and sends WebApp button.
// The WebApp URL is read (in this order):
//   1) DB row in app_settings.bot_webapp_url (saved from the Admin → Bot tab)
//   2) WEBAPP_URL Deno secret
//   3) Hard-coded fallback (Vercel deploy)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FALLBACK_WEBAPP_URL = 'https://sochiltake.vercel.app';

async function resolveWebAppUrl(): Promise<string> {
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (url && key) {
      const sb = createClient(url, key);
      const { data } = await sb
        .from('app_settings')
        .select('value')
        .eq('key', 'bot_webapp_url')
        .maybeSingle();
      const v = data?.value;
      const str = typeof v === 'string' ? v : (v && typeof v === 'object' ? '' : '');
      if (str && /^https?:\/\//.test(str)) return str.replace(/\/+$/, '');
    }
  } catch (_) { /* ignore and fall back */ }
  const env = Deno.env.get('WEBAPP_URL');
  return (env || FALLBACK_WEBAPP_URL).replace(/\/+$/, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const update = await req.json();
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!botToken) return new Response('no token', { status: 500 });

    const baseUrl = await resolveWebAppUrl();

    const msg = update.message;
    if (!msg) return new Response('ok');

    const chatId = msg.chat.id;
    const text: string = msg.text || '';

    if (text.startsWith('/start')) {
      const startParam = text.split(' ')[1] || '';
      const webAppUrl = `${baseUrl}${startParam ? `?tgWebAppStartParam=${encodeURIComponent(startParam)}` : ''}`;
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: '🚀 Welcome! Tap the button below to open the app and start earning rewards.',
          reply_markup: { inline_keyboard: [[{ text: '🎮 Open App', web_app: { url: webAppUrl } }]] },
        }),
      });
    }
    return new Response('ok', { headers: corsHeaders });
  } catch (e) {
    console.error('webhook error', e);
    return new Response('error', { status: 500 });
  }
});
