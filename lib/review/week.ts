/**
 * Pure ISO-week helpers for the weekly review (Story 5.4).
 *
 * Computes the ISO-8601 week number/year and the Monday/Sunday bounds for a
 * given date — no date library (per the spec's "Ask First" boundary), just the
 * standard ISO algorithm on UTC dates so results are timezone-stable.
 *
 * ISO-8601 rules used here:
 *   - Weeks start on Monday (ISO weekday 1) and end on Sunday (ISO weekday 7).
 *   - Week 1 is the week containing the year's first Thursday (equivalently,
 *     the week containing January 4th).
 *   - `week_year` is the year that owns the ISO week, which can differ from the
 *     calendar year around Jan 1 / Dec 31 (e.g. 2021-01-01 is ISO week 53 of
 *     2020; 2019-12-30 is ISO week 1 of 2020).
 */

export interface IsoWeek {
  week_number: number;
  week_year: number;
}

export interface WeekBounds {
  /** Monday of the ISO week, `YYYY-MM-DD`. */
  monday: string;
  /** Sunday of the ISO week, `YYYY-MM-DD`. */
  sunday: string;
}

/** Milliseconds in one day. */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Normalize any date to midnight UTC of the same calendar day. Working in UTC
 * throughout keeps the arithmetic free of DST/offset surprises.
 */
function utcMidnight(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

/**
 * ISO weekday for a date: Monday = 1 … Sunday = 7 (JS `getUTCDay()` is
 * Sunday = 0 … Saturday = 6).
 */
function isoWeekday(date: Date): number {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

/**
 * ISO week number + week-owning year for the given date.
 *
 * Algorithm: shift the date to the Thursday of its ISO week (the week's year is
 * that Thursday's calendar year), then count weeks from that year's first
 * Thursday.
 */
export function isoWeek(date: Date): IsoWeek {
  const d = utcMidnight(date);
  // Move to the Thursday of the current ISO week: from the current weekday
  // (1..7), step to Thursday (4).
  const thursday = new Date(d.getTime() + (4 - isoWeekday(d)) * DAY_MS);
  const week_year = thursday.getUTCFullYear();

  // First Thursday of that week-year's January.
  const jan1 = new Date(Date.UTC(week_year, 0, 1));
  const jan1Weekday = isoWeekday(jan1);
  const firstThursday = new Date(
    jan1.getTime() + ((4 - jan1Weekday + 7) % 7) * DAY_MS,
  );

  const week_number =
    Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * DAY_MS)) +
    1;

  return { week_number, week_year };
}

/** Format a UTC date as `YYYY-MM-DD`. */
function toDateString(date: Date): string {
  const y = date.getUTCFullYear().toString().padStart(4, "0");
  const m = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const d = date.getUTCDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Monday and Sunday (inclusive) of the ISO week containing `date`, each as a
 * `YYYY-MM-DD` string.
 */
export function weekBounds(date: Date): WeekBounds {
  const d = utcMidnight(date);
  const monday = new Date(d.getTime() - (isoWeekday(d) - 1) * DAY_MS);
  const sunday = new Date(monday.getTime() + 6 * DAY_MS);
  return { monday: toDateString(monday), sunday: toDateString(sunday) };
}
