import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Pagination from "./Pagination";

describe("Pagination", () => {
  it("renders result totals, current page, and preserves query parameters", () => {
    render(
      <Pagination
        action="/app/projects"
        page={2}
        total={87}
        searchParams={{ goal: "goal-1", q: "forest", page: "2" }}
      />,
    );

    expect(screen.getByText("Showing 21-40 of 87")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Pagination" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to page 2" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Go to page 3" })).toHaveAttribute(
      "href",
      "/app/projects?goal=goal-1&q=forest&page=3",
    );
  });

  it("shows a zero total and one current page for empty results", () => {
    render(
      <Pagination action="/app/inbox" page={1} total={0} searchParams={{ q: "x" }} />,
    );

    expect(screen.getByText("Showing 0-0 of 0")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to page 1" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByLabelText("Previous page")).toHaveAttribute("aria-disabled", "true");
  });

  it("supports independent section query keys", () => {
    render(
      <Pagination
        action="/app/someday"
        page={1}
        total={25}
        pageKey="inboxPage"
        searchParams={{ inboxQ: "seed", inboxPage: "1", projectsPage: "2" }}
      />,
    );

    expect(screen.getByRole("link", { name: "Go to page 2" })).toHaveAttribute(
      "href",
      "/app/someday?inboxQ=seed&projectsPage=2&inboxPage=2",
    );
  });
});