import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors } from "../_lib/cors.js";
import { supabase } from "../_lib/supabase.js";
import {
  hashPublisherPassword, signToken, setPubCookie, getSecret,
  ensurePublishersEnabled, tokenTtlMs,
} from "../_lib/pubAuth.js";

/** POST /api/publisher/login  body: { email, password } */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await ensurePublishersEnabled(res))) return;

  const { email, password } = req.body || {};
  const e = String(email || "").toLowerCase().trim();
  const pw = String(password || "");
  if (!e || !pw) return res.status(400).json({ error: "Email & password required" });

  const { data: pub } = await supabase
    .from("shortlink_publishers")
    .select("*")
    .eq("email", e)
    .maybeSingle();
  if (!pub || pub.password_hash !== hashPublisherPassword(pw)) {
    return res.status(401).json({ error: "Wrong email or password" });
  }
  if (pub.is_blocked) return res.status(403).json({ error: "Account blocked." });

  const secret = await getSecret();
  const token = signToken(secret, {
    sub: pub.id,
    email: pub.email,
    iat: Date.now(),
    exp: Date.now() + tokenTtlMs(),
  });
  setPubCookie(res, token);
  return res.status(200).json({
    ok: true,
    token,
    publisher: {
      id: pub.id,
      email: pub.email,
      display_name: pub.display_name,
      link_code: pub.link_code,
      pending_balance: pub.pending_balance,
    },
  });
}
