// Telegram bot webhook — handles /start with referral param and sends WebApp button.
// The WebApp URL is read from the WEBAPP_URL secret so the same deploy works
// behind any frontend domain (Vercel, Replit, custom, …).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FALLBACK_WEBAPP_URL = 'https://social-link-quest.lovable.app';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const update = await req.json();
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!botToken) return new Response('no token', { status: 500 });

    const baseUrl = (Deno.env.get('WEBAPP_URL') || FALLBACK_WEBAPP_URL).replace(/\/+$/, '');

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
