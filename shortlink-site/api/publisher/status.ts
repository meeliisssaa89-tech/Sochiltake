import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors } from "../_lib/cors.js";
import { getSettings } from "../_lib/supabase.js";

/**
 * GET /api/publisher/status — public, returns whether publisher program / signup
 * are currently enabled. Used by SignupPage / LoginPage to gate the UI.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  const s = await getSettings();
  return res.status(200).json({
    publishers_enabled: !!s.publishers_enabled,
    signup_enabled: !!s.signup_enabled,
    site_title: s.site_title || "Articles Hub",
    brand_color: s.brand_color || "#7c3aed",
  });
}
