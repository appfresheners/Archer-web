import { describe, expect, it } from "vitest";
import {
  buildListHref,
  clampPage,
  escapeIlikePattern,
  escapePostgrestFilterValue,
  getPageRange,
  LIST_PAGE_SIZE,
  parseListQuery,
} from "./search-pagination";

describe("parseListQuery", () => {
  it("trims the query and parses positive integer pages", () => {
    expect(parseListQuery({ q: "  forest  ", page: "3" })).toEqual({
      query: "forest",
      page: 3,
    });
  });

  it.each([undefined, "", "0", "-2", "2.5", "abc", "9".repeat(40)])(
    "uses page 1 for invalid page %s",
    (page) => {
      expect(parseListQuery({ page }).page).toBe(1);
    },
  );

  it("uses the first value for repeated query parameters and supports custom keys", () => {
    expect(
      parseListQuery({ search: [" one ", "two"], p: ["2", "3"] }, "search", "p"),
    ).toEqual({ query: "one", page: 2 });
  });

  it("treats empty repeated parameter arrays as missing values", () => {
    expect(parseListQuery({ q: [], page: [] })).toEqual({ query: "", page: 1 });
  });

  it("caps pages so their zero-based ranges remain safe integers", () => {
    const page = parseListQuery({ page: String(Number.MAX_SAFE_INTEGER) }).page;
    const range = getPageRange(page);

    expect(Number.isSafeInteger(range.from)).toBe(true);
    expect(Number.isSafeInteger(range.to)).toBe(true);
  });
});

describe("search and pagination helpers", () => {
  it("escapes SQL LIKE wildcards and escape characters", () => {
    expect(escapeIlikePattern("100%_ready\\now")).toBe("%100\\%\\_ready\\\\now%");
  });

  it("quotes values safely for PostgREST filter syntax", () => {
    expect(escapePostgrestFilterValue('a,b("c")\\d')).toBe('a,b(\\"c\\")\\\\d');
  });

  it("calculates zero-based inclusive ranges", () => {
    expect(getPageRange(1)).toEqual({ from: 0, to: LIST_PAGE_SIZE - 1 });
    expect(getPageRange(3, 10)).toEqual({ from: 20, to: 29 });
  });

  it("clamps to the last page and keeps empty results on page 1", () => {
    expect(clampPage(9, 41)).toBe(3);
    expect(clampPage(9, 0)).toBe(1);
  });

  it("preserves unrelated and repeated URL parameters while applying updates", () => {
    expect(
      buildListHref(
        "/app/projects",
        { goal: "g1", q: "old", page: "4", tag: ["a", "b"] },
        { q: "new term", page: 1 },
      ),
    ).toBe("/app/projects?goal=g1&tag=a&tag=b&q=new+term&page=1");
  });

  it("removes selected URL parameters when clearing search", () => {
    expect(
      buildListHref(
        "/app/projects",
        { goal: "g1", q: "forest", page: "2" },
        { q: null, page: null },
      ),
    ).toBe("/app/projects?goal=g1");
  });

  it("preserves URL keys that collide with object prototype properties", () => {
    expect(
      buildListHref(
        "/app/projects",
        { constructor: "keep", goal: "g1" },
        { q: "forest" },
      ),
    ).toBe("/app/projects?constructor=keep&goal=g1&q=forest");
  });
});