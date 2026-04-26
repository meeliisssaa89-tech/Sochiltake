import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors } from "../_lib/cors.js";
import { clearPubCookie } from "../_lib/pubAuth.js";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  clearPubCookie(res);
  return res.status(200).json({ ok: true });
}
