import type { Metadata } from "next";
import GoalWizard from "./GoalWizard";

export const metadata: Metadata = {
  title: "New goal — Archer",
};

/**
 * New Goal page (server component) inside the authenticated `/app` shell.
 *
 * Renders the page heading and delegates all wizard interaction to the
 * `GoalWizard` client orchestrator. The `/app` layout already enforces auth,
 * so no auth check is needed here (mirrors `app/app/projects/new/page.tsx`).
 */
export default function NewGoalPage() {
  return (
    <div className="flex flex-col gap-[var(--spacing-section-y)]">
      <h1 className="text-[length:var(--font-size-section)] font-bold text-text-primary">
        New goal
      </h1>
      <GoalWizard />
    </div>
  );
}
