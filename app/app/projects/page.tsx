/** Project list inside the authenticated `/app` shell. */

import StatusBadge from "@/components/goals/StatusBadge";
import type { ProjectStatus } from "@/lib/supabase/schema";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Projects — Archer",
};

interface ProjectListItem {
  id: string;
  name: string;
  status: ProjectStatus;
}

async function loadProjects(): Promise<ProjectListItem[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, status")
      .order("created_at", { ascending: false });

    if (error || !data) return [];
    return data as ProjectListItem[];
  } catch {
    return [];
  }
}

function EmptyState() {
  return (
    <div className="flex flex-col items-start gap-4 rounded-[var(--radius-md)] border border-border bg-surface p-[var(--spacing-card-p)]">
      <p className="text-text-secondary">No projects yet.</p>
      <Link
        href="/app/projects/new"
        className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] bg-primary px-4 py-2 font-medium text-text-inverse transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
      >
        New project
      </Link>
    </div>
  );
}

export default async function ProjectsPage() {
  const projects = await loadProjects();

  return (
    <section className="flex flex-col gap-[var(--spacing-section-y)]">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-[length:var(--font-size-section)] font-bold text-text-primary">
          Projects
        </h1>
        <Link
          href="/app/projects/new"
          className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] bg-primary px-4 py-2 font-medium text-text-inverse transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
        >
          New project
        </Link>
      </header>

      {projects.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="flex flex-col gap-3">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/app/projects/${project.id}`}
                className="flex min-h-[44px] items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border bg-surface-raised p-[var(--spacing-card-p)] transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
              >
                <span className="min-w-0 break-words font-semibold text-text-primary">
                  {project.name}
                </span>
                <StatusBadge status={project.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}