"use client";

/**
 * NewProjectClient — the thin client seam between the server page and the
 * `ProjectModeInput` form.
 *
 * A server component cannot hand a function prop to a client component, so this
 * wrapper owns the placeholder `onSubmit`. In this story submission is a no-op
 * seam: generation, save, and navigation are wired here by Story 2.3, which
 * replaces this handler with the `fetch('/api/generate')` → save → navigate
 * flow (and can drive the `disabled` in-flight state).
 */

import ProjectModeInput from "@/components/projects/ProjectModeInput";
import type { PlanningDepth } from "@/lib/supabase/schema";

export default function NewProjectClient() {
  // Placeholder seam — Story 2.3 replaces this with generate/save/navigate.
  const handleSubmit = (args: { input: string; depth: PlanningDepth }) => {
    // Intentionally a no-op in Story 2.2; reference args to keep the typed seam.
    void args;
  };

  return <ProjectModeInput onSubmit={handleSubmit} />;
}
