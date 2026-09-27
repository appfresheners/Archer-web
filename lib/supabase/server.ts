/**
 * Server Supabase client for route handlers & server components.
 *
 * Uses `@supabase/ssr`'s `createServerClient`, typed against the Story 1.2
 * `Database` schema, reading/writing auth cookies through `next/headers`
 * `cookies()` with the recommended `getAll`/`setAll` methods.
 *
 * The `setAll` call is wrapped in try/catch: in a Server Component the cookie
 * store is read-only and throws on write. That is safe to ignore here because
 * session refresh happens in middleware (see `updateSession`), which owns
 * writing refreshed cookies to the response.
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './schema';
import { getSupabaseAnonKey, getSupabaseUrl } from './env';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // The `setAll` method was called from a Server Component. This can be
          // ignored if middleware refreshes user sessions (it does).
        }
      },
    },
  });
}
