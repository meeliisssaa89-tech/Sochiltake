import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors } from "../_lib/cors.js";
import { supabase } from "../_lib/supabase.js";
import { requirePublisher, ensurePublishersEnabled } from "../_lib/pubAuth.js";

/** GET /api/publisher/me — returns current publisher + their articles + summary stats. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (!(await ensurePublishersEnabled(res))) return;
  const me = await requirePublisher(req, res);
  if (!me) return;

  const { data: articles } = await supabase
    .from("shortlink_pub_articles")
    .select("id, slug, title, status, visit_count, earnings, created_at, rejection_reason, cover_url")
    .eq("publisher_id", me.id)
    .order("created_at", { ascending: false });

  return res.status(200).json({
    publisher: {
      id: me.row.id,
      email: me.row.email,
      display_name: me.row.display_name,
      link_code: me.row.link_code,
      pending_balance: Number(me.row.pending_balance || 0),
      lifetime_earnings: Number(me.row.lifetime_earnings || 0),
      total_visits: me.row.total_visits || 0,
      linked_telegram_id: me.row.linked_telegram_id,
    },
    articles: articles || [],
  });
}
