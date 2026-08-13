import { createClient } from "@supabase/supabase-js";
import type { Env } from "./env.js";

/** Service-role client for trusted server-side operations. Never expose this key to the client. */
export function createSupabaseAdminClient(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
