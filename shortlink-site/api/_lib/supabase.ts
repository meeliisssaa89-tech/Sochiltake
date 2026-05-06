import { createClient } from "@supabase/supabase-js";

// ─── Main DB ────────────────────────────────────────────────────────────────
// Used for: task_code_sessions, shortlink_articles, shortlink_settings (reader
// config: page_count, wait_seconds, ad HTML), and admin panel of the shortlink
// site.
const mainUrl =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "";
const mainKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  "";

if (!mainUrl || !mainKey) {
  console.warn("[supabase] Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
}

export const supabase = createClient(mainUrl, mainKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Settings from the main DB (page_count, wait_seconds, ad HTML, etc.) */
export async function getSettings() {
  const { data } = await supabase
    .from("shortlink_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  return data || {};
}

// ─── Publisher / Shortlink DB ────────────────────────────────────────────────
// Used for: shortlink_publishers, shortlink_pub_articles, shortlink_pub_visits,
// shortlink_pub_sessions, shortlink_payouts, shortlink_ai_models,
// publisher_shortlinks, and shortlink_settings (publisher flags:
// publishers_enabled, signup_enabled, payouts_enabled, revenue_per_visit, …).
const pubUrl =
  process.env.SHORTLINK_DB_URL ||
  mainUrl;
const pubKey =
  process.env.SHORTLINK_DB_SERVICE_KEY ||
  mainKey;

export const pubDb = createClient(pubUrl, pubKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Settings from the publisher/shortlink DB (publishers_enabled, payouts, etc.) */
export async function getPubSettings() {
  const { data } = await pubDb
    .from("shortlink_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  return data || {};
}
