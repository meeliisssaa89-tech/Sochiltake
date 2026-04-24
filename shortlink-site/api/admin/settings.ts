import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors } from "../_lib/cors.js";
import { supabase } from "../_lib/supabase.js";
import { requireAdmin } from "../_lib/auth.js";

const PUBLIC_SAFE_FIELDS = [
  "page_count",
  "wait_seconds",
  "ai_provider",
  "ai_api_key",
  "ai_model",
  "ai_image_model",
  "ai_topics",
  "ai_language",
  "site_title",
  "brand_color",
  "ad_head_html",
  "ad_top_html",
  "ad_middle_html",
  "ad_bottom_html",
  "ad_interstitial_html",
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (!(await requireAdmin(req, res))) return;

  if (req.method === "GET") {
    const { data } = await supabase
      .from("shortlink_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (!data) return res.status(404).json({ error: "Settings row missing" });
    // Mask secrets a bit but still return them so admin can see/edit
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
