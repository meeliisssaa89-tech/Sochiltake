import { createClient } from '@supabase/supabase-js';

const SHORTLINK_URL = import.meta.env.VITE_SUPABASE_SHORTLINK_URL;
const SHORTLINK_KEY = import.meta.env.VITE_SUPABASE_SHORTLINK_KEY;

export const shortlinkSupabase = createClient(SHORTLINK_URL, SHORTLINK_KEY, {
  auth: { persistSession: false },
});
