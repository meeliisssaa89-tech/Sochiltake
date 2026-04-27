// Single dispatcher for /api/admin/* — keeps function count under Vercel Hobby's 12 cap.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import { applyCors } from "../_lib/cors.js";
import { supabase, getSettings } from "../_lib/supabase.js";
import { hashPassword, setAdminCookie, requireAdmin } from "../_lib/auth.js";
import { generateArticleViaAI } from "../_lib/articles.js";

const PUBLIC_SAFE_FIELDS = [
  "page_count", "wait_seconds",
  "ai_provider", "ai_api_key", "ai_model", "ai_image_model",
  "ai_topics", "ai_language",
  "site_title", "brand_color",
  "ad_head_html", "ad_top_html", "ad_middle_html", "ad_bottom_html", "ad_interstitial_html",
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  const action = String(req.query?.action || "").toLowerCase();
  switch (action) {
    case "login":    return handleLogin(req, res);
    case "settings": return handleSettings(req, res);
    case "stats":    return handleStats(req, res);
    case "preview":  return handlePreview(req, res);
    default:         return res.status(404).json({ error: `Unknown admin action: ${action}` });
  }
}

// -- login -------------------------------------------------------------------
async function handleLogin(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { password } = req.body || {};
  if (!password || typeof password !== "string" || password.length < 4) {
    return res.status(400).json({ error: "Password must be at least 4 characters" });
  }

  const settings = await getSettings();
  let secret = settings.hmac_secret;

  if (!settings.admin_password_hash) {
    secret = crypto.randomBytes(32).toString("hex");
    await supabase
      .from("shortlink_settings")
      .update({
        admin_password_hash: hashPassword(password),
        hmac_secret: secret,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
  } else if (hashPassword(password) !== settings.admin_password_hash) {
    return res.status(401).json({ error: "Wrong password" });
  }

  setAdminCookie(res, secret || "fallback-dev-secret");
  return res.status(200).json({ ok: true });
}

// -- settings ----------------------------------------------------------------
async function handleSettings(req: VercelRequest, res: VercelResponse) {
  if (!(await requireAdmin(req, res))) return;

  if (req.method === "GET") {
    const { data } = await supabase
      .from("shortlink_settings").select("*").eq("id", 1).maybeSingle();
    if (!data) return res.status(404).json({ error: "Settings row missing" });
    return res.status(200).json(data);
  }

  if (req.method === "PUT" || req.method === "POST") {
    const body = req.body || {};
    const update: any = { updated_at: new Date().toISOString() };
    for (const k of PUBLIC_SAFE_FIELDS) {
      if (k in body) update[k] = body[k];
    }
    if (Array.isArray(update.ai_topics)) {
      update.ai_topics = update.ai_topics.filter((t: any) => typeof t === "string" && t.trim());
    }
    const { error } = await supabase.from("shortlink_settings").update(update).eq("id", 1);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

// -- stats -------------------------------------------------------------------
async function handleStats(req: VercelRequest, res: VercelResponse) {
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

// -- preview (AI test) -------------------------------------------------------
async function handlePreview(req: VercelRequest, res: VercelResponse) {
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const topic = String((req.body || {}).topic || "technology").trim() || "technology";
  const article = await generateArticleViaAI(topic);
  if (!article) return res.status(400).json({ error: "AI key not configured or call failed" });
  return res.status(200).json(article);
}
