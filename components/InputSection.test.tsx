import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import InputSection from "./InputSection";

describe("InputSection", () => {
    const defaultProps = {
        mode: "goal" as const,
        inputText: "",
        onInputChange: vi.fn(),
        onSubmit: vi.fn(),
    };

    describe("Placeholder text per mode", () => {
        it("renders goal mode placeholder", () => {
            render(<InputSection {...defaultProps} mode="goal" />);
            expect(
                screen.getByPlaceholderText(
                    "e.g., Become a proficient guitarist in 3 months"
                )
            ).toBeInTheDocument();
        });

        it("renders project mode placeholder", () => {
            render(<InputSection {...defaultProps} mode="project" />);
            expect(
                screen.getByPlaceholderText(
                    "e.g., Personal portfolio website deployed online"
                )
            ).toBeInTheDocument();
        });
    });

    describe("Button disabled/enabled state", () => {
        it("shows aria-disabled button when input is empty", () => {
            render(<InputSection {...defaultProps} inputText="" />);
            const button = screen.getByRole("button", { name: /generate/i });
            expect(button).toHaveAttribute("aria-disabled", "true");
        });

        it("shows enabled button when input has text", () => {
            render(<InputSection {...defaultProps} inputText="Learn guitar" />);
            const button = screen.getByRole("button", { name: /generate/i });
            expect(button).not.toHaveAttribute("aria-disabled", "true");
        });

        it("applies disabled styling when input is empty", () => {
            render(<InputSection {...defaultProps} inputText="" />);
            const button = screen.getByRole("button", { name: /generate/i });
            expect(button.className).toContain("cursor-not-allowed");
        });

        it("applies enabled styling when input has text", () => {
            render(<InputSection {...defaultProps} inputText="Learn guitar" />);
            const button = screen.getByRole("button", { name: /generate/i });
            expect(button.className).not.toContain("cursor-not-allowed");
        });
    });

    describe("Validation", () => {
        it("shows validation message on submit with empty input", () => {
            render(<InputSection {...defaultProps} inputText="" />);
            const button = screen.getByRole("button", { name: /generate/i });
            fireEvent.click(button);
            expect(
                screen.getByText("Enter a goal or project first")
            ).toBeInTheDocument();
        });

        it("shows validation message on submit with whitespace-only input", () => {
            render(<InputSection {...defaultProps} inputText="   " />);
            const button = screen.getByRole("button", { name: /generate/i });
            fireEvent.click(button);
            expect(
                screen.getByText("Enter a goal or project first")
            ).toBeInTheDocument();
        });

        it("clears validation message when user types", () => {
            const onInputChange = vi.fn();
            const { rerender } = render(
                <InputSection {...defaultProps} inputText="" onInputChange={onInputChange} />
            );
            const button = screen.getByRole("button", { name: /generate/i });
            fireEvent.click(button);
            expect(
                screen.getByText("Enter a goal or project first")
            ).toBeInTheDocument();

            // Simulate typing by triggering onInputChange via input change event
            const input = screen.getByRole("textbox");
            fireEvent.change(input, { target: { value: "a" } });

            // Rerender with new text to reflect parent state update
            rerender(
                <InputSection {...defaultProps} inputText="a" onInputChange={onInputChange} />
            );
            expect(
                screen.queryByText("Enter a goal or project first")
            ).not.toBeInTheDocument();
        });

        it("renders validation message with role alert", () => {
            render(<InputSection {...defaultProps} inputText="" />);
            const button = screen.getByRole("button", { name: /generate/i });
            fireEvent.click(button);
            expect(screen.getByRole("alert")).toBeInTheDocument();
        });

        it("connects input to error via aria-describedby", () => {
            render(<InputSection {...defaultProps} inputText="" />);
            const button = screen.getByRole("button", { name: /generate/i });
            fireEvent.click(button);
            const input = screen.getByRole("textbox");
            const error = screen.getByRole("alert");
            expect(input).toHaveAttribute("aria-describedby", error.id);
        });
    });

    describe("Submit behavior", () => {
        it("does NOT call onSubmit with empty input", () => {
            const onSubmit = vi.fn();
            render(<InputSection {...defaultProps} inputText="" onSubmit={onSubmit} />);
            const button = screen.getByRole("button", { name: /generate/i });
            fireEvent.click(button);
            expect(onSubmit).not.toHaveBeenCalled();
        });

        it("does NOT call onSubmit with whitespace-only input", () => {
            const onSubmit = vi.fn();
            render(
                <InputSection {...defaultProps} inputText="   " onSubmit={onSubmit} />
            );
            const button = screen.getByRole("button", { name: /generate/i });
            fireEvent.click(button);
            expect(onSubmit).not.toHaveBeenCalled();
        });

        it("calls onSubmit with valid input on button click", () => {
            const onSubmit = vi.fn();
            render(
                <InputSection
                    {...defaultProps}
                    inputText="Learn guitar"
                    onSubmit={onSubmit}
                />
            );
            const button = screen.getByRole("button", { name: /generate/i });
            fireEvent.click(button);
            expect(onSubmit).toHaveBeenCalledTimes(1);
        });

        it("calls onSubmit on Enter key with valid input", () => {
            const onSubmit = vi.fn();
            render(
                <InputSection
                    {...defaultProps}
                    inputText="Learn guitar"
                    onSubmit={onSubmit}
                />
            );
            const input = screen.getByRole("textbox");
            fireEvent.keyDown(input, { key: "Enter" });
            expect(onSubmit).toHaveBeenCalledTimes(1);
        });

        it("shows validation on Enter key with empty input", () => {
            const onSubmit = vi.fn();
            render(<InputSection {...defaultProps} inputText="" onSubmit={onSubmit} />);
            const input = screen.getByRole("textbox");
            fireEvent.keyDown(input, { key: "Enter" });
            expect(onSubmit).not.toHaveBeenCalled();
            expect(
                screen.getByText("Enter a goal or project first")
            ).toBeInTheDocument();
        });
    });

    describe("Input change", () => {
        it("calls onInputChange when user types", () => {
            const onInputChange = vi.fn();
            render(
                <InputSection {...defaultProps} onInputChange={onInputChange} />
            );
            const input = screen.getByRole("textbox");
            fireEvent.change(input, { target: { value: "Hello" } });
            expect(onInputChange).toHaveBeenCalledWith("Hello");
        });
    });

    describe("Accessibility", () => {
        it("has a visually hidden label for the input", () => {
            render(<InputSection {...defaultProps} mode="goal" />);
            expect(screen.getByLabelText("Enter your goal")).toBeInTheDocument();
        });

        it("updates label text for project mode", () => {
            render(<InputSection {...defaultProps} mode="project" />);
            expect(screen.getByLabelText("Enter your project")).toBeInTheDocument();
        });

        it("button has type button", () => {
            render(<InputSection {...defaultProps} />);
            const button = screen.getByRole("button", { name: /generate/i });
            expect(button).toHaveAttribute("type", "button");
        });

        it("input has min-h-[44px] class for touch target", () => {
            render(<InputSection {...defaultProps} />);
            const input = screen.getByRole("textbox");
            expect(input.className).toContain("min-h-[44px]");
        });

        it("button has min-h-[44px] class for touch target", () => {
            render(<InputSection {...defaultProps} />);
            const button = screen.getByRole("button", { name: /generate/i });
            expect(button.className).toContain("min-h-[44px]");
        });
    });
});
