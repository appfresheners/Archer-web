import { describe, expect, it } from "vitest";
import { isoWeek, weekBounds } from "./week";

// Dates are constructed in UTC so tests are timezone-stable regardless of the
// machine running them.
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

describe("isoWeek", () => {
  it("computes a mid-year week (Thursday 2026-09-24 → week 39 of 2026)", () => {
    expect(isoWeek(utc(2026, 9, 24))).toEqual({ week_number: 39, week_year: 2026 });
  });

  it("keeps the whole Mon–Sun span in the same ISO week", () => {
    // 2026-09-21 (Mon) through 2026-09-27 (Sun) are all ISO week 39.
    expect(isoWeek(utc(2026, 9, 21))).toEqual({ week_number: 39, week_year: 2026 });
    expect(isoWeek(utc(2026, 9, 27))).toEqual({ week_number: 39, week_year: 2026 });
  });

  it("handles a Sunday correctly (belongs to the week starting the prior Monday)", () => {
    // 2027-01-03 is a Sunday; it ends ISO week 53 of 2026 (2026 is a 53-week year).
    expect(isoWeek(utc(2027, 1, 3))).toEqual({ week_number: 53, week_year: 2026 });
  });

  it("year-boundary: 2021-01-01 (Fri) is ISO week 53 of 2020", () => {
    expect(isoWeek(utc(2021, 1, 1))).toEqual({ week_number: 53, week_year: 2020 });
  });

  it("year-boundary: 2019-12-30 (Mon) is ISO week 1 of 2020", () => {
    expect(isoWeek(utc(2019, 12, 30))).toEqual({ week_number: 1, week_year: 2020 });
  });

  it("year-boundary: 2023-01-01 (Sun) is ISO week 52 of 2022", () => {
    expect(isoWeek(utc(2023, 1, 1))).toEqual({ week_number: 52, week_year: 2022 });
  });

  it("first week: 2026-01-01 (Thu) is ISO week 1 of 2026", () => {
    expect(isoWeek(utc(2026, 1, 1))).toEqual({ week_number: 1, week_year: 2026 });
  });
});

describe("weekBounds", () => {
  it("returns Monday and Sunday for a mid-week date", () => {
    // 2026-09-24 (Thu) → Mon 2026-09-21, Sun 2026-09-27.
    expect(weekBounds(utc(2026, 9, 24))).toEqual({
      monday: "2026-09-21",
      sunday: "2026-09-27",
    });
  });

  it("returns the same bounds when given the Monday itself", () => {
    expect(weekBounds(utc(2026, 9, 21))).toEqual({
      monday: "2026-09-21",
      sunday: "2026-09-27",
    });
  });

  it("returns the same bounds when given the Sunday (does not roll to next week)", () => {
    expect(weekBounds(utc(2026, 9, 27))).toEqual({
      monday: "2026-09-21",
      sunday: "2026-09-27",
    });
  });

  it("spans a month/year boundary correctly", () => {
    // 2021-01-01 (Fri) is in ISO week 53 of 2020: Mon 2020-12-28 … Sun 2021-01-03.
    expect(weekBounds(utc(2021, 1, 1))).toEqual({
      monday: "2020-12-28",
      sunday: "2021-01-03",
    });
  });
});
