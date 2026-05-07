import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors } from "./_lib/cors.js";
import { mainDb } from "./_lib/supabase.js";

/**
 * POST /api/verify
 * Called by the main app's verify-task edge function as the task's `verify_url`.
 *
 * Body template the main app sends (see verify-task body_template config):
 *   { user_id, code, token }
 *
 * Returns:
 *   { success: true,  message?: string }
 *   { success: false, message: string }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const body = req.method === "POST" ? req.body || {} : req.query;
  const user_id = String(body.user_id || "").trim();
  const code = String(body.code || "").trim().toUpperCase();
  const token = String(body.token || "").trim();

  if (!user_id || !code) {
    return res.status(400).json({ success: false, message: "user_id and code required" });
  }

  // Locate the session by code (and require user_id to match)
  let q = mainDb
    .from("task_code_sessions")
    .select("*")
    .eq("code", code)
    .eq("user_id", user_id);
  if (token) q = q.eq("token", token);

  const { data: session } = await q.maybeSingle();
  if (!session) {
    return res.status(400).json({ success: false, message: "Invalid code" });
  }
  if (!session.completed_at) {
    return res
      .status(400)
      .json({ success: false, message: "Code not yet earned — finish all pages first" });
  }
  if (session.used_at) {
    return res.status(400).json({ success: false, message: "Code already used" });
  }

  // Burn the code immediately so it can't be replayed
  await mainDb
    .from("task_code_sessions")
    .update({ used_at: new Date().toISOString() })
    .eq("id", session.id);

  return res.status(200).json({ success: true, message: "Verified" });
}
