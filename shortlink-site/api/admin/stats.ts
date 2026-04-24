import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors } from "../_lib/cors.js";
import { supabase } from "../_lib/supabase.js";
import { requireAdmin } from "../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const dayAgo = new Date(Date.now() - 24 * 60 * 60_000).toISOString();

  const [{ count: total }, { count: completed }, { count: today }, { count: articles }] =
    await Promise.all([
      supabase.from("task_code_sessions").select("id", { count: "exact", head: true }),
      supabase
        .from("task_code_sessions")
        .select("id", { count: "exact", head: true })
        .not("completed_at", "is", null),
      supabase
        .from("task_code_sessions")
        .select("id", { count: "exact", head: true })
        .gte("created_at", dayAgo),
      supabase.from("shortlink_articles").select("id", { count: "exact", head: true }),
    ]);

  return res.status(200).json({
    sessions_total: total || 0,
    sessions_completed: completed || 0,
    sessions_today: today || 0,
    cached_articles: articles || 0,
  });
}
