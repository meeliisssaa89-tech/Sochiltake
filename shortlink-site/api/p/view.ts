import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import { applyCors } from "../_lib/cors.js";
import { supabase, getSettings } from "../_lib/supabase.js";

/**
 * GET /api/p/view?slug=…
 * Returns the public article body and (server-side) records a visit with country
 * inferred from `x-vercel-ip-country`. Crawlers / repeat IPs still count once
 * per slug per IP per day to keep numbers honest.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  const slug = String(req.query?.slug || "").trim();
  if (!slug) return res.status(400).json({ error: "slug required" });

  const settings = await getSettings();
  if (!settings.publishers_enabled) {
    return res.status(403).json({ error: "Publisher program is not active yet." });
  }

  const { data: article } = await supabase
    .from("shortlink_pub_articles")
    .select("id, publisher_id, slug, title, content, cover_url, sections, linked_shortlink_code, status, created_at")
    .eq("slug", slug)
    .maybeSingle();
  if (!article) return res.status(404).json({ error: "Article not found" });
  if (article.status !== "approved") {
    return res.status(404).json({ error: "Article not available" });
  }

  // Visit attribution
  const country = String(
    req.headers["x-vercel-ip-country"] ||
      req.headers["cf-ipcountry"] ||
      req.headers["x-country"] ||
      "XX"
  ).slice(0, 4).toUpperCase();
  const ip =
    String(req.headers["x-forwarded-for"] || "")
      .split(",")[0]
      .trim() || String(req.socket?.remoteAddress || "");
  const ipHash = crypto.createHash("sha256").update(`${ip}:${slug}`).digest("hex").slice(0, 32);
  const ua = String(req.headers["user-agent"] || "").slice(0, 200);
  const referrer = String(req.headers["referer"] || req.headers["referrer"] || "").slice(0, 200);

  // De-dup: ignore if same ipHash visited the same article within 1h.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("shortlink_pub_visits")
    .select("id")
    .eq("article_id", article.id)
    .eq("ip_hash", ipHash)
    .gte("created_at", oneHourAgo)
    .limit(1)
    .maybeSingle();

  if (!recent) {
    const revenue = Number(settings.revenue_per_visit || 0);
    await supabase.from("shortlink_pub_visits").insert({
      article_id: article.id,
      publisher_id: article.publisher_id,
      country,
      ip_hash: ipHash,
      user_agent: ua,
      referrer,
      revenue,
    });

    // Increment article counters
    const { data: a } = await supabase
      .from("shortlink_pub_articles")
      .select("visit_count, earnings")
      .eq("id", article.id)
      .maybeSingle();
    if (a) {
      await supabase
        .from("shortlink_pub_articles")
        .update({
          visit_count: (a.visit_count || 0) + 1,
          earnings: Number(a.earnings || 0) + revenue,
        })
        .eq("id", article.id);
    }

    // Increment publisher counters
    const { data: pub } = await supabase
      .from("shortlink_publishers")
      .select("total_visits, pending_balance")
      .eq("id", article.publisher_id)
      .maybeSingle();
    if (pub) {
      await supabase
        .from("shortlink_publishers")
        .update({
          total_visits: (pub.total_visits || 0) + 1,
          pending_balance: Number(pub.pending_balance || 0) + revenue,
        })
        .eq("id", article.publisher_id);
    }
  }

  return res.status(200).json({
    article: {
      id: article.id,
      slug: article.slug,
      title: article.title,
      content: article.content,
      cover_url: article.cover_url,
      sections: article.sections || [],
      linked_shortlink_code: article.linked_shortlink_code || null,
      created_at: article.created_at,
    },
    settings: {
      site_title: settings.site_title || "Articles Hub",
      brand_color: settings.brand_color || "#7c3aed",
      ad_head_html: settings.ad_head_html || "",
      ad_top_html: settings.ad_top_html || "",
      ad_middle_html: settings.ad_middle_html || "",
      ad_bottom_html: settings.ad_bottom_html || "",
      wait_seconds: Number(settings.article_wait_seconds || 8),
      redirect_delay: Number(settings.redirect_delay || 10),
    },
  });
}
