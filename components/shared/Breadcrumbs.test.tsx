import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Breadcrumbs from "./Breadcrumbs";

describe("Breadcrumbs", () => {
  it("links parent items to their authenticated routes and marks the current page", () => {
    render(
      <Breadcrumbs
        items={[
          { label: "Projects", href: "/app/projects" },
          { label: "Project" },
        ]}
      />,
    );

    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(screen.getAllByRole("navigation", { name: "Breadcrumb" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute(
      "href",
      "/app/projects",
    );
    expect(breadcrumb.querySelector('[aria-current="page"]')).toHaveTextContent("Project");
  });
});