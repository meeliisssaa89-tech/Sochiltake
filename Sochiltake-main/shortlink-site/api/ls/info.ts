// GET /api/ls/info?code=XXXXXXX
// Returns redirect info for a publisher shortlink and records the visit.
// Also returns a random admin article for readers to consume before redirect.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import { applyCors } from "../_lib/cors.js";
import { supabase, getSettings, pubDb, getPubSettings } from "../_lib/supabase.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const code = String(req.query?.code || "").trim().slice(0, 20);
  if (!code) return res.status(400).json({ error: "code required" });

  // Fetch link from publisher DB (was bug: was using main DB supabase)
  const { data: link } = await pubDb
    .from("publisher_shortlinks")
    .select("id, publisher_id, original_url, title, short_code, is_active")
    .eq("short_code", code)
    .maybeSingle();

  if (!link || !link.is_active) {
    return res.status(404).json({ error: "Link not found or inactive" });
  }

  // Get pub settings (for CPA rates, redirect delay, ads)
  const pubSettings = await getPubSettings();
  // Get main settings (for reader-side settings)
  const settings = await getSettings();

  // Determine CPA revenue for this visit using country-based rates
  const country = String(
    req.headers["x-vercel-ip-country"] || req.headers["cf-ipcountry"] || "XX"
  ).slice(0, 4).toUpperCase();

  const ip = String(req.headers["x-forwarded-for"] || "")
    .split(",")[0].trim() || String((req.socket as any)?.remoteAddress || "");
  const ipHash = crypto.createHash("sha256").update(`${ip}:${code}`).digest("hex").slice(0, 32);

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: recent } = await pubDb
    .from("publisher_shortlink_visits")
    .select("id")
    .eq("shortlink_id", link.id)
    .eq("ip_hash", ipHash)
    .gte("created_at", oneHourAgo)
    .limit(1)
    .maybeSingle();

  if (!recent) {
    // Resolve CPA rate: country-specific > DEFAULT > fallback
    let revenue = Number(pubSettings.revenue_per_visit || 0);
    const cpaRates = pubSettings.cpa_rates;
    if (cpaRates && typeof cpaRates === "object") {
      const rate = (cpaRates as Record<string, number>)[country]
        ?? (cpaRates as Record<string, number>)["DEFAULT"]
        ?? revenue;
      revenue = Number(rate);
    }

    // Record visit
    await pubDb.from("publisher_shortlink_visits").insert({
      shortlink_id: link.id,
      publisher_id: link.publisher_id,
      country,
      ip_hash: ipHash,
      user_agent: String(req.headers["user-agent"] || "").slice(0, 200),
      referrer: String(req.headers["referer"] || "").slice(0, 200),
      revenue,
    });

    // Increment shortlink counters
    const { data: sl } = await pubDb
      .from("publisher_shortlinks")
      .select("visit_count, earnings")
      .eq("id", link.id)
      .maybeSingle();
    if (sl) {
      await pubDb.from("publisher_shortlinks").update({
        visit_count: (sl.visit_count || 0) + 1,
        earnings: Number(sl.earnings || 0) + revenue,
      }).eq("id", link.id);
    }

    // Increment publisher counters (pending_balance = on hold)
    const { data: pub } = await pubDb
      .from("shortlink_publishers")
      .select("total_visits, pending_balance, lifetime_earnings")
      .eq("id", link.publisher_id)
      .maybeSingle();
    if (pub) {
      await pubDb.from("shortlink_publishers").update({
        total_visits: (pub.total_visits || 0) + 1,
        pending_balance: Number(pub.pending_balance || 0) + revenue,
        lifetime_earnings: Number(pub.lifetime_earnings || 0) + revenue,
      }).eq("id", link.publisher_id);
    }
  }

  // Fetch a random admin article for the reader to consume before redirect
  const { data: articles } = await supabase
    .from("shortlink_articles")
    .select("title, content, image_url")
    .limit(20);

  let article: { title: string; content: string; image_url: string | null } | null = null;
  if (articles && articles.length > 0) {
    article = articles[Math.floor(Math.random() * articles.length)] as any;
  }

  const brandColor = pubSettings.brand_color || settings.brand_color || "#7c3aed";
  const siteTitle = pubSettings.site_title || settings.site_title || "Articles Hub";

  return res.status(200).json({
    original_url: link.original_url,
    title: link.title || null,
    article: article || null,
    settings: {
      site_title: siteTitle,
      brand_color: brandColor,
      ad_head_html: pubSettings.ad_head_html || settings.ad_head_html || "",
      ad_top_html: pubSettings.ad_top_html || settings.ad_top_html || "",
      ad_middle_html: pubSettings.ad_middle_html || settings.ad_middle_html || "",
      ad_bottom_html: pubSettings.ad_bottom_html || settings.ad_bottom_html || "",
      redirect_delay: Number(pubSettings.shortlink_redirect_delay_seconds ?? 10),
    },
  });
}
