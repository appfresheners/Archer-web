import { describe, expect, it } from "vitest";
import {
  buildReviewData,
  type ReviewActionInput,
  type ReviewAreaInput,
  type ReviewGoalInput,
  type ReviewInboxInput,
  type ReviewProjectInput,
} from "./reviewData";

const inbox = (over: Partial<ReviewInboxInput>): ReviewInboxInput => ({
  id: "i1",
  raw_text: "thing",
  processing_status: "unprocessed",
  ...over,
});
const project = (over: Partial<ReviewProjectInput>): ReviewProjectInput => ({
  id: "p1",
  name: "Project",
  status: "active",
  updated_at: "2026-09-20T00:00:00Z",
  goal_id: null,
  area_id: null,
  ...over,
});
const action = (over: Partial<ReviewActionInput>): ReviewActionInput => ({
  id: "a1",
  project_id: "p1",
  text: "Action",
  status: "available",
  sort_order: 0,
  ...over,
});
const goal = (over: Partial<ReviewGoalInput>): ReviewGoalInput => ({
  id: "g1",
  goal_text: "Goal",
  status: "active",
  area_id: null,
  ...over,
});
const area = (over: Partial<ReviewAreaInput>): ReviewAreaInput => ({
  id: "area-1",
  name: "Health",
  sort_order: 0,
  archived_at: null,
  ...over,
});

describe("buildReviewData — unprocessedCount (Get Clear gate)", () => {
  it("counts only unprocessed inbox items", () => {
    const data = buildReviewData(
      [
        inbox({ id: "i1", processing_status: "unprocessed" }),
        inbox({ id: "i2", processing_status: "unprocessed" }),
        inbox({ id: "i3", processing_status: "someday" }),
        inbox({ id: "i4", processing_status: "processed" }),
        inbox({ id: "i5", processing_status: "reference" }),
      ],
      [],
      [],
      [],
    );
    expect(data.unprocessedCount).toBe(2);
  });

  it("is zero for an empty / fully-processed inbox", () => {
    expect(buildReviewData([], [], [], []).unprocessedCount).toBe(0);
    expect(
      buildReviewData([inbox({ processing_status: "processed" })], [], [], [])
        .unprocessedCount,
    ).toBe(0);
  });
});

describe("buildReviewData — currentProjects (Get Current)", () => {
  it("includes only ACTIVE projects with committed/available/stuck + updatedAt", () => {
    const data = buildReviewData(
      [],
      [
        project({ id: "p1", name: "Alpha", status: "active", updated_at: "2026-09-01T00:00:00Z" }),
        project({ id: "p2", name: "Paused", status: "paused" }),
        project({ id: "p3", name: "Beta", status: "active" }),
        project({ id: "p4", name: "Someday", status: "someday" }),
      ],
      [
        action({ id: "a1", project_id: "p1", status: "committed", text: "Do X" }),
        action({ id: "a2", project_id: "p1", status: "available", text: "Later", sort_order: 1 }),
        // p3 has only available actions → stuck.
        action({ id: "a3", project_id: "p3", status: "available", text: "Start", sort_order: 0 }),
        action({ id: "a4", project_id: "p4", status: "available", text: "Explore" }),
      ],
      [],
    );
    expect(data.currentProjects.map((p) => p.id)).toEqual(["p1", "p3"]);

    const p1 = data.currentProjects[0];
    expect(p1.name).toBe("Alpha");
    expect(p1.updatedAt).toBe("2026-09-01T00:00:00Z");
    expect(p1.committedActionText).toBe("Do X");
    expect(p1.availableActions).toEqual([{ id: "a2", text: "Later" }]);
    expect(p1.isStuck).toBe(false);

    const p3 = data.currentProjects[1];
    expect(p3.committedActionText).toBeNull();
    expect(p3.isStuck).toBe(true);
    expect(p3.availableActions).toEqual([{ id: "a3", text: "Start" }]);
  });

  it("orders available actions by sort_order", () => {
    const data = buildReviewData(
      [],
      [project({ id: "p1", status: "active" })],
      [
        action({ id: "a2", project_id: "p1", status: "available", text: "two", sort_order: 2 }),
        action({ id: "a1", project_id: "p1", status: "available", text: "one", sort_order: 1 }),
      ],
      [],
    );
    expect(data.currentProjects[0].availableActions.map((a) => a.text)).toEqual([
      "one",
      "two",
    ]);
  });
});

describe("buildReviewData — somedayItems (Get Creative)", () => {
  it("returns only someday inbox items", () => {
    const data = buildReviewData(
      [
        inbox({ id: "i1", processing_status: "someday", raw_text: "learn piano" }),
        inbox({ id: "i2", processing_status: "unprocessed" }),
        inbox({ id: "i3", processing_status: "reference" }),
      ],
      [],
      [],
      [],
    );
    expect(data.somedayItems).toEqual([{ id: "i1", raw_text: "learn piano" }]);
  });

  it("returns Someday projects separately from inbox items", () => {
    const data = buildReviewData(
      [inbox({ id: "i1", processing_status: "someday", raw_text: "learn piano" })],
      [
        project({ id: "p1", name: "Learn Italian", status: "someday" }),
        project({ id: "p2", name: "Paused", status: "paused" }),
      ],
      [],
      [],
    );

    expect(data.somedayItems).toEqual([{ id: "i1", raw_text: "learn piano" }]);
    expect(data.somedayProjects).toEqual([{ id: "p1", name: "Learn Italian" }]);
  });
});

describe("buildReviewData — goalAlignment (Get Creative)", () => {
  it("lists ACTIVE goals with their active-project + stuck counts", () => {
    const data = buildReviewData(
      [],
      [
        project({ id: "p1", status: "active", goal_id: "g1" }), // committed → not stuck
        project({ id: "p2", status: "active", goal_id: "g1" }), // stuck
        project({ id: "p3", status: "paused", goal_id: "g1" }), // excluded (not active)
        project({ id: "p4", status: "someday", goal_id: "g1" }), // excluded (not active)
      ],
      [action({ id: "a1", project_id: "p1", status: "committed" })],
      [
        goal({ id: "g1", goal_text: "Ship", status: "active" }),
        goal({ id: "g2", goal_text: "Someday goal", status: "someday" }), // excluded
      ],
    );
    expect(data.goalAlignment).toEqual([
      { id: "g1", goalText: "Ship", projectCount: 2, stuckCount: 1 },
    ]);
  });

  it("is empty when there are no active goals", () => {
    expect(
      buildReviewData([], [], [], [goal({ status: "paused" })]).goalAlignment,
    ).toEqual([]);
  });
});

describe("buildReviewData — Focus roll-up (Get Creative)", () => {
  it("orders Areas and linked records, includes archived Areas, and avoids duplicating Goal projects", () => {
    const data = buildReviewData(
      [],
      [
        project({ id: "direct-z", name: "Zeta standalone", area_id: "area-1" }),
        project({ id: "direct-a", name: "Alpha standalone", area_id: "area-1" }),
        project({ id: "inherited", name: "Goal project", area_id: "area-1", goal_id: "goal-1" }),
        project({ id: "archived-project", name: "Old project", area_id: "area-old" }),
      ],
      [],
      [
        goal({ id: "goal-z", goal_text: "Zeta goal", area_id: "area-1" }),
        goal({ id: "goal-1", goal_text: "Alpha goal", area_id: "area-1" }),
        goal({ id: "old-goal", goal_text: "Old goal", area_id: "area-old", status: "completed" }),
      ],
      [
        area({ id: "area-old", name: "Archived", sort_order: 1, archived_at: "2026-10-01" }),
        area({ id: "area-1", name: "Health", sort_order: 0 }),
      ],
    );

    expect(data.focusAreas).toEqual([
      {
        id: "area-1",
        name: "Health",
        archived_at: null,
        goals: [
          { id: "goal-1", goalText: "Alpha goal", status: "active" },
          { id: "goal-z", goalText: "Zeta goal", status: "active" },
        ],
        projects: [
          { id: "direct-a", name: "Alpha standalone", status: "active" },
          { id: "direct-z", name: "Zeta standalone", status: "active" },
        ],
      },
      {
        id: "area-old",
        name: "Archived",
        archived_at: "2026-10-01",
        goals: [{ id: "old-goal", goalText: "Old goal", status: "completed" }],
        projects: [{ id: "archived-project", name: "Old project", status: "active" }],
      },
    ]);
  });

  it("returns an empty Area roll-up when the user has no Areas", () => {
    const data = buildReviewData([], [], [], []);
    expect(data.focusAreas).toEqual([]);
    expect(data.focusAreasError).toBe(false);
  });
});
