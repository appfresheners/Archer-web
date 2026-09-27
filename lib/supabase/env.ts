/**
 * Fail-loud environment accessor for the Supabase integration.
 *
 * Every required Supabase variable is read through a typed getter here. A
 * missing variable throws a clear, logged error that names the offending
 * variable rather than letting the app degrade silently with `undefined`
 * credentials. This is the single source of required-var validation for
 * Supabase wiring (Story 1.3).
 *
 * `.env.example` is the canonical list of every required variable; keep the
 * names below in lockstep with it.
 */

/**
 * Read a required environment variable, throwing (and logging) a clear error
 * naming the variable when it is missing or empty.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    const message = `Missing required environment variable: ${name}. Add it to your .env (see .env.example for the full contract).`;
    // Loud failure — logged so the missing var is visible in server logs.
    console.error(message);
    throw new Error(message);
  }
  return value;
}

/** Public Supabase project URL. Safe for browser + server. */
export function getSupabaseUrl(): string {
  return requireEnv('NEXT_PUBLIC_SUPABASE_URL');
}

/** Public anon key. Safe for browser + server. */
export function getSupabaseAnonKey(): string {
  return requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

/**
 * Service-role key. Server-route-handler ONLY — never import this from client
 * or middleware code. It bypasses RLS and must never reach the browser.
 */
export function getServiceRoleKey(): string {
  return requireEnv('SUPABASE_SERVICE_ROLE_KEY');
}
