import type { Metadata } from "next";
import NewProjectClient from "./NewProjectClient";

export const metadata: Metadata = {
  title: "New project — Archer",
};

/**
 * New Project page (server component) inside the authenticated `/app` shell.
 *
 * Renders the page heading and delegates all interaction to the
 * `ProjectModeInput` client component (via the `NewProjectClient` seam). The
 * `/app` layout already enforces auth, so no auth check is needed here.
 */
export default function NewProjectPage() {
  return (
    <div className="flex flex-col gap-[var(--spacing-section-y)]">
      <h1 className="text-[length:var(--font-size-section)] font-bold text-text-primary">
        New project
      </h1>
      <NewProjectClient />
    </div>
  );
}
