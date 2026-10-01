import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MonthlyGoalCheckPrompt from "./MonthlyGoalCheckPrompt";

describe("MonthlyGoalCheckPrompt", () => {
  it("renders no prompt when there are no due goals", () => {
    const { container } = render(<MonthlyGoalCheckPrompt goals={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists links to each due goal's monthly check", () => {
    render(
      <MonthlyGoalCheckPrompt
        goals={[
          { id: "g1", goal_text: "Run a marathon" },
          { id: "g2", goal_text: "Learn French" },
        ]}
      />,
    );

    expect(screen.getByRole("complementary", { name: "Monthly goal checks due" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Run a marathon" })).toHaveAttribute(
      "href",
      "/app/review/monthly/g1",
    );
    expect(screen.getByRole("link", { name: "Learn French" })).toHaveAttribute(
      "href",
      "/app/review/monthly/g2",
    );
  });
});