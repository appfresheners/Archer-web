import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Engage — Archer",
};

/**
 * Placeholder Engage page — the post-login landing and redirect target.
 * Real content arrives in a later epic; this exists so `/app/engage`
 * resolves inside the authenticated shell.
 */
export default function EngagePage() {
  return (
    <h1 className="text-[length:var(--font-size-section)] font-bold text-text-primary">
      Engage
    </h1>
  );
}
