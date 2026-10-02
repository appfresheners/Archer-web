import { describe, expect, it } from "vitest";
import {
  buildReviewData,
  type ReviewActionInput,
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
      ],
      [
        action({ id: "a1", project_id: "p1", status: "committed", text: "Do X" }),
        action({ id: "a2", project_id: "p1", status: "available", text: "Later", sort_order: 1 }),
        // p3 has only available actions → stuck.
        action({ id: "a3", project_id: "p3", status: "available", text: "Start", sort_order: 0 }),
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
});

describe("buildReviewData — goalAlignment (Get Creative)", () => {
  it("lists ACTIVE goals with their active-project + stuck counts", () => {
    const data = buildReviewData(
      [],
      [
        project({ id: "p1", status: "active", goal_id: "g1" }), // committed → not stuck
        project({ id: "p2", status: "active", goal_id: "g1" }), // stuck
        project({ id: "p3", status: "paused", goal_id: "g1" }), // excluded (not active)
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
