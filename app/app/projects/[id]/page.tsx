/**
 * Project detail view (server component) inside the authenticated `/app` shell.
 *
 * Loads the project row + its parent goal (for a breadcrumb) + its actions by
 * id through the server Supabase client. RLS is default-deny scoped to
 * `auth.uid()`, so the queries return rows only when the signed-in user owns
 * them — a nonexistent id OR another user's id both yield no row, which we
 * render as a 404 via `notFound()`. The saved rows are the single source of
 * truth: everything is rendered from STRUCTURED data (scalar columns +
 * `planning_detail` JSON + `actions` rows). No markdown is stored or rendered.
 *
 * Interactivity (edit, status change, regenerate) is owned by
 * `ProjectDetailClient`, which mutates via `/api/projects/[id]` and refreshes.
 *
 * The `/app` layout already enforces auth, so no auth check is repeated here.
 */

import StatusBadge from "@/components/goals/StatusBadge";
import type {
    Action,
    PlanningDetail,
    ProjectStatus,
} from "@/lib/supabase/schema";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ProjectDetailClient, {
    type ProjectHeaderData,
} from "./ProjectDetailClient";

interface ProjectDetailPageProps {
    params: Promise<{ id: string }>;
}

interface LoadedProject {
    id: string;
    name: string;
    goal_id: string | null;
    status: ProjectStatus;
    purpose: string | null;
    successful_outcome: string | null;
    planning_depth: "minimal" | "full_gtd";
    planning_detail: PlanningDetail | null;
    goalText: string | null;
    actions: Pick<Action, "id" | "text" | "sort_order">[];
}

/** Fetch the RLS-scoped project + parent goal + ordered actions, or null. */
async function loadProject(id: string): Promise<LoadedProject | null> {
    try {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from("projects")
            .select(
                "id, name, goal_id, status, purpose, successful_outcome, planning_depth, planning_detail"
            )
            .eq("id", id)
            .maybeSingle();

        if (error || !data) {
            return null;
        }

        // Parent goal text for the breadcrumb (goal-less projects skip this).
        let goalText: string | null = null;
        if (data.goal_id) {
            const { data: goal } = await supabase
                .from("goals")
                .select("goal_text")
                .eq("id", data.goal_id)
                .maybeSingle();
            goalText = goal?.goal_text ?? null;
        }

        const { data: actions } = await supabase
            .from("actions")
            .select("id, text, sort_order")
            .eq("project_id", id)
            .order("sort_order", { ascending: true });

        return { ...data, goalText, actions: actions ?? [] };
    } catch {
        return null;
    }
}

export async function generateMetadata({
    params,
}: ProjectDetailPageProps): Promise<Metadata> {
    const { id } = await params;
    const project = await loadProject(id);
    return {
        title: project ? `${project.name} — Archer` : "Project — Archer",
    };
}

/** A titled prose section, rendered only when it has content. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="flex flex-col gap-2">
            <h2 className="text-[length:var(--font-size-subheading)] font-semibold text-text-primary">
                {title}
            </h2>
            {children}
        </section>
    );
}

/** A collapsible prose section (keyboard-native via <details>). */
function Collapsible({
    title,
    children,
    defaultOpen,
}: {
    title: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
}) {
    return (
        <details
            open={defaultOpen}
            className="rounded-[var(--radius-md)] border border-border bg-surface-raised"
        >
            <summary className="cursor-pointer rounded-[var(--radius-md)] px-[var(--spacing-card-p)] py-3 text-[length:var(--font-size-subheading)] font-semibold text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]">
                {title}
            </summary>
            <div className="px-[var(--spacing-card-p)] pb-[var(--spacing-card-p)] pt-1 text-text-primary">
                {children}
            </div>
        </details>
    );
}

/** A bullet list section, rendered only when the list is non-empty. */
function ListSection({ title, items }: { title: string; items: string[] }) {
    if (items.length === 0) return null;
    return (
        <Section title={title}>
            <ul className="flex list-disc flex-col gap-1 pl-6 text-text-primary">
                {items.map((item, i) => (
                    <li key={i}>{item}</li>
                ))}
            </ul>
        </Section>
    );
}

export default async function ProjectDetailPage({
    params,
}: ProjectDetailPageProps) {
    const { id } = await params;
    const project = await loadProject(id);

    if (!project) {
        notFound();
    }

    const detail = project.planning_detail;
    const header: ProjectHeaderData = {
        id: project.id,
        name: project.name,
        purpose: project.purpose,
        successful_outcome: project.successful_outcome,
        status: project.status,
    };

    return (
        <article className="flex flex-col gap-[var(--spacing-section-y)]">
            <header className="flex flex-col gap-3">
                {/* Parent-goal breadcrumb (only for goal-linked projects). */}
                <nav aria-label="Breadcrumb" className="text-[length:var(--font-size-small)] text-text-secondary">
                    {project.goal_id && project.goalText ? (
                        <Link
                            href={`/app/goals/${project.goal_id}`}
                            className="hover:text-text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                        >
                            ← {project.goalText}
                        </Link>
                    ) : (
                        <Link
                            href="/app/goals"
                            className="hover:text-text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                        >
                            ← Goals
                        </Link>
                    )}
                </nav>

                <div className="flex flex-col gap-2">
                    <h1 className="text-[length:var(--font-size-section)] font-bold text-text-primary">
                        {project.name}
                    </h1>
                    <div className="flex flex-wrap items-center gap-3">
                        <StatusBadge status={project.status} />
                        <span className="w-fit rounded-[var(--radius-full)] bg-primary-subtle px-3 py-1 text-[length:var(--font-size-caption)] font-medium text-primary">
                            {project.planning_depth === "full_gtd" ? "Full GTD" : "Minimal"}
                        </span>
                    </div>
                </div>

                <ProjectDetailClient project={header} />
            </header>

            {project.purpose && (
                <Collapsible title="Purpose" defaultOpen>
                    <p>{project.purpose}</p>
                </Collapsible>
            )}

            {/* Full-GTD Natural Planning extras (structured JSON). */}
            {detail && <ListSection title="Principles" items={detail.principles} />}

            {detail?.vision && (
                <Section title="Vision">
                    <p className="text-text-primary">{detail.vision}</p>
                </Section>
            )}

            {project.successful_outcome && (
                <Collapsible title="Successful Outcome" defaultOpen>
                    <p>{project.successful_outcome}</p>
                </Collapsible>
            )}

            {detail && <ListSection title="Ideas & Brainstorming" items={detail.ideas} />}
            {detail && <ListSection title="Organizing" items={detail.organizing} />}

            {project.actions.length > 0 && (
                <Section title="Next Actions">
                    <ul className="flex flex-col gap-2">
                        {project.actions.map((action) => (
                            <li key={action.id} className="flex items-start gap-2 text-text-primary">
                                <input
                                    type="checkbox"
                                    disabled
                                    aria-label={action.text}
                                    className="mt-1 h-4 w-4 shrink-0"
                                />
                                <span>{action.text}</span>
                            </li>
                        ))}
                    </ul>
                </Section>
            )}
        </article>
    );
}
