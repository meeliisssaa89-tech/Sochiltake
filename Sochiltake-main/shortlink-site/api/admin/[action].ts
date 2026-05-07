// Single dispatcher for /api/admin/* — keeps function count under Vercel Hobby's 12 cap.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import { applyCors } from "../_lib/cors.js";
import { supabase, getSettings } from "../_lib/supabase.js";
import { pubDb, getPubSettings } from "../_lib/supabase.js";
import { hashPassword, setAdminCookie, requireAdmin } from "../_lib/auth.js";
import { generateArticleViaAI } from "../_lib/articles.js";

const PUBLIC_SAFE_FIELDS = [
  "page_count", "wait_seconds",
  "ai_provider", "ai_api_key", "ai_model", "ai_image_model",
  "ai_topics", "ai_language",
  "site_title", "brand_color",
  "ad_head_html", "ad_top_html", "ad_middle_html", "ad_bottom_html", "ad_interstitial_html",
];

const PUB_SAFE_FIELDS = [
  "publishers_enabled", "signup_enabled",
  "articles_require_approval", "signup_bonus",
  "revenue_per_visit", "shortlink_redirect_delay_seconds",
  "min_payout", "hold_days", "cpa_rates",
  "site_title", "brand_color",
  "ad_head_html", "ad_top_html", "ad_middle_html", "ad_bottom_html",
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  const action = String(req.query?.action || "").toLowerCase();
  switch (action) {
    case "login":              return handleLogin(req, res);
    case "settings":           return handleSettings(req, res);
    case "stats":              return handleStats(req, res);
    case "preview":            return handlePreview(req, res);
    case "pub_settings":       return handlePubSettings(req, res);
    case "pub_articles":       return handlePubArticles(req, res);
    case "pub_article_action": return handlePubArticleAction(req, res);
    case "pub_publishers":     return handlePubPublishers(req, res);
    case "pub_publisher_action": return handlePubPublisherAction(req, res);
    default: return res.status(404).json({ error: `Unknown admin action: ${action}` });
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

// -- settings (main reader config) -------------------------------------------
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

  const [
    { count: total }, { count: completed }, { count: today }, { count: articles },
    { count: publishers }, { count: pubArticles }, { count: pendingArticles },
    { data: revenueData },
  ] = await Promise.all([
    supabase.from("task_code_sessions").select("id", { count: "exact", head: true }),
    supabase.from("task_code_sessions").select("id", { count: "exact", head: true }).not("completed_at", "is", null),
    supabase.from("task_code_sessions").select("id", { count: "exact", head: true }).gte("created_at", dayAgo),
    supabase.from("shortlink_articles").select("id", { count: "exact", head: true }),
    pubDb.from("shortlink_publishers").select("id", { count: "exact", head: true }),
    pubDb.from("shortlink_pub_articles").select("id", { count: "exact", head: true }),
    pubDb.from("shortlink_pub_articles").select("id", { count: "exact", head: true }).eq("status", "pending"),
    pubDb.from("shortlink_publishers").select("pending_balance, available_balance, lifetime_earnings"),
  ]);

  const totalPendingBalance = (revenueData || []).reduce((s: number, r: any) => s + Number(r.pending_balance || 0), 0);
  const totalAvailableBalance = (revenueData || []).reduce((s: number, r: any) => s + Number(r.available_balance || 0), 0);
  const totalLifetime = (revenueData || []).reduce((s: number, r: any) => s + Number(r.lifetime_earnings || 0), 0);

  return res.status(200).json({
    sessions_total: total || 0,
    sessions_completed: completed || 0,
    sessions_today: today || 0,
    cached_articles: articles || 0,
    publishers_total: publishers || 0,
    pub_articles_total: pubArticles || 0,
    pub_articles_pending: pendingArticles || 0,
    total_pending_balance: totalPendingBalance,
    total_available_balance: totalAvailableBalance,
    total_lifetime_revenue: totalLifetime,
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

// -- pub_settings (publisher program config) ---------------------------------
async function handlePubSettings(req: VercelRequest, res: VercelResponse) {
  if (!(await requireAdmin(req, res))) return;

  if (req.method === "GET") {
    const { data } = await pubDb
      .from("shortlink_settings").select("*").eq("id", 1).maybeSingle();
    if (!data) return res.status(404).json({ error: "Publisher settings row missing" });
    return res.status(200).json(data);
  }

  if (req.method === "PUT" || req.method === "POST") {
    const body = req.body || {};
    const update: any = { updated_at: new Date().toISOString() };
    for (const k of PUB_SAFE_FIELDS) {
      if (k in body) update[k] = body[k];
    }
    // cpa_rates must be a valid JSON object
    if (update.cpa_rates && typeof update.cpa_rates === "string") {
      try { update.cpa_rates = JSON.parse(update.cpa_rates); } catch { delete update.cpa_rates; }
    }
    const { error } = await pubDb.from("shortlink_settings").update(update).eq("id", 1);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

// -- pub_articles (moderation queue) -----------------------------------------
async function handlePubArticles(req: VercelRequest, res: VercelResponse) {
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const status = String(req.query?.status || "").toLowerCase();
  let q = pubDb
    .from("shortlink_pub_articles")
    .select("id, slug, title, cover_url, status, visit_count, earnings, created_at, rejection_reason, publisher_id, sections")
    .order("created_at", { ascending: false })
    .limit(100);

  if (status && ["pending", "approved", "rejected"].includes(status)) {
    q = q.eq("status", status);
  }

  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });

  // Enrich with publisher email
  const pubIds = [...new Set((data || []).map((a: any) => a.publisher_id).filter(Boolean))];
  let pubMap: Record<string, string> = {};
  if (pubIds.length > 0) {
    const { data: pubs } = await pubDb
      .from("shortlink_publishers")
      .select("id, email, display_name")
      .in("id", pubIds);
    (pubs || []).forEach((p: any) => {
      pubMap[p.id] = p.display_name ? `${p.display_name} <${p.email}>` : p.email;
    });
  }

  const articles = (data || []).map((a: any) => ({
    ...a,
    publisher_name: pubMap[a.publisher_id] || a.publisher_id,
  }));

  return res.status(200).json({ articles });
}

// -- pub_article_action (approve/reject) -------------------------------------
async function handlePubArticleAction(req: VercelRequest, res: VercelResponse) {
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { id, action, reason } = req.body || {};
  if (!id) return res.status(400).json({ error: "id required" });
  if (!["approve", "reject"].includes(action)) {
    return res.status(400).json({ error: "action must be approve or reject" });
  }

  const update: any = {
    status: action === "approve" ? "approved" : "rejected",
    updated_at: new Date().toISOString(),
  };
  if (action === "reject") {
    update.rejection_reason = reason ? String(reason).slice(0, 500) : "Does not meet quality standards.";
  } else {
    update.rejection_reason = null;
  }

  const { error } = await pubDb.from("shortlink_pub_articles").update(update).eq("id", id);
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ ok: true, status: update.status });
}

// -- pub_publishers (admin view of all publishers) ---------------------------
async function handlePubPublishers(req: VercelRequest, res: VercelResponse) {
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { data, error } = await pubDb
    .from("shortlink_publishers")
    .select("id, email, display_name, link_code, pending_balance, available_balance, lifetime_earnings, total_visits, is_blocked, linked_telegram_id, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ publishers: data || [] });
}

// -- pub_publisher_action (block/unblock/release-balance/mark-paid) ----------
async function handlePubPublisherAction(req: VercelRequest, res: VercelResponse) {
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { id, action, amount } = req.body || {};
  if (!id) return res.status(400).json({ error: "id required" });

  const { data: pub } = await pubDb
    .from("shortlink_publishers")
    .select("id, pending_balance, available_balance, is_blocked")
    .eq("id", id)
    .maybeSingle();
  if (!pub) return res.status(404).json({ error: "Publisher not found" });

  if (action === "block") {
    await pubDb.from("shortlink_publishers").update({ is_blocked: true }).eq("id", id);
    return res.status(200).json({ ok: true });
  }

  if (action === "unblock") {
    await pubDb.from("shortlink_publishers").update({ is_blocked: false }).eq("id", id);
    return res.status(200).json({ ok: true });
  }

  if (action === "release_balance") {
    // Move amount from pending_balance to available_balance
    const pendingNow = Number(pub.pending_balance || 0);
    const availableNow = Number(pub.available_balance || 0);
    const releaseAmt = amount ? Math.min(Number(amount), pendingNow) : pendingNow;
    if (releaseAmt <= 0) return res.status(400).json({ error: "No pending balance to release" });

    await pubDb.from("shortlink_publishers").update({
      pending_balance: pendingNow - releaseAmt,
      available_balance: availableNow + releaseAmt,
    }).eq("id", id);
    return res.status(200).json({ ok: true, released: releaseAmt });
  }

  if (action === "mark_paid") {
    // Zero out available_balance (payout processed)
    await pubDb.from("shortlink_publishers").update({
      available_balance: 0,
    }).eq("id", id);
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}
