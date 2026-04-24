import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors } from "../_lib/cors.js";
import { supabase, getSettings } from "../_lib/supabase.js";
import { hashPassword, setAdminCookie } from "../_lib/auth.js";
import crypto from "crypto";

/**
 * POST /api/admin/login
 * body: { password: string }
 *
 * First call (no admin password set yet) bootstraps it.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { password } = req.body || {};
  if (!password || typeof password !== "string" || password.length < 4) {
    return res.status(400).json({ error: "Password must be at least 4 characters" });
  }

  const settings = await getSettings();
  let secret = settings.hmac_secret;

  if (!settings.admin_password_hash) {
    // Bootstrap: first password set
    secret = crypto.randomBytes(32).toString("hex");
    await supabase
      .from("shortlink_settings")
      .update({
        admin_password_hash: hashPassword(password),
        hmac_secret: secret,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
  } else {
    if (hashPassword(password) !== settings.admin_password_hash) {
      return res.status(401).json({ error: "Wrong password" });
    }
  }

  setAdminCookie(res, secret || "fallback-dev-secret");
  return res.status(200).json({ ok: true });
}
