import * as clipboardUtil from "@/lib/utils/clipboard";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ActionBar from "./ActionBar";

vi.mock("@/lib/utils/clipboard", () => ({
    copyToClipboard: vi.fn(),
}));

const mockCopyToClipboard = clipboardUtil.copyToClipboard as ReturnType<typeof vi.fn>;

const sampleMarkdown = "# Goal\n\nLearn guitar in 3 months\n\n## Next Actions\n\n- Buy a guitar";

describe("ActionBar component", () => {
    beforeEach(() => {
        mockCopyToClipboard.mockResolvedValue({ success: true });
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
    });

    it("renders the Copy Markdown button", () => {
        render(<ActionBar markdown={sampleMarkdown} />);
        expect(
            screen.getByRole("button", { name: /copy markdown/i })
        ).toBeInTheDocument();
    });

    it("button meets 44px minimum touch target", () => {
        render(<ActionBar markdown={sampleMarkdown} />);
        const button = screen.getByRole("button", { name: /copy markdown/i });
        expect(button.className).toContain("min-h-[44px]");
        expect(button.className).toContain("min-w-[44px]");
    });

    describe("Happy path — clipboard write succeeds", () => {
        it("calls copyToClipboard with raw markdown", async () => {
            const user = userEvent.setup();
            render(<ActionBar markdown={sampleMarkdown} />);

            const button = screen.getByRole("button", { name: /copy markdown/i });
            await user.click(button);

            await waitFor(() => {
                expect(mockCopyToClipboard).toHaveBeenCalledWith(sampleMarkdown);
            });
        });

        it("shows 'Copied ✓' confirmation after successful copy", async () => {
            const user = userEvent.setup();
            render(<ActionBar markdown={sampleMarkdown} />);

            const button = screen.getByRole("button", { name: /copy markdown/i });
            await user.click(button);

            await waitFor(() => {
                expect(screen.getByText("Copied ✓")).toBeInTheDocument();
            });
        });

        it("resets confirmation state after 2 seconds", async () => {
            vi.useFakeTimers({ shouldAdvanceTime: true });
            const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
            render(<ActionBar markdown={sampleMarkdown} />);

            const button = screen.getByRole("button", { name: /copy markdown/i });
            await user.click(button);

            await waitFor(() => {
                expect(screen.getByText("Copied ✓")).toBeInTheDocument();
            });

            act(() => {
                vi.advanceTimersByTime(2000);
            });

            expect(screen.getByText("Copy Markdown")).toBeInTheDocument();
            expect(screen.queryByText("Copied ✓")).not.toBeInTheDocument();
        });

        it("announces state change via aria-live region", async () => {
            const user = userEvent.setup();
            render(<ActionBar markdown={sampleMarkdown} />);

            const button = screen.getByRole("button", { name: /copy markdown/i });
            await user.click(button);

            const liveRegion = await screen.findByText("Markdown copied to clipboard");
            expect(liveRegion).toHaveAttribute("aria-live", "polite");
        });
    });

    describe("Permission denied — fallback modal", () => {
        beforeEach(() => {
            mockCopyToClipboard.mockResolvedValue({ success: false });
        });

        it("shows fallback modal when clipboard access is denied", async () => {
            const user = userEvent.setup();
            render(<ActionBar markdown={sampleMarkdown} />);

            const button = screen.getByRole("button", { name: /copy markdown/i });
            await user.click(button);

            await waitFor(() => {
                expect(screen.getByRole("dialog")).toBeInTheDocument();
            });

            const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
            expect(textarea.value).toBe(sampleMarkdown);
        });

        it("fallback textarea is read-only", async () => {
            const user = userEvent.setup();
            render(<ActionBar markdown={sampleMarkdown} />);

            const button = screen.getByRole("button", { name: /copy markdown/i });
            await user.click(button);

            await waitFor(() => {
                expect(screen.getByRole("dialog")).toBeInTheDocument();
            });

            const textarea = screen.getByRole("textbox");
            expect(textarea).toHaveAttribute("readonly");
        });

        it("close button dismisses the fallback modal", async () => {
            const user = userEvent.setup();
            render(<ActionBar markdown={sampleMarkdown} />);

            const button = screen.getByRole("button", { name: /copy markdown/i });
            await user.click(button);

            await waitFor(() => {
                expect(screen.getByRole("dialog")).toBeInTheDocument();
            });

            const closeButton = screen.getByRole("button", { name: /close/i });
            await user.click(closeButton);

            expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        });
    });

    describe("Rapid re-click — timer reset", () => {
        it("resets the 2s timer on rapid re-click", async () => {
            vi.useFakeTimers({ shouldAdvanceTime: true });
            const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
            render(<ActionBar markdown={sampleMarkdown} />);

            const button = screen.getByRole("button", { name: /copy markdown/i });

            // First click
            await user.click(button);
            await waitFor(() => {
                expect(screen.getByText("Copied ✓")).toBeInTheDocument();
            });

            // Advance 1.5s (still in confirmation)
            act(() => {
                vi.advanceTimersByTime(1500);
            });

            // Second click — resets timer
            await user.click(button);
            await waitFor(() => {
                expect(screen.getByText("Copied ✓")).toBeInTheDocument();
            });

            // Advance 1.5s after second click (1.5s < 2s so still showing)
            act(() => {
                vi.advanceTimersByTime(1500);
            });
            expect(screen.getByText("Copied ✓")).toBeInTheDocument();

            // Advance remaining 0.5s to complete the 2s from second click
            act(() => {
                vi.advanceTimersByTime(500);
            });
            expect(screen.getByText("Copy Markdown")).toBeInTheDocument();
        });

        it("each click calls copyToClipboard once", async () => {
            const user = userEvent.setup();
            render(<ActionBar markdown={sampleMarkdown} />);

            const button = screen.getByRole("button", { name: /copy markdown/i });
            await user.click(button);
            await waitFor(() => {
                expect(mockCopyToClipboard).toHaveBeenCalledTimes(1);
            });

            await user.click(button);
            await waitFor(() => {
                expect(mockCopyToClipboard).toHaveBeenCalledTimes(2);
            });
        });
    });
});
