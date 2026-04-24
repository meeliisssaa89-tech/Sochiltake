import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors } from "../_lib/cors.js";
import { requireAdmin } from "../_lib/auth.js";
import { generateArticleViaAI } from "../_lib/articles.js";

/**
 * POST /api/admin/preview  body: { topic?: string }
 * Quick AI test — generates a single article so admin can verify the AI key works.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const topic = String((req.body || {}).topic || "technology").trim() || "technology";
  const article = await generateArticleViaAI(topic);
  if (!article) return res.status(400).json({ error: "AI key not configured or call failed" });
  return res.status(200).json(article);
}
