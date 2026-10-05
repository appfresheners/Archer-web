import type { Metadata } from "next";
import { Suspense } from "react";
import NewProjectClient from "./NewProjectClient";
import { loadAreasForPicker, loadGoalsForPicker } from "./load-goals";

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
export default async function NewProjectPage() {
  const [goals, areas] = await Promise.all([
    loadGoalsForPicker(),
    loadAreasForPicker(),
  ]);

  return (
    <div className="flex flex-col gap-[var(--spacing-section-y)]">
      <h1 className="text-[length:var(--font-size-section)] font-bold text-text-primary">
        New project
      </h1>
      {/* useSearchParams (clarify seed) requires a Suspense boundary. */}
      <Suspense>
        <NewProjectClient goals={goals} areas={areas} />
      </Suspense>
    </div>
  );
}
