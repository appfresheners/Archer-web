import FocusManager, {
  type FocusAreaData,
  type FocusGoalData,
  type FocusProjectData,
} from "@/components/focus/FocusManager";
import ReadErrorState from "@/components/shared/ReadErrorState";
import type { ReadListResult } from "@/lib/read-result";
import type {
  AreaOfFocus,
  FocusProfile,
  GoalStatus,
  ProjectStatus,
} from "@/lib/supabase/schema";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Focus — Archer" };

interface FocusPageData {
  profile: Pick<FocusProfile, "vision" | "purpose" | "principles"> | null;
  areas: FocusAreaData[];
  goals: FocusGoalData[];
  projects: FocusProjectData[];
}

interface GoalRecord {
  id: string;
  area_id: string;
  goal_text: string;
  status: GoalStatus;
}

interface ProjectRecord {
  id: string;
  area_id: string;
  name: string;
  status: ProjectStatus;
  goal_id: null;
}

async function loadFocus(): Promise<ReadListResult<FocusPageData>> {
  try {
    const supabase = await createClient();
    const [profileResult, areasResult] = await Promise.all([
      supabase
        .from("focus_profiles")
        .select("vision, purpose, principles")
        .maybeSingle(),
      supabase
        .from("areas_of_focus")
        .select("id, name, description, sort_order, archived_at")
        .order("sort_order", { ascending: true }),
    ]);

    if (profileResult.error || areasResult.error) return { status: "error" };

    const areas = (areasResult.data ?? []) as Pick<
      AreaOfFocus,
      "id" | "name" | "description" | "sort_order" | "archived_at"
    >[];
    let goals: GoalRecord[] = [];
    let projects: ProjectRecord[] = [];

    if (areas.length > 0) {
      const areaIds = areas.map((area) => area.id);
      const [goalsResult, projectsResult] = await Promise.all([
        supabase
          .from("goals")
          .select("id, area_id, goal_text, status")
          .in("area_id", areaIds),
        supabase
          .from("projects")
          .select("id, area_id, name, status, goal_id")
          .is("goal_id", null)
          .in("area_id", areaIds),
      ]);
      if (goalsResult.error || projectsResult.error) return { status: "error" };
      goals = ((goalsResult.data ?? []) as GoalRecord[]).sort((a, b) =>
        a.goal_text.localeCompare(b.goal_text),
      );
      projects = ((projectsResult.data ?? []) as ProjectRecord[]).sort((a, b) =>
        a.name.localeCompare(b.name),
      );
    }

    return {
      status: "ok",
      data: {
        profile: profileResult.data
          ? (profileResult.data as Pick<FocusProfile, "vision" | "purpose" | "principles">)
          : null,
        areas: areas as FocusAreaData[],
        goals,
        projects,
      },
    };
  } catch {
    return { status: "error" };
  }
}

export default async function FocusPage() {
  const result = await loadFocus();
  if (result.status === "error") return <ReadErrorState />;

  return (
    <FocusManager
      profile={result.data.profile}
      areas={result.data.areas}
      goals={result.data.goals}
      projects={result.data.projects}
    />
  );
}