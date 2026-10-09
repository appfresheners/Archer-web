import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ListSearch from "./ListSearch";

describe("ListSearch", () => {
  it("preserves unrelated filters and starts a fresh search without the page", () => {
    const { container } = render(
      <ListSearch
        action="/app/projects"
        label="Search Projects"
        query="forest"
        searchParams={{ goal: "goal-1", q: "forest", page: "4", tag: ["a", "b"] }}
      />,
    );

    expect(screen.getByRole("searchbox", { name: "Search Projects" })).toHaveValue(
      "forest",
    );
    const form = container.querySelector("form");
    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", "/app/projects");
    expect(form?.querySelector('[name="page"]')).not.toBeInTheDocument();
    expect(form?.querySelectorAll('[name="tag"]')).toHaveLength(2);
  });

  it("clears only its query and page keys", () => {
    render(
      <ListSearch
        action="/app/someday"
        label="Search parked items"
        query="seed"
        queryKey="inboxQ"
        pageKey="inboxPage"
        searchParams={{ inboxQ: "seed", inboxPage: "2", projectsPage: "3" }}
      />,
    );

    expect(screen.getByRole("link", { name: "Clear search" })).toHaveAttribute(
      "href",
      "/app/someday?projectsPage=3",
    );
  });
});