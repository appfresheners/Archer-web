/**
 * Root middleware — the app's auth boundary.
 *
 * On every matched request it refreshes the Supabase session via
 * `updateSession` (the single session-refresh path), then enforces the guard:
 *
 *   - Unauthenticated request to any `/app/*` route  → redirect to `/sign-in`
 *   - `/` while authenticated                        → redirect to `/app/engage`
 *   - `/` while unauthenticated                      → redirect to `/sign-in`
 *
 * Redirect enforcement lives here, not in individual pages. Redirects preserve
 * the refreshed auth cookies by copying them from the `updateSession` response.
 *
 * The redirect targets (`/sign-in`, `/app/engage`) do not exist yet — that is
 * intentional sequencing (Stories 1.4–1.6). The guard logic is correct now.
 */

import { updateSession } from '@/lib/supabase/middleware';
import { NextResponse, type NextRequest } from 'next/server';

/** Build a redirect response that carries over refreshed auth cookies. */
function redirectTo(
  request: NextRequest,
  pathname: string,
  from: NextResponse,
): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie);
  });
  return redirect;
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // Unauthenticated access to any /app/* route → sign-in.
  // Exact `/app` or a `/app/` descendant only — never `/apple` etc. (defense
  // in depth; the matcher already scopes this, but the guard shouldn't rely
  // on the matcher shape alone).
  if (!user && (pathname === '/app' || pathname.startsWith('/app/'))) {
    return redirectTo(request, '/sign-in', response);
  }

  // Root route branches on auth state.
  if (pathname === '/') {
    return redirectTo(request, user ? '/app/engage' : '/sign-in', response);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * A positive allowlist: only `/` and `/app/*` run this middleware. Because
     * the matcher never matches `_next/static`, `_next/image`, static/image
     * assets, or `/api` route handlers, those paths are excluded by
     * construction and manage their own concerns.
     */
    '/',
    '/app/:path*',
  ],
};
