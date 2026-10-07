/** Origin-tracking helpers for breadcrumbs (`?from=/app/...`). */

const FROM_LABELS: [prefix: string, label: string][] = [
  ["/app/review", "Weekly review"],
  ["/app/engage", "Engage"],
  ["/app/inbox", "Inbox"],
  ["/app/projects", "Projects"],
  ["/app/goals", "Goals"],
  ["/app/focus", "Focus"],
  ["/app/settings", "Settings"],
];

/**
 * Returns `value` only when it is a same-origin `/app` path with a known label;
 * anything else (external URLs, `//host`, backslashes, unknown pages) is null.
 */
export function safeFrom(value: string | string[] | undefined | null): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !raw.startsWith("/app")) return null;
  if (raw.startsWith("//") || raw.includes("\\") || /[\r\n]/.test(raw)) return null;
  if (raw !== "/app" && !raw.startsWith("/app/") && !raw.startsWith("/app?")) return null;
  return labelForPath(raw) ? raw : null;
}

export function labelForPath(path: string): string | null {
  const pathname = path.split(/[?#]/)[0];
  for (const [prefix, label] of FROM_LABELS) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return label;
  }
  return null;
}

/** Appends `?from=` to an internal href (keeping any `#hash`). */
export function withFrom(href: string, from: string | null | undefined): string {
  if (!from) return href;
  const [base, hash] = href.split("#");
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}from=${encodeURIComponent(from)}${hash ? `#${hash}` : ""}`;
}
