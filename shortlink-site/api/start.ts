import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors } from "./_lib/cors.js";
import { supabase, getSettings } from "./_lib/supabase.js";
import { getArticlesForSession } from "./_lib/articles.js";

/**
 * POST /api/start
 * body: { user_id: string, token: string, task_id?: string }
 *
 * Validates the session token (issued by the main app's verify-task `start` action),
 * generates articles for this visit if not already, and returns the session id +
 * page count + first page article.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.method === "POST" ? req.body || {} : req.query;
  const user_id = String(body.user_id || "").trim();
  const token = String(body.token || "").trim();

  if (!user_id || !token) {
    return res.status(400).json({ error: "user_id and token are required" });
  }

  const { data: session, error } = await supabase
    .from("task_code_sessions")
    .select("*")
    .eq("user_id", user_id)
    .eq("token", token)
    .maybeSingle();

  if (error || !session) {
    return res.status(404).json({ error: "Invalid or expired session token" });
  }

  if (session.used_at) {
    return res.status(400).json({ error: "This session has already been used", code: session.code });
  }

  const settings = await getSettings();
  const pageCount = Math.max(1, Math.min(20, Number(settings.page_count || 5)));
  const waitSeconds = Math.max(0, Math.min(120, Number(settings.wait_seconds || 8)));

  let articles = Array.isArray(session.articles) ? session.articles : [];

  // First time? Generate articles + start the timer
  if (articles.length === 0) {
    articles = await getArticlesForSession(pageCount);
    await supabase
      .from("task_code_sessions")
      .update({
        articles,
        started_at: new Date().toISOString(),
        last_page_at: new Date().toISOString(),
      })
      .eq("id", session.id);
  }

  return res.status(200).json({
    session_id: session.id,
    page_count: articles.length,
    wait_seconds: waitSeconds,
    pages_done: session.pages_done || 0,
    completed: !!session.completed_at,
    code: session.completed_at ? session.code : null,
    settings: {
      site_title: settings.site_title || "Articles Hub",
      brand_color: settings.brand_color || "#7c3aed",
      ad_head_html: settings.ad_head_html || "",
      ad_top_html: settings.ad_top_html || "",
      ad_middle_html: settings.ad_middle_html || "",
      ad_bottom_html: settings.ad_bottom_html || "",
      ad_interstitial_html: settings.ad_interstitial_html || "",
    },
    article: articles[0],
  });
}
