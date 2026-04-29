// POST /api/p/start
// Generates (or returns) a one-time verification code for a code-task that is
// backed by a specific publisher article. Called by the public article page
// after the user has read all tabs and any wait timer has elapsed.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import { applyCors } from "../_lib/cors.js";
import { supabase, getSettings } from "../_lib/supabase.js";

function generateCode(): string {
  // 8-char base32-ish code, easy to read & type.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.method === "POST" ? req.body || {} : req.query;
  const user_id = String(body.user_id || "").trim();
  const token = String(body.token || "").trim();
  const slug = String(body.slug || "").trim();

  if (!user_id || !token || !slug) {
    return res.status(400).json({ error: "user_id, token and slug are required" });
  }

  const settings = await getSettings();
  if (!settings.publishers_enabled) {
    return res.status(403).json({ error: "Publisher program is not active." });
  }

  const { data: article } = await supabase
    .from("shortlink_pub_articles")
    .select("id, slug, status")
    .eq("slug", slug)
    .maybeSingle();
  if (!article || article.status !== "approved") {
    return res.status(404).json({ error: "Article not available" });
  }

  // Reuse an existing session for this (user, token) if present, otherwise create.
  const { data: existing } = await supabase
    .from("shortlink_pub_sessions")
    .select("*")
    .eq("user_id", user_id)
    .eq("token", token)
    .maybeSingle();

  if (existing && existing.used_at) {
    return res.status(400).json({ error: "This session has already been used." });
  }

  if (existing && existing.code) {
    // Already issued — return the same code (idempotent).
    return res.status(200).json({
      session_id: existing.id,
      code: existing.code,
      already_completed: true,
    });
  }

  let code = generateCode();
  // Avoid collisions
  for (let i = 0; i < 5; i++) {
    const { data } = await supabase
      .from("shortlink_pub_sessions").select("id").eq("code", code).maybeSingle();
    if (!data) break;
    code = generateCode();
  }

  const now = new Date().toISOString();

  if (existing) {
    const { error } = await supabase
      .from("shortlink_pub_sessions")
      .update({ code, completed_at: now, last_page_at: now, pages_done: 1 })
      .eq("id", existing.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ session_id: existing.id, code });
  }

  const { data: created, error } = await supabase
    .from("shortlink_pub_sessions")
    .insert({
      user_id,
      token,
      slug: article.slug,
      article_id: article.id,
      code,
      pages_done: 1,
      total_pages: 1,
      started_at: now,
      last_page_at: now,
      completed_at: now,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ session_id: created.id, code });
}
