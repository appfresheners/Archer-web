import SomedayActions from "@/components/someday/SomedayActions";
import Breadcrumbs from "@/components/shared/Breadcrumbs";
import ListSearch from "@/components/shared/ListSearch";
import Pagination from "@/components/shared/Pagination";
import ReadErrorState from "@/components/shared/ReadErrorState";
import StatusBadge from "@/components/goals/StatusBadge";
import {
  clampPage,
  escapeIlikePattern,
  escapePostgrestFilterValue,
  getPageRange,
  LIST_PAGE_SIZE,
  parseListQuery,
  type ListSearchParams,
} from "@/lib/lists/search-pagination";
import type { ReadListResult } from "@/lib/read-result";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Someday / Maybe — Archer",
};

interface ParkedInboxItem {
  id: string;
  raw_text: string;
  processing_status: string;
  captured_at: string;
}

interface SomedayProject {
  id: string;
  name: string;
  status: "someday";
  parent_goal_text: string | null;
}

interface SomedayGoal {
  id: string;
  goal_text: string;
  status: "someday";
}

interface LoadedRows<Row> {
  rows: Row[];
  page: number;
  total: number;
}

interface LoadedSomeday {
  items: LoadedRows<ParkedInboxItem> & { query: string };
  projects: LoadedRows<SomedayProject> & { query: string };
  goals: LoadedRows<SomedayGoal> & { query: string };
}

type RangedResult<Row> = {
  data: Row[] | null;
  count: number | null;
  error: unknown | null;
};

async function loadClampedRows<Row>(
  requestedPage: number,
  loadPage: (page: number) => PromiseLike<RangedResult<Row>>,
): Promise<ReadListResult<LoadedRows<Row>>> {
  let page = requestedPage;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const result = await loadPage(page);
    if (result.error || result.count == null || result.data == null) {
      return { status: "error" };
    }

    const clampedPage = clampPage(page, result.count);
    if (clampedPage !== page) {
      page = clampedPage;
      continue;
    }

    return {
      status: "ok",
      data: { rows: result.data, page, total: result.count },
    };
  }

  return { status: "error" };
}

async function loadSomeday(
  searchParams: ListSearchParams,
): Promise<ReadListResult<LoadedSomeday>> {
  try {
    const supabase = await createClient();
    const itemState = parseListQuery(searchParams, "q_items", "page_items");
    const projectState = parseListQuery(searchParams, "q_projects", "page_projects");
    const goalState = parseListQuery(searchParams, "q_goals", "page_goals");

    const loadItemsPage = (page: number) => {
      const { from, to } = getPageRange(page);
      let request = supabase
        .from("inbox_items")
        .select("id, raw_text, processing_status, captured_at", { count: "exact" })
        .eq("processing_status", "someday");
      if (itemState.query) {
        request = request.ilike("raw_text", escapeIlikePattern(itemState.query));
      }
      return request
        .order("captured_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to);
    };

    const loadProjectsPage = (page: number) => {
      const { from, to } = getPageRange(page);
      let request = supabase
        .from("project_search")
        .select("id, name, status, parent_goal_text, created_at", {
          count: "exact",
        })
        .eq("status", "someday");
      if (projectState.query) {
        const pattern = escapePostgrestFilterValue(
          escapeIlikePattern(projectState.query),
        );
        request = request.or(
          `name.ilike."${pattern}",parent_goal_text.ilike."${pattern}"`,
        );
      }
      return request
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to);
    };

    const loadGoalsPage = (page: number) => {
      const { from, to } = getPageRange(page);
      let request = supabase
        .from("goals")
        .select("id, goal_text, status, created_at", { count: "exact" })
        .eq("status", "someday");
      if (goalState.query) {
        request = request.ilike("goal_text", escapeIlikePattern(goalState.query));
      }
      return request
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to);
    };

    const [itemsResult, projectsResult, goalsResult] = await Promise.all([
      loadClampedRows(itemState.page, loadItemsPage),
      loadClampedRows(projectState.page, loadProjectsPage),
      loadClampedRows(goalState.page, loadGoalsPage),
    ]);

    if (
      itemsResult.status === "error" ||
      projectsResult.status === "error" ||
      goalsResult.status === "error"
    ) {
      return { status: "error" };
    }

    return {
      status: "ok",
      data: {
        items: { ...itemsResult.data, rows: itemsResult.data.rows as ParkedInboxItem[], query: itemState.query },
        projects: { ...projectsResult.data, rows: projectsResult.data.rows as SomedayProject[], query: projectState.query },
        goals: { ...goalsResult.data, rows: goalsResult.data.rows as SomedayGoal[], query: goalState.query },
      },
    };
  } catch {
    return { status: "error" };
  }
}

function NoMatches({ query }: { query: string }) {
  return (
    <p className="break-words rounded-[var(--radius-md)] border border-border bg-surface p-[var(--spacing-card-p)] text-text-secondary">
      No matches for &apos;{query}&apos;.
    </p>
  );
}

export default async function SomedayPage({
  searchParams,
}: {
  searchParams: Promise<ListSearchParams>;
}) {
  const params = await searchParams;
  const result = await loadSomeday(params);

  if (result.status === "error") {
    return (
      <section className="flex flex-col gap-[var(--spacing-section-y)]">
        <Breadcrumbs items={[{ label: "Someday" }]} />
        <ReadErrorState />
      </section>
    );
  }

  const { items, projects, goals } = result.data;

  return (
    <section className="flex flex-col gap-[var(--spacing-section-y)]">
      <Breadcrumbs items={[{ label: "Someday" }]} />
      <h1 className="text-[length:var(--font-size-section)] font-bold text-text-primary">
        Someday / Maybe
      </h1>

      <section aria-labelledby="parked-items-heading" className="flex flex-col gap-4">
        <h2
          id="parked-items-heading"
          className="text-[length:var(--font-size-card)] font-semibold text-text-primary"
        >
          Parked items ({items.total})
        </h2>
        <ListSearch
          action="/app/someday"
          label="Search parked items"
          query={items.query}
          searchParams={params}
          queryKey="q_items"
          pageKey="page_items"
        />
        {items.query && items.total === 0 ? (
          <NoMatches query={items.query} />
        ) : items.total === 0 ? (
          <p className="text-text-secondary" role="status">No parked items.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.rows.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-border bg-surface-raised p-[var(--spacing-card-p)] sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="break-words text-text-primary">{item.raw_text}</p>
                <SomedayActions id={item.id} label={item.raw_text} type="item" />
              </li>
            ))}
          </ul>
        )}
        <Pagination
          action="/app/someday"
          page={items.page}
          total={items.total}
          pageSize={LIST_PAGE_SIZE}
          searchParams={params}
          pageKey="page_items"
        />
      </section>

      <section aria-labelledby="someday-projects-heading" className="flex flex-col gap-4">
        <h2
          id="someday-projects-heading"
          className="text-[length:var(--font-size-card)] font-semibold text-text-primary"
        >
          Someday projects ({projects.total})
        </h2>
        <ListSearch
          action="/app/someday"
          label="Search Someday projects"
          query={projects.query}
          searchParams={params}
          queryKey="q_projects"
          pageKey="page_projects"
        />
        {projects.query && projects.total === 0 ? (
          <NoMatches query={projects.query} />
        ) : projects.total === 0 ? (
          <p className="text-text-secondary" role="status">No Someday projects.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {projects.rows.map((project) => (
              <li
                key={project.id}
                className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-border bg-surface-raised p-[var(--spacing-card-p)] sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <Link
                    href={`/app/projects/${project.id}`}
                    className="min-h-[44px] break-words font-semibold text-text-primary underline-offset-4 hover:underline focus-visible:rounded-[var(--radius-sm)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                  >
                    {project.name}
                  </Link>
                  <StatusBadge status={project.status} />
                  {project.parent_goal_text && (
                    <span className="w-full text-[length:var(--font-size-small)] text-text-secondary">
                      {project.parent_goal_text}
                    </span>
                  )}
                </div>
                <SomedayActions id={project.id} label={project.name} type="project" />
              </li>
            ))}
          </ul>
        )}
        <Pagination
          action="/app/someday"
          page={projects.page}
          total={projects.total}
          pageSize={LIST_PAGE_SIZE}
          searchParams={params}
          pageKey="page_projects"
        />
      </section>

      <section aria-labelledby="someday-goals-heading" className="flex flex-col gap-4">
        <h2
          id="someday-goals-heading"
          className="text-[length:var(--font-size-card)] font-semibold text-text-primary"
        >
          Someday goals ({goals.total})
        </h2>
        <ListSearch
          action="/app/someday"
          label="Search Someday goals"
          query={goals.query}
          searchParams={params}
          queryKey="q_goals"
          pageKey="page_goals"
        />
        {goals.query && goals.total === 0 ? (
          <NoMatches query={goals.query} />
        ) : goals.total === 0 ? (
          <p className="text-text-secondary" role="status">No Someday goals.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {goals.rows.map((goal) => (
              <li key={goal.id}>
                <Link
                  href={`/app/goals/${goal.id}`}
                  className="flex min-h-[44px] items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border bg-surface-raised p-[var(--spacing-card-p)] transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                >
                  <span className="min-w-0 break-words font-semibold text-text-primary">
                    {goal.goal_text}
                  </span>
                  <StatusBadge status={goal.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Pagination
          action="/app/someday"
          page={goals.page}
          total={goals.total}
          pageSize={LIST_PAGE_SIZE}
          searchParams={params}
          pageKey="page_goals"
        />
      </section>
    </section>
  );
}