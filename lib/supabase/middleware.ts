/**
 * Session-refresh helper — the single session-refresh path for the app.
 *
 * `updateSession` builds a `NextResponse.next` bound to the incoming request,
 * creates a server client whose cookie `setAll` mutates BOTH the request and
 * that same response, then calls `supabase.auth.getUser()` to refresh the
 * session. It returns the SAME response whose cookies were mutated (never a
 * freshly constructed one, or the refreshed session would be lost) together
 * with the resolved `user` so the root middleware can branch on auth.
 *
 * Per Supabase guidance, middleware must call `getUser()` (which revalidates
 * the token with the auth server) — never trust `getSession()` alone here.
 */

import { createServerClient } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAnonKey, getSupabaseUrl } from './env';
import type { Database } from './schema';

export interface UpdateSessionResult {
  response: NextResponse;
  user: User | null;
}

export async function updateSession(
  request: NextRequest,
): Promise<UpdateSessionResult> {
  let response = NextResponse.next({ request });

  // Fail-safe: if the client can't be built (missing env) or the auth server
  // is unreachable, treat the request as unauthenticated and let the guard
  // route it to /sign-in rather than 500-ing every matched route.
  try {
    const supabase = createServerClient<Database>(
      getSupabaseUrl(),
      getSupabaseAnonKey(),
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value),
            );
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            );
          },
        },
      },
    );

    // IMPORTANT: getUser() refreshes/revalidates the session. Do not remove.
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return { response, user };
  } catch (error) {
    console.error('Supabase session refresh failed; treating request as unauthenticated.', error);
    return { response, user: null };
  }
}
