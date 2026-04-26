import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors } from "../_lib/cors.js";
import { supabase, getSettings } from "../_lib/supabase.js";
import { requirePublisher, ensurePublishersEnabled, generateSlug } from "../_lib/pubAuth.js";

/**
 * GET    /api/publisher/articles                — list my articles
 * POST   /api/publisher/articles                — create new
 *   body: { title, content, cover_url? }
 * PATCH  /api/publisher/articles?id=…           — update title/content/cover_url
 * DELETE /api/publisher/articles?id=…           — delete
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (!(await ensurePublishersEnabled(res))) return;
  const me = await requirePublisher(req, res);
  if (!me) return;

  const id = String((req.query?.id as string) || "");

  if (req.method === "GET") {
    const { data } = await supabase
      .from("shortlink_pub_articles")
      .select("id, slug, title, content, cover_url, status, visit_count, earnings, created_at, rejection_reason")
      .eq("publisher_id", me.id)
      .order("created_at", { ascending: false });
    return res.status(200).json({ articles: data || [] });
  }

  if (req.method === "POST") {
    const { title, content, cover_url } = req.body || {};
    const t = String(title || "").trim();
    const c = String(content || "").trim();
    if (t.length < 4 || c.length < 30) {
      return res.status(400).json({ error: "Title (4+) and content (30+) required" });
    }
    const settings = await getSettings();
    const requireApproval = settings.articles_require_approval !== false;
    let slug = generateSlug();
    for (let i = 0; i < 5; i++) {
      const { data } = await supabase
        .from("shortlink_pub_articles")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!data) break;
      slug = generateSlug();
    }
    const { data: created, error } = await supabase
      .from("shortlink_pub_articles")
      .insert({
        publisher_id: me.id,
        slug,
        title: t.slice(0, 200),
        content: c.slice(0, 50000),
        cover_url: cover_url ? String(cover_url).slice(0, 500) : null,
        status: requireApproval ? "pending" : "approved",
      })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ article: created });
  }

  if (req.method === "PATCH") {
    if (!id) return res.status(400).json({ error: "id required" });
    const { title, content, cover_url } = req.body || {};
    const update: any = { updated_at: new Date().toISOString() };
    if (title) update.title = String(title).slice(0, 200);
    if (content) update.content = String(content).slice(0, 50000);
    if (cover_url !== undefined) update.cover_url = cover_url ? String(cover_url).slice(0, 500) : null;

    // If approval is required, editing kicks it back to pending
    const settings = await getSettings();
    if (settings.articles_require_approval !== false && (update.title || update.content)) {
      update.status = "pending";
      update.rejection_reason = null;
    }

    const { error } = await supabase
      .from("shortlink_pub_articles")
      .update(update)
      .eq("id", id)
      .eq("publisher_id", me.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    if (!id) return res.status(400).json({ error: "id required" });
    const { error } = await supabase
      .from("shortlink_pub_articles")
      .delete()
      .eq("id", id)
      .eq("publisher_id", me.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
