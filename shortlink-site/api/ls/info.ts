// GET /api/ls/info?code=XXXXXXX
// Returns redirect info for a publisher shortlink and records the visit.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import { applyCors } from "../_lib/cors.js";
import { supabase, getSettings } from "../_lib/supabase.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const code = String(req.query?.code || "").trim().slice(0, 20);
  if (!code) return res.status(400).json({ error: "code required" });

  const settings = await getSettings();

  const { data: link } = await supabase
    .from("publisher_shortlinks")
    .select("id, publisher_id, original_url, title, short_code, is_active")
    .eq("short_code", code)
    .maybeSingle();

  if (!link || !link.is_active) {
    return res.status(404).json({ error: "Link not found or inactive" });
  }

  // Visit tracking — deduplicated by IP+code per hour (same pattern as articles)
  const country = String(
    req.headers["x-vercel-ip-country"] || req.headers["cf-ipcountry"] || "XX"
  ).slice(0, 4).toUpperCase();
  const ip = String(req.headers["x-forwarded-for"] || "")
    .split(",")[0].trim() || String((req.socket as any)?.remoteAddress || "");
  const ipHash = crypto.createHash("sha256").update(`${ip}:${code}`).digest("hex").slice(0, 32);

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("publisher_shortlink_visits")
    .select("id")
    .eq("shortlink_id", link.id)
    .eq("ip_hash", ipHash)
    .gte("created_at", oneHourAgo)
    .limit(1)
    .maybeSingle();

  if (!recent) {
    const revenue = Number(settings.revenue_per_visit || 0);

    // Record visit in dedicated shortlink visits table
    await supabase.from("publisher_shortlink_visits").insert({
      shortlink_id: link.id,
      publisher_id: link.publisher_id,
      country,
      ip_hash: ipHash,
      user_agent: String(req.headers["user-agent"] || "").slice(0, 200),
      referrer: String(req.headers["referer"] || "").slice(0, 200),
      revenue,
    });

    // Increment shortlink counters
    const { data: sl } = await supabase
      .from("publisher_shortlinks")
      .select("visit_count, earnings")
      .eq("id", link.id)
      .maybeSingle();
    if (sl) {
      await supabase.from("publisher_shortlinks").update({
        visit_count: (sl.visit_count || 0) + 1,
        earnings: Number(sl.earnings || 0) + revenue,
      }).eq("id", link.id);
    }

    // Increment publisher counters
    const { data: pub } = await supabase
      .from("shortlink_publishers")
      .select("total_visits, pending_balance")
      .eq("id", link.publisher_id)
      .maybeSingle();
    if (pub) {
      await supabase.from("shortlink_publishers").update({
        total_visits: (pub.total_visits || 0) + 1,
        pending_balance: Number(pub.pending_balance || 0) + revenue,
      }).eq("id", link.publisher_id);
    }
  }

  return res.status(200).json({
    original_url: link.original_url,
    title: link.title || null,
    settings: {
      site_title: settings.site_title || "Articles Hub",
      brand_color: settings.brand_color || "#7c3aed",
      ad_head_html: settings.ad_head_html || "",
      ad_top_html: settings.ad_top_html || "",
      ad_middle_html: settings.ad_middle_html || "",
      ad_bottom_html: settings.ad_bottom_html || "",
      redirect_delay: Number(settings.shortlink_redirect_delay_seconds ?? 10),
    },
  });
}
