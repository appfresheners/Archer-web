import { describe, expect, it } from "vitest";
import {
  buildEngageModel,
  type EngageActionInput,
  type EngageGoalInput,
  type EngageProjectInput,
} from "./model";

const TODAY = "2026-09-28";

// --- Fixtures --------------------------------------------------------------

function goal(overrides: Partial<EngageGoalInput> = {}): EngageGoalInput {
  return {
    id: "g1",
    goal_text: "Launch freelance career",
    status: "active",
    ...overrides,
  };
}

function project(overrides: Partial<EngageProjectInput> = {}): EngageProjectInput {
  return {
    id: "p1",
    goal_id: "g1",
    name: "Portfolio site live",
    status: "active",
    ...overrides,
  };
}

function action(overrides: Partial<EngageActionInput> = {}): EngageActionInput {
  return {
    id: "a1",
    project_id: "p1",
    text: "Write the intro",
    status: "committed",
    context_tags: null,
    scheduled_for: null,
    sort_order: 0,
    ...overrides,
  };
}

// --- Matrix: Render committed actions --------------------------------------

describe("buildEngageModel — render committed actions", () => {
  it("groups committed rows by goal, carrying text, tags, projectId + name", () => {
    const model = buildEngageModel(
      [goal()],
      [project()],
      [action({ id: "a1", context_tags: ["@location:home"] })],
      TODAY,
    );

    expect(model.goalGroups).toHaveLength(1);
    const group = model.goalGroups[0];
    expect(group.goalId).toBe("g1");
    expect(group.goalText).toBe("Launch freelance career");
    expect(group.committed).toEqual([
      {
        id: "a1",
        text: "Write the intro",
        context_tags: ["@location:home"],
        projectId: "p1",
        projectName: "Portfolio site live",
      },
    ]);
    expect(model.isEmpty).toBe(false);
  });

  it("shows ONLY committed actions — available/done are excluded from rows", () => {
    const model = buildEngageModel(
      [goal()],
      [project()],
      [
        action({ id: "a1", status: "committed" }),
        action({ id: "a2", status: "available" }),
        action({ id: "a3", status: "done" }),
      ],
      TODAY,
    );
    expect(model.goalGroups[0].committed.map((r) => r.id)).toEqual(["a1"]);
  });

  it("orders committed rows by sort_order within a goal", () => {
    const model = buildEngageModel(
      [goal()],
      [project(), project({ id: "p2", name: "Second" })],
      [
        action({ id: "late", project_id: "p2", sort_order: 5 }),
        action({ id: "early", project_id: "p1", sort_order: 1 }),
      ],
      TODAY,
    );
    expect(model.goalGroups[0].committed.map((r) => r.id)).toEqual([
      "early",
      "late",
    ]);
  });
});

// --- Matrix: active-only scoping -------------------------------------------

describe("buildEngageModel — active-only scoping", () => {
  it("excludes non-active goals entirely", () => {
    for (const status of [
      "paused",
      "not_now",
      "someday",
      "completed",
      "archived",
    ] as const) {
      const model = buildEngageModel(
        [goal({ status })],
        [project()],
        [action()],
        TODAY,
      );
      expect(model.goalGroups).toHaveLength(0);
      expect(model.isEmpty).toBe(true);
    }
  });

  it("excludes non-active projects from a goal group", () => {
    for (const status of ["paused", "completed", "archived"] as const) {
      const model = buildEngageModel(
        [goal()],
        [project({ status })],
        [action()],
        TODAY,
      );
      expect(model.goalGroups[0].committed).toHaveLength(0);
      expect(model.goalGroups[0].stuckProjects).toHaveLength(0);
    }
  });
});

// --- Matrix: prompt — remaining available actions --------------------------

describe("buildEngageModel — available actions for the next-action prompt", () => {
  it("carries a project's remaining available actions keyed by project id", () => {
    const model = buildEngageModel(
      [goal()],
      [project()],
      [
        action({ id: "a1", status: "committed" }),
        action({ id: "a2", status: "available", text: "Draft", sort_order: 2 }),
        action({ id: "a3", status: "available", text: "Ship", sort_order: 1 }),
        action({ id: "a4", status: "done" }),
      ],
      TODAY,
    );
    // Ordered by sort_order; only available actions; done/committed excluded.
    expect(model.goalGroups[0].availableByProject["p1"]).toEqual([
      { id: "a3", text: "Ship" },
      { id: "a2", text: "Draft" },
    ]);
  });

  it("yields an empty available list when none remain (offer complete project)", () => {
    const model = buildEngageModel(
      [goal()],
      [project()],
      [action({ id: "a1", status: "committed" })],
      TODAY,
    );
    expect(model.goalGroups[0].availableByProject["p1"]).toEqual([]);
  });
});

// --- Matrix: stuck project placement ---------------------------------------

describe("buildEngageModel — stuck project placement", () => {
  it("lists an active zero-committed project under its goal's stuckProjects", () => {
    const model = buildEngageModel(
      [goal()],
      [project()],
      [action({ status: "available" })],
      TODAY,
    );
    expect(model.goalGroups[0].committed).toHaveLength(0);
    expect(model.goalGroups[0].stuckProjects).toEqual([
      { id: "p1", name: "Portfolio site live" },
    ]);
    // A stuck project keeps isEmpty false even with no committed rows.
    expect(model.isEmpty).toBe(false);
  });

  it("a project with a committed action is NOT stuck", () => {
    const model = buildEngageModel(
      [goal()],
      [project()],
      [action({ status: "committed" })],
      TODAY,
    );
    expect(model.goalGroups[0].stuckProjects).toHaveLength(0);
  });

  it("an active project with no actions at all is stuck", () => {
    const model = buildEngageModel([goal()], [project()], [], TODAY);
    expect(model.goalGroups[0].stuckProjects).toEqual([
      { id: "p1", name: "Portfolio site live" },
    ]);
  });
});

// --- Matrix: standalone → Anytime ------------------------------------------

describe("buildEngageModel — standalone actions (Anytime / No project)", () => {
  it("collects standalone committed actions under `anytime`", () => {
    const model = buildEngageModel(
      [goal()],
      [project()],
      [
        action({ id: "a1", status: "committed" }),
        action({
          id: "s1",
          project_id: null,
          text: "Call the bank",
          status: "committed",
        }),
      ],
      TODAY,
    );
    expect(model.anytime).toEqual([
      {
        id: "s1",
        text: "Call the bank",
        context_tags: [],
        projectId: null,
        projectName: null,
      },
    ]);
  });

  it("standalone committed action alone keeps isEmpty false", () => {
    const model = buildEngageModel(
      [],
      [],
      [action({ id: "s1", project_id: null, status: "committed" })],
      TODAY,
    );
    expect(model.anytime).toHaveLength(1);
    expect(model.isEmpty).toBe(false);
  });

  it("only committed standalone actions appear (available/done excluded)", () => {
    const model = buildEngageModel(
      [],
      [],
      [
        action({ id: "s1", project_id: null, status: "available" }),
        action({ id: "s2", project_id: null, status: "done" }),
      ],
      TODAY,
    );
    expect(model.anytime).toHaveLength(0);
  });
});

// --- Matrix: exclude waiting / future scheduled ----------------------------

describe("buildEngageModel — exclude waiting / future scheduled", () => {
  it("excludes waiting standalone actions from anytime", () => {
    const model = buildEngageModel(
      [],
      [],
      [action({ id: "s1", project_id: null, status: "waiting" })],
      TODAY,
    );
    expect(model.anytime).toHaveLength(0);
  });

  it("excludes a future-scheduled committed standalone action", () => {
    const model = buildEngageModel(
      [],
      [],
      [
        action({
          id: "s1",
          project_id: null,
          status: "committed",
          scheduled_for: "2999-01-01",
        }),
      ],
      TODAY,
    );
    expect(model.anytime).toHaveLength(0);
  });

  it("keeps a committed action scheduled for today or the past", () => {
    const model = buildEngageModel(
      [],
      [],
      [
        action({
          id: "today",
          project_id: null,
          status: "committed",
          scheduled_for: TODAY,
        }),
        action({
          id: "past",
          project_id: null,
          status: "committed",
          scheduled_for: "2000-01-01",
        }),
      ],
      TODAY,
    );
    expect(model.anytime.map((r) => r.id).sort()).toEqual(["past", "today"]);
  });

  it("excludes a future-scheduled committed PROJECT action from the do-now list", () => {
    const model = buildEngageModel(
      [goal()],
      [project()],
      [
        action({
          id: "future",
          status: "committed",
          scheduled_for: "2999-01-01",
        }),
      ],
      TODAY,
    );
    // Not shown as a committed row; and since no committed remains the project
    // is stuck (zero committed by the stuck rule, which ignores scheduling).
    expect(model.goalGroups[0].committed).toHaveLength(0);
  });
});

// --- Matrix: empty ----------------------------------------------------------

describe("buildEngageModel — empty (all caught up)", () => {
  it("is empty when there are no committed rows and no stuck projects", () => {
    const model = buildEngageModel(
      [goal()],
      [project({ status: "completed" })],
      [action({ status: "done" })],
      TODAY,
    );
    expect(model.goalGroups[0].committed).toHaveLength(0);
    expect(model.goalGroups[0].stuckProjects).toHaveLength(0);
    expect(model.anytime).toHaveLength(0);
    expect(model.isEmpty).toBe(true);
  });

  it("is empty with no data at all", () => {
    const model = buildEngageModel([], [], [], TODAY);
    expect(model.isEmpty).toBe(true);
    expect(model.goalGroups).toHaveLength(0);
    expect(model.anytime).toHaveLength(0);
  });
});
