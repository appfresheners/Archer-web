/**
 * Browser Supabase client for client components.
 *
 * Uses `@supabase/ssr`'s `createBrowserClient`, typed against the Story 1.2
 * `Database` schema. Credentials come from the fail-loud env accessor — only
 * the public URL and anon key are read here; the service-role key must never
 * be referenced in client-exposed code.
 */

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './schema';
import { getSupabaseAnonKey, getSupabaseUrl } from './env';

export function createClient() {
  return createBrowserClient<Database>(getSupabaseUrl(), getSupabaseAnonKey());
}
