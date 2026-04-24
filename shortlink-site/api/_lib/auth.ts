import crypto from "crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSettings } from "./supabase.js";

export function hashPassword(plain: string): string {
  return crypto.createHash("sha256").update(plain).digest("hex");
}

const ADMIN_COOKIE = "sl_admin";

export function signCookie(secret: string, payload: string): string {
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifyCookie(secret: string, cookie: string): boolean {
  if (!cookie || !cookie.includes(".")) return false;
  const [payload, sig] = cookie.split(".");
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  if (sig.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  // payload is "ok:<unix-ts>" — accept up to 7 days old
  const ts = Number(payload.split(":")[1] || 0);
  if (!ts || Date.now() - ts > 7 * 24 * 60 * 60 * 1000) return false;
  return true;
}

export async function requireAdmin(req: VercelRequest, res: VercelResponse): Promise<boolean> {
  const settings = await getSettings();
  const secret = settings.hmac_secret || process.env.HMAC_SECRET || "fallback-dev-secret";

  // Allow Authorization: Bearer <password> for API access
  const auth = req.headers["authorization"];
  if (auth && typeof auth === "string" && auth.startsWith("Bearer ")) {
    const provided = auth.slice("Bearer ".length).trim();
    if (settings.admin_password_hash && hashPassword(provided) === settings.admin_password_hash) {
      return true;
    }
  }

  const cookies = parseCookies(req.headers.cookie || "");
  const cookie = cookies[ADMIN_COOKIE] || "";
  if (verifyCookie(secret, cookie)) return true;

  res.status(401).json({ error: "Unauthorized" });
  return false;
}

export function setAdminCookie(res: VercelResponse, secret: string) {
  const payload = `ok:${Date.now()}`;
  const value = signCookie(secret, payload);
  res.setHeader(
    "Set-Cookie",
    `${ADMIN_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`
  );
}

export function clearAdminCookie(res: VercelResponse) {
  res.setHeader("Set-Cookie", `${ADMIN_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

function parseCookies(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  header.split(";").forEach((part) => {
    const [k, ...rest] = part.trim().split("=");
    if (k) out[k] = rest.join("=");
  });
  return out;
}

export { ADMIN_COOKIE };
