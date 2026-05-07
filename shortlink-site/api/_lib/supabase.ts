import { createClient } from "@supabase/supabase-js";

// ─── DB2 client (shortlink data: settings, articles, publishers, payouts…) ──
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  "";

if (!url || !key) {
  console.warn("[supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
}

export const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── DB1 client (main app data: task_code_sessions) ──────────────────────────
const mainUrl = process.env.MAIN_DB_URL || "";
const mainKey = process.env.MAIN_DB_SERVICE_KEY || "";

if (!mainUrl || !mainKey) {
  console.warn("[supabase] Missing MAIN_DB_URL or MAIN_DB_SERVICE_KEY — task session validation will fail.");
}

export const mainDb = createClient(mainUrl || url, mainKey || key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function getSettings() {
  const { data } = await supabase
    .from("shortlink_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  return data || {};
}
