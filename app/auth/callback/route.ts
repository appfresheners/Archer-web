/**
 * Auth callback route handler (PKCE code exchange).
 *
 * The password-reset email links here: `/auth/callback?code=…&next=/reset-password`.
 * This handler exchanges the emailed PKCE `code` for a short-lived recovery
 * session using the server Supabase client (which writes the session cookies),
 * then redirects to the `next` path so `/reset-password` runs with a live
 * recovery session.
 *
 * Security:
 *  - `next` is validated to be an app-internal path (leading `/`, but not `//`
 *    or `/\` which browsers treat as protocol-relative → open redirect). Any
 *    invalid or missing `next` falls back to `/reset-password`.
 *  - A missing or invalid `code` (or a failed exchange) redirects to
 *    `/sign-in?error=…` with a generic message — never revealing specifics.
 *  - The `code` is never logged.
 *
 * This route sits outside the middleware matcher (only `/` and `/app/*` run
 * the guard), so it is reachable while unauthenticated — by design.
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

/** Default landing after a successful exchange. */
const DEFAULT_NEXT = "/reset-password";

/**
 * Only allow app-internal absolute paths. Rejects protocol-relative (`//host`
 * or `/\host`) and anything that isn't a plain leading-slash path, preventing
 * open-redirect via the `next` param.
 */
function safeNext(next: string | null): string {
  if (!next) return DEFAULT_NEXT;
  if (!next.startsWith("/")) return DEFAULT_NEXT;
  // Protocol-relative (`//host`) and backslash variants (`/\host`, which
  // browsers normalize to `//host`) are open-redirect vectors.
  if (next.startsWith("//") || next.startsWith("/\\")) return DEFAULT_NEXT;
  // Allowlist: a plain internal path. Reject anything with control chars,
  // backslashes, or whitespace that a browser might normalize into a host.
  if (!/^\/[A-Za-z0-9\-._~/?#[\]@!$&'()*+,;=%]*$/.test(next)) {
    return DEFAULT_NEXT;
  }
  return next;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  const signInWithError = () =>
    NextResponse.redirect(
      `${origin}/sign-in?error=${encodeURIComponent(
        "That reset link is invalid or has expired. Please request a new one.",
      )}`,
    );

  if (!code) {
    return signInWithError();
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return signInWithError();
  }

  return NextResponse.redirect(`${origin}${next}`);
}
