/**
 * Project detail view (server component) inside the authenticated `/app` shell.
 *
 * Loads the project row by id through the server Supabase client. RLS is
 * default-deny scoped to `auth.uid()`, so the query returns a row only when the
 * signed-in user owns it — a nonexistent id OR another user's id both yield no
 * row, which we render as a 404 via `notFound()`. The saved row is the single
 * source of truth: the stored `breakdown_md` is rendered through the shared
 * `OutputPanel` (Story 2.5 polishes that rendering in one place).
 *
 * The `/app` layout already enforces auth, so no auth check is repeated here.
 * In Next.js 16 the dynamic-route `params` is a Promise and must be awaited.
 */

import OutputPanel from "@/components/OutputPanel";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

interface ProjectDetailPageProps {
    params: Promise<{ id: string }>;
}

/** Fetch the RLS-scoped project (name + breakdown), or null if not found/owned. */
async function loadProject(id: string) {
    try {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from("projects")
            .select("id, name, breakdown_md")
            .eq("id", id)
            .maybeSingle();

        if (error || !data) {
            return null;
        }
        return data;
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

export default async function ProjectDetailPage({
    params,
}: ProjectDetailPageProps) {
    const { id } = await params;
    const project = await loadProject(id);

    if (!project) {
        notFound();
    }

    return (
        <div className="flex flex-col gap-[var(--spacing-section-y)]">
            <h1 className="text-[length:var(--font-size-section)] font-bold text-text-primary">
                {project.name}
            </h1>
            {project.breakdown_md && <OutputPanel markdown={project.breakdown_md} />}
        </div>
    );
}
