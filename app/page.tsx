import { redirect } from "next/navigation";

/**
 * Root route.
 *
 * The unauthenticated static-export MVP landing page was removed (Epic 2,
 * Story 2.6). `/` now redirects into the authenticated app; the proxy
 * middleware bounces unauthenticated users on to `/sign-in`.
 */
export default function RootPage() {
  redirect("/app/engage");
}
