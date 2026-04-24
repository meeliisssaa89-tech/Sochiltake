import crypto from "crypto";

// 10-character upper-case alphanumeric code, easy to type
export function generateCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(10);
  let out = "";
  for (let i = 0; i < 10; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}
