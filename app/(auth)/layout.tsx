/**
 * Auth route-group layout.
 *
 * Wraps `/sign-in` and `/sign-up` (and future auth pages) in a minimal,
 * single-column, vertically- and horizontally-centred shell capped at 480px.
 * The `(auth)` route group keeps these pages out of the URL and, crucially,
 * out of the authenticated `/app` shell that arrives in Story 1.6 — so auth
 * pages never inherit the sidebar/navigation chrome.
 *
 * Consumes design tokens from `globals.css` only; no new UI kit.
 */

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-[var(--spacing-page-x)] py-[var(--spacing-section-y)]">
      <div className="w-full max-w-[480px]">{children}</div>
    </main>
  );
}
