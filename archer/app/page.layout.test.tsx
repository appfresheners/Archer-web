import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("Page layout responsive structure", () => {
    it("renders main element with correct responsive layout classes", () => {
        render(<Home />);
        const main = screen.getByRole("main");
        expect(main).toHaveClass("mx-auto");
        expect(main).toHaveClass("max-w-[640px]");
        expect(main).toHaveClass("px-[var(--spacing-page-x)]");
        expect(main).toHaveClass("lg:px-[var(--spacing-page-x-lg)]");
    });

    it("renders all child elements within the main container", () => {
        render(<Home />);
        const main = screen.getByRole("main");
        const heading = screen.getByRole("heading", { name: "Archer" });
        const tablist = screen.getByRole("tablist");
        const input = screen.getByRole("textbox");
        const button = screen.getByRole("button", { name: "Generate" });

        expect(main).toContainElement(heading);
        expect(main).toContainElement(tablist);
        expect(main).toContainElement(input);
        expect(main).toContainElement(button);
    });

    it("input fills full width of container", () => {
        render(<Home />);
        const input = screen.getByRole("textbox");
        expect(input).toHaveClass("w-full");
    });

    it("generate button fills full width of container", () => {
        render(<Home />);
        const button = screen.getByRole("button", { name: "Generate" });
        expect(button).toHaveClass("w-full");
    });

    it("mode toggle is centered within its container", () => {
        render(<Home />);
        const tablist = screen.getByRole("tablist");
        const wrapper = tablist.parentElement;
        expect(wrapper).toHaveClass("flex");
        expect(wrapper).toHaveClass("justify-center");
    });
});
