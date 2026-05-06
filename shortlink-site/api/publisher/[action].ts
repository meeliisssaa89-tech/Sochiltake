// Single dispatcher to keep the project under Vercel Hobby's 12-function cap.
// Handles every /api/publisher/* sub-action: signup, login, logout, me, articles, status, ai_generate.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors } from "../_lib/cors.js";
import { pubDb as supabase, getPubSettings as getSettings } from "../_lib/supabase.js";
import {
  hashPublisherPassword, generateLinkCode, generateSlug, signToken,
  setPubCookie, clearPubCookie, getSecret, requirePublisher,
  ensurePublishersEnabled, ensureSignupEnabled, tokenTtlMs,
} from "../_lib/pubAuth.js";
import { generateArticleSectionsViaAI } from "../_lib/articles.js";
import crypto from "crypto";

// Multi-section validation rules (also reflected in the editor UI).
const MIN_SECTIONS = 3;
const MIN_SECTION_CHARS = 5000;

interface SectionInput {
  title?: unknown;
  content?: unknown;
  image_url?: unknown;
}

function normaliseSections(raw: unknown): { ok: true; sections: any[]; combined: string } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: "sections must be an array" };
  if (raw.length < MIN_SECTIONS) {
    return { ok: false, error: `At least ${MIN_SECTIONS} sections (tabs) are required.` };
  }
  const out: any[] = [];
  let combined = "";
  for (let i = 0; i < raw.length; i++) {
    const s = (raw[i] || {}) as SectionInput;
    const title = String(s.title || "").trim();
    const content = String(s.content || "").trim();
    const image_url = s.image_url ? String(s.image_url).trim() : "";
    if (title.length < 3) {
      return { ok: false, error: `Section ${i + 1}: title is required.` };
    }
    if (content.length < MIN_SECTION_CHARS) {
      return { ok: false, error: `Section ${i + 1}: at least ${MIN_SECTION_CHARS} characters required (currently ${content.length}).` };
    }
    if (!image_url) {
      return { ok: false, error: `Section ${i + 1}: an image URL is required.` };
    }
    out.push({
      title: title.slice(0, 200),
      content: content.slice(0, 80000),
      image_url: image_url.slice(0, 500),
    });
    combined += (combined ? "\n\n" : "") + `# ${title}\n\n${content}`;
  }
  return { ok: true, sections: out, combined: combined.slice(0, 400000) };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  const action = String(req.query?.action || "").toLowerCase();
  switch (action) {
    case "status":      return handleStatus(req, res);
    case "signup":      return handleSignup(req, res);
    case "login":       return handleLogin(req, res);
    case "logout":      return handleLogout(req, res);
    case "me":          return handleMe(req, res);
    case "articles":    return handleArticles(req, res);
    case "ai_models":   return handleAiModels(req, res);
    case "ai_generate": return handleAiGenerate(req, res);
    case "shortlinks":  return handleShortlinks(req, res);
    default:            return res.status(404).json({ error: `Unknown publisher action: ${action}` });
  }
}

// -- status (public) ---------------------------------------------------------
async function handleStatus(_req: VercelRequest, res: VercelResponse) {
  const s = await getSettings();
  return res.status(200).json({
    publishers_enabled: !!s.publishers_enabled,
    signup_enabled: !!s.signup_enabled,
    site_title: s.site_title || "Articles Hub",
    brand_color: s.brand_color || "#7c3aed",
    min_sections: MIN_SECTIONS,
    min_section_chars: MIN_SECTION_CHARS,
  });
}

// -- signup ------------------------------------------------------------------
async function handleSignup(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await ensurePublishersEnabled(res))) return;
  if (!(await ensureSignupEnabled(res))) return;

  const { email, password, display_name } = req.body || {};
  const e = String(email || "").toLowerCase().trim();
  const pw = String(password || "");
  if (!e.includes("@") || pw.length < 6) {
    return res.status(400).json({ error: "Valid email and password (6+) required" });
  }

  const { data: existing } = await supabase
    .from("shortlink_publishers").select("id").eq("email", e).maybeSingle();
  if (existing) return res.status(400).json({ error: "Email already registered" });

  let code = generateLinkCode();
  for (let i = 0; i < 5; i++) {
    const { data } = await supabase
      .from("shortlink_publishers").select("id").eq("link_code", code).maybeSingle();
    if (!data) break;
    code = generateLinkCode();
  }

  const settings = await getSettings();
  const signupBonus = Number(settings.signup_bonus || 0);

  const { data: created, error } = await supabase
    .from("shortlink_publishers")
    .insert({
      email: e,
      password_hash: hashPublisherPassword(pw),
      display_name: display_name ? String(display_name).slice(0, 80) : null,
      link_code: code,
      pending_balance: signupBonus,
    })
    .select().single();
  if (error || !created) return res.status(500).json({ error: error?.message || "Could not create account" });

  const secret = await getSecret();
  const token = signToken(secret, {
    sub: created.id, email: created.email,
    iat: Date.now(), exp: Date.now() + tokenTtlMs(),
  });
  setPubCookie(res, token);
  return res.status(200).json({
    ok: true, token,
    publisher: {
      id: created.id, email: created.email,
      display_name: created.display_name, link_code: created.link_code,
      pending_balance: created.pending_balance,
    },
  });
}

// -- login -------------------------------------------------------------------
async function handleLogin(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await ensurePublishersEnabled(res))) return;

  const { email, password } = req.body || {};
  const e = String(email || "").toLowerCase().trim();
  const pw = String(password || "");
  if (!e || !pw) return res.status(400).json({ error: "Email & password required" });

  const { data: pub } = await supabase
    .from("shortlink_publishers").select("*").eq("email", e).maybeSingle();
  if (!pub || pub.password_hash !== hashPublisherPassword(pw)) {
    return res.status(401).json({ error: "Wrong email or password" });
  }
  if (pub.is_blocked) return res.status(403).json({ error: "Account blocked." });

  const secret = await getSecret();
  const token = signToken(secret, {
    sub: pub.id, email: pub.email,
    iat: Date.now(), exp: Date.now() + tokenTtlMs(),
  });
  setPubCookie(res, token);
  return res.status(200).json({
    ok: true, token,
    publisher: {
      id: pub.id, email: pub.email,
      display_name: pub.display_name, link_code: pub.link_code,
      pending_balance: pub.pending_balance,
    },
  });
}

// -- logout ------------------------------------------------------------------
function handleLogout(_req: VercelRequest, res: VercelResponse) {
  clearPubCookie(res);
  return res.status(200).json({ ok: true });
}

// -- me ----------------------------------------------------------------------
async function handleMe(req: VercelRequest, res: VercelResponse) {
  if (!(await ensurePublishersEnabled(res))) return;
  const me = await requirePublisher(req, res);
  if (!me) return;

  const { data: articles } = await supabase
    .from("shortlink_pub_articles")
    .select("id, slug, title, status, visit_count, earnings, created_at, rejection_reason, cover_url, sections")
    .eq("publisher_id", me.id)
    .order("created_at", { ascending: false });

  return res.status(200).json({
    publisher: {
      id: me.row.id, email: me.row.email,
      display_name: me.row.display_name, link_code: me.row.link_code,
      pending_balance: Number(me.row.pending_balance || 0),
      lifetime_earnings: Number(me.row.lifetime_earnings || 0),
      total_visits: me.row.total_visits || 0,
      linked_telegram_id: me.row.linked_telegram_id,
    },
    articles: articles || [],
  });
}

// -- articles (CRUD) ---------------------------------------------------------
async function handleArticles(req: VercelRequest, res: VercelResponse) {
  if (!(await ensurePublishersEnabled(res))) return;
  const me = await requirePublisher(req, res);
  if (!me) return;

  const id = String((req.query?.id as string) || "");

  if (req.method === "GET") {
    const { data } = await supabase
      .from("shortlink_pub_articles")
      .select("id, slug, title, content, cover_url, status, visit_count, earnings, created_at, rejection_reason, sections, source")
      .eq("publisher_id", me.id)
      .order("created_at", { ascending: false });
    return res.status(200).json({ articles: data || [] });
  }

  if (req.method === "POST") {
    const { title, cover_url, sections } = req.body || {};
    const t = String(title || "").trim();
    if (t.length < 4) return res.status(400).json({ error: "Title (4+) required" });

    const norm = normaliseSections(sections);
    if (!norm.ok) return res.status(400).json({ error: (norm as any).error });

    const settings = await getSettings();
    const requireApproval = settings.articles_require_approval !== false;
    let slug = generateSlug();
    for (let i = 0; i < 5; i++) {
      const { data } = await supabase
        .from("shortlink_pub_articles").select("id").eq("slug", slug).maybeSingle();
      if (!data) break;
      slug = generateSlug();
    }
    const { data: created, error } = await supabase
      .from("shortlink_pub_articles")
      .insert({
        publisher_id: me.id, slug,
        title: t.slice(0, 200),
        content: norm.combined,
        cover_url: (cover_url ? String(cover_url) : norm.sections[0].image_url).slice(0, 500),
        sections: norm.sections,
        status: requireApproval ? "pending" : "approved",
      })
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ article: created });
  }

  if (req.method === "PATCH") {
    if (!id) return res.status(400).json({ error: "id required" });
    const { title, cover_url, sections } = req.body || {};
    const update: any = { updated_at: new Date().toISOString() };
    if (title) update.title = String(title).slice(0, 200);
    if (cover_url !== undefined) update.cover_url = cover_url ? String(cover_url).slice(0, 500) : null;

    if (sections !== undefined) {
      const norm = normaliseSections(sections);
      if (!norm.ok) return res.status(400).json({ error: (norm as any).error });
      update.sections = norm.sections;
      update.content = norm.combined;
      if (!update.cover_url) update.cover_url = norm.sections[0].image_url;
    }

    const settings = await getSettings();
    if (settings.articles_require_approval !== false && (update.title || update.sections)) {
      update.status = "pending";
      update.rejection_reason = null;
    }

    const { error } = await supabase
      .from("shortlink_pub_articles").update(update)
      .eq("id", id).eq("publisher_id", me.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    if (!id) return res.status(400).json({ error: "id required" });
    const { error } = await supabase
      .from("shortlink_pub_articles").delete()
      .eq("id", id).eq("publisher_id", me.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

// -- ai_models (publisher view: which providers can I use) -------------------
async function handleAiModels(req: VercelRequest, res: VercelResponse) {
  if (!(await ensurePublishersEnabled(res))) return;
  const me = await requirePublisher(req, res);
  if (!me) return;

  const { data } = await supabase
    .from("shortlink_ai_models")
    .select("id, provider, display_name, is_default")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return res.status(200).json({ models: data || [] });
}

// -- ai_generate (publisher requests AI to draft sections) -------------------
async function handleAiGenerate(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await ensurePublishersEnabled(res))) return;
  const me = await requirePublisher(req, res);
  if (!me) return;

  const { topic, model_id, language } = req.body || {};
  const t = String(topic || "").trim();
  if (t.length < 3) return res.status(400).json({ error: "Topic is required (3+ chars)" });

  try {
    const article = await generateArticleSectionsViaAI({
      topic: t,
      modelId: model_id ? String(model_id) : null,
      language: language ? String(language) : null,
      minSections: MIN_SECTIONS,
      minChars: MIN_SECTION_CHARS,
    });
    if (!article) return res.status(400).json({ error: "AI generation failed (no model configured?)" });
    return res.status(200).json({ article });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "AI generation failed" });
  }
}

// -- shortlinks (publisher URL shortener) ------------------------------------
// GET  ?action=shortlinks           → list my shortlinks
// POST ?action=shortlinks  {op:"create", title?, original_url}
// POST ?action=shortlinks  {op:"delete", id}
// POST ?action=shortlinks  {op:"toggle", id}

function randomCode(len = 7): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const buf = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += chars[buf[i] % chars.length];
  return out;
}

async function handleShortlinks(req: VercelRequest, res: VercelResponse) {
  if (!(await ensurePublishersEnabled(res))) return;
  const me = await requirePublisher(req, res);
  if (!me) return;

  // ── GET: list ──────────────────────────────────────────────────────────────
  if (req.method === "GET") {
    const { data } = await supabase
      .from("publisher_shortlinks")
      .select("id, title, original_url, short_code, visit_count, earnings, is_active, created_at")
      .eq("publisher_id", me.id)
      .order("created_at", { ascending: false });
    const { data: settings } = await supabase
      .from("shortlink_settings").select("site_url").eq("id", 1).maybeSingle();
    const siteUrl = (settings?.site_url || "").replace(/\/$/, "");
    return res.status(200).json({
      shortlinks: (data || []).map((s: any) => ({
        ...s,
        short_url: `${siteUrl}/s/${s.short_code}`,
      })),
      site_url: siteUrl,
    });
  }

  // ── POST ───────────────────────────────────────────────────────────────────
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const body = req.body || {};
  const op = String(body.op || "create").toLowerCase();

  if (op === "create") {
    const original_url = String(body.original_url || "").trim();
    if (!original_url.startsWith("http://") && !original_url.startsWith("https://")) {
      return res.status(400).json({ error: "original_url must start with http:// or https://" });
    }
    if (original_url.length > 2048) return res.status(400).json({ error: "URL too long" });
    const title = String(body.title || "").trim().slice(0, 120) || null;

    // Unique code, max 5 tries
    let code = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = randomCode(7);
      const { data } = await supabase
        .from("publisher_shortlinks").select("id").eq("short_code", candidate).maybeSingle();
      if (!data) { code = candidate; break; }
    }
    if (!code) return res.status(500).json({ error: "Could not generate unique code, try again." });

    // Enforce per-publisher limit (max 200 links) — cheap guard
    const { count } = await supabase
      .from("publisher_shortlinks")
      .select("id", { count: "exact", head: true })
      .eq("publisher_id", me.id);
    if ((count || 0) >= 200) {
      return res.status(400).json({ error: "Shortlink limit reached (200 per account). Delete old ones first." });
    }

    const { data: created, error } = await supabase
      .from("publisher_shortlinks")
      .insert({ publisher_id: me.id, title, original_url, short_code: code })
      .select("id, short_code")
      .single();
    if (error) return res.status(500).json({ error: error.message });

    const { data: settings } = await supabase
      .from("shortlink_settings").select("site_url").eq("id", 1).maybeSingle();
    const siteUrl = (settings?.site_url || "").replace(/\/$/, "");
    return res.status(200).json({
      ok: true,
      id: created.id,
      short_code: created.short_code,
      short_url: `${siteUrl}/s/${created.short_code}`,
    });
  }

  if (op === "delete") {
    const id = String(body.id || "");
    if (!id) return res.status(400).json({ error: "id required" });
    await supabase
      .from("publisher_shortlinks").delete().eq("id", id).eq("publisher_id", me.id);
    return res.status(200).json({ ok: true });
  }

  if (op === "toggle") {
    const id = String(body.id || "");
    if (!id) return res.status(400).json({ error: "id required" });
    const { data: row } = await supabase
      .from("publisher_shortlinks").select("is_active").eq("id", id).eq("publisher_id", me.id).maybeSingle();
    if (!row) return res.status(404).json({ error: "Not found" });
    await supabase
      .from("publisher_shortlinks").update({ is_active: !row.is_active }).eq("id", id);
    return res.status(200).json({ ok: true, is_active: !row.is_active });
  }

  return res.status(400).json({ error: `Unknown op: ${op}` });
}
