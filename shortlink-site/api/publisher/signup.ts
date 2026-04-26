import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors } from "../_lib/cors.js";
import { supabase, getSettings } from "../_lib/supabase.js";
import {
  hashPublisherPassword, generateLinkCode, signToken,
  setPubCookie, getSecret, ensurePublishersEnabled, ensureSignupEnabled, tokenTtlMs,
} from "../_lib/pubAuth.js";

/**
 * POST /api/publisher/signup
 * body: { email, password, display_name? }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await ensurePublishersEnabled(res))) return;
  if (!(await ensureSignupEnabled(res))) return;

  const { email, password, display_name } = req.body || {};
  const e = String(email || "").toLowerCase().trim();
  const pw = String(password || "");
  if (!e.includes("@") || pw.length < 6) {
    return res.status(400).json({ error: "Valid email and password (6+) required" });
  }

  // Existing?
  const { data: existing } = await supabase
    .from("shortlink_publishers")
    .select("id")
    .eq("email", e)
    .maybeSingle();
  if (existing) return res.status(400).json({ error: "Email already registered" });

  // Generate unique link code
  let code = generateLinkCode();
  for (let i = 0; i < 5; i++) {
    const { data } = await supabase
      .from("shortlink_publishers")
      .select("id")
      .eq("link_code", code)
      .maybeSingle();
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
    .select()
    .single();
  if (error || !created) return res.status(500).json({ error: error?.message || "Could not create account" });

  const secret = await getSecret();
  const token = signToken(secret, {
    sub: created.id,
    email: created.email,
    iat: Date.now(),
    exp: Date.now() + tokenTtlMs(),
  });
  setPubCookie(res, token);
  return res.status(200).json({
    ok: true,
    token,
    publisher: {
      id: created.id,
      email: created.email,
      display_name: created.display_name,
      link_code: created.link_code,
      pending_balance: created.pending_balance,
    },
  });
}
