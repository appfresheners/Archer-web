import { describe, expect, it } from "vitest";
import { validateManualProject } from "./create";

const UUID = "66666666-6666-4666-8666-666666666666";

describe("validateManualProject", () => {
  it("accepts a name with all optional fields omitted", () => {
    expect(validateManualProject({ name: "  Launch a newsletter  " })).toEqual({
      name: "Launch a newsletter",
      purpose: null,
      successful_outcome: null,
      goal_id: null,
    });
  });

  it("trims and keeps optional purpose and successful outcome", () => {
    expect(
      validateManualProject({
        name: "Run a marathon",
        purpose: "  Get fit  ",
        successful_outcome: "  Finish under 4h  ",
      }),
    ).toEqual({
      name: "Run a marathon",
      purpose: "Get fit",
      successful_outcome: "Finish under 4h",
      goal_id: null,
    });
  });

  it("coerces blank optional fields to null", () => {
    expect(
      validateManualProject({
        name: "X",
        purpose: "   ",
        successful_outcome: "",
      }),
    ).toEqual({
      name: "X",
      purpose: null,
      successful_outcome: null,
      goal_id: null,
    });
  });

  it("accepts a uuid goal_id", () => {
    expect(validateManualProject({ name: "X", goal_id: UUID })).toEqual({
      name: "X",
      purpose: null,
      successful_outcome: null,
      goal_id: UUID,
    });
  });

  it("accepts an explicit null goal_id", () => {
    expect(validateManualProject({ name: "X", goal_id: null })).toEqual({
      name: "X",
      purpose: null,
      successful_outcome: null,
      goal_id: null,
    });
  });

  it("rejects a missing, blank, over-long, or non-string name", () => {
    expect(validateManualProject({})).toBeNull();
    expect(validateManualProject({ name: "" })).toBeNull();
    expect(validateManualProject({ name: "   " })).toBeNull();
    expect(validateManualProject({ name: "x".repeat(201) })).toBeNull();
    expect(validateManualProject({ name: 5 })).toBeNull();
  });

  it("rejects a non-uuid goal_id", () => {
    expect(validateManualProject({ name: "X", goal_id: "nope" })).toBeNull();
    expect(validateManualProject({ name: "X", goal_id: 5 })).toBeNull();
  });

  it("rejects non-string optional text fields", () => {
    expect(validateManualProject({ name: "X", purpose: 5 })).toBeNull();
    expect(validateManualProject({ name: "X", successful_outcome: [] })).toBeNull();
  });

  it("rejects non-object bodies", () => {
    expect(validateManualProject(null)).toBeNull();
    expect(validateManualProject([])).toBeNull();
    expect(validateManualProject("name")).toBeNull();
  });
});
