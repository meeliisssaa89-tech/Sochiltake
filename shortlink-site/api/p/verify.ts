// POST /api/p/verify
// Called by the main app's verify-task edge function for code-tasks backed
// by a publisher article. Body template (default): { user_id, code, token, slug }
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors } from "../_lib/cors.js";
import { pubDb } from "../_lib/supabase.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const body = req.method === "POST" ? req.body || {} : req.query;
  const user_id = String(body.user_id || "").trim();
  const code = String(body.code || "").trim().toUpperCase();
  const token = String(body.token || "").trim();
  const slug = String(body.slug || "").trim();

  if (!user_id || !code) {
    return res.status(400).json({ success: false, message: "user_id and code required" });
  }

  let q = pubDb
    .from("shortlink_pub_sessions")
    .select("*")
    .eq("code", code)
    .eq("user_id", user_id);
  if (token) q = q.eq("token", token);
  if (slug) q = q.eq("slug", slug);

  const { data: session } = await q.maybeSingle();
  if (!session) {
    return res.status(400).json({ success: false, message: "Invalid code" });
  }
  if (!session.completed_at) {
    return res.status(400).json({ success: false, message: "Code not yet earned — finish reading the article first" });
  }
  if (session.used_at) {
    return res.status(400).json({ success: false, message: "Code already used" });
  }

  await pubDb
    .from("shortlink_pub_sessions")
    .update({ used_at: new Date().toISOString() })
    .eq("id", session.id);

  return res.status(200).json({ success: true, message: "Verified" });
}
