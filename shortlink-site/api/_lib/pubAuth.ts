// Lightweight HMAC-signed JWT-like token for publisher accounts.
import crypto from "crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPubSettings, pubDb } from "./supabase.js";

export interface PubTokenPayload {
  sub: string; // publisher_id
  email: string;
  iat: number; // issued at (ms)
  exp: number; // expires at (ms)
}

const COOKIE_NAME = "sl_pub";
const TTL_DAYS = 30;

function b64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Buffer {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function signToken(secret: string, payload: PubTokenPayload): string {
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac("sha256", secret).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyToken(secret: string, token: string): PubTokenPayload | null {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = b64url(crypto.createHmac("sha256", secret).update(body).digest());
  if (sig.length !== expected.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(fromB64url(body).toString("utf-8")) as PubTokenPayload;
    if (!payload.sub || !payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function hashPublisherPassword(plain: string): string {
  return crypto.createHash("sha256").update(plain).digest("hex");
}

export function generateLinkCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export function generateSlug(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(10);
  let out = "";
  for (let i = 0; i < 10; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function parseCookies(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  header.split(";").forEach((part) => {
    const [k, ...rest] = part.trim().split("=");
    if (k) out[k] = rest.join("=");
  });
  return out;
}

export function setPubCookie(res: VercelResponse, token: string) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${TTL_DAYS * 24 * 60 * 60}`
  );
}

export function clearPubCookie(res: VercelResponse) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

export async function getSecret(): Promise<string> {
  const settings = await getPubSettings();
  let secret = settings.hmac_secret as string | undefined;
  if (!secret) {
    secret = crypto.randomBytes(32).toString("hex");
    await pubDb
      .from("shortlink_settings")
      .update({ hmac_secret: secret, updated_at: new Date().toISOString() })
      .eq("id", 1);
  }
  return secret;
}

/** Returns the publisher row from a request's auth cookie/Bearer header — or null + 401 response. */
export async function requirePublisher(
  req: VercelRequest,
  res: VercelResponse
): Promise<{ id: string; email: string; row: any } | null> {
  const secret = await getSecret();

  let token = "";
  const authHeader = req.headers["authorization"];
  if (authHeader && typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice("Bearer ".length).trim();
  }
  if (!token) {
    const cookies = parseCookies(req.headers.cookie || "");
    token = cookies[COOKIE_NAME] || "";
  }

  const payload = verifyToken(secret, token);
  if (!payload) {
    res.status(401).json({ error: "Not signed in" });
    return null;
  }

  const { data: pub } = await pubDb
    .from("shortlink_publishers")
    .select("*")
    .eq("id", payload.sub)
    .maybeSingle();
  if (!pub) {
    res.status(401).json({ error: "Account no longer exists" });
    return null;
  }
  if (pub.is_blocked) {
    res.status(403).json({ error: "This account is blocked." });
    return null;
  }
  return { id: pub.id, email: pub.email, row: pub };
}

export async function ensurePublishersEnabled(res: VercelResponse): Promise<boolean> {
  const settings = await getPubSettings();
  if (!settings.publishers_enabled) {
    res.status(403).json({ error: "Publisher program is not active yet." });
    return false;
  }
  return true;
}

export async function ensureSignupEnabled(res: VercelResponse): Promise<boolean> {
  const settings = await getPubSettings();
  if (!settings.signup_enabled) {
    res.status(403).json({ error: "Sign-up is currently closed." });
    return false;
  }
  return true;
}

export function tokenTtlMs(): number {
  return TTL_DAYS * 24 * 60 * 60 * 1000;
}
