import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadMarkdown } from "./download";

describe("downloadMarkdown utility", () => {
    let mockCreateObjectURL: ReturnType<typeof vi.fn>;
    let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
    let clickSpy: () => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let appendChildSpy: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let removeChildSpy: any;

    beforeEach(() => {
        mockCreateObjectURL = vi.fn().mockReturnValue("blob:http://localhost/fake-url");
        mockRevokeObjectURL = vi.fn();

        Object.defineProperty(URL, "createObjectURL", {
            value: mockCreateObjectURL,
            writable: true,
            configurable: true,
        });
        Object.defineProperty(URL, "revokeObjectURL", {
            value: mockRevokeObjectURL,
            writable: true,
            configurable: true,
        });

        clickSpy = vi.fn() as unknown as () => void;
        appendChildSpy = vi.spyOn(document.body, "appendChild").mockImplementation((node) => {
            // Attach our spy to the anchor's click method
            if (node instanceof HTMLAnchorElement) {
                node.click = clickSpy;
            }
            return node;
        });
        removeChildSpy = vi.spyOn(document.body, "removeChild").mockImplementation((node) => node);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("calls createObjectURL with a text/markdown Blob", () => {
        downloadMarkdown("# Hello", "test.md");

        expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
        const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
        expect(blob).toBeInstanceOf(Blob);
        expect(blob.type).toBe("text/markdown");
    });

    it("triggers anchor click with correct href and download attributes", () => {
        downloadMarkdown("# Hello", "archer-goal-learn-guitar.md");

        expect(appendChildSpy).toHaveBeenCalledTimes(1);
        const anchor = appendChildSpy.mock.calls[0][0] as HTMLAnchorElement;
        expect(anchor.href).toBe("blob:http://localhost/fake-url");
        expect(anchor.download).toBe("archer-goal-learn-guitar.md");
        expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    it("revokes the object URL after click", () => {
        vi.useFakeTimers();
        downloadMarkdown("# Hello", "test.md");

        // revokeObjectURL is called after a 100ms delay (Firefox compat)
        vi.advanceTimersByTime(100);
        expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:http://localhost/fake-url");
        vi.useRealTimers();
    });

    it("removes the anchor from the DOM after click", () => {
        downloadMarkdown("# Hello", "test.md");

        expect(removeChildSpy).toHaveBeenCalledTimes(1);
    });

    it("returns { success: true } on successful download", () => {
        const result = downloadMarkdown("# Hello", "test.md");
        expect(result).toEqual({ success: true });
    });

    it("returns { success: false } when createObjectURL is unavailable", () => {
        Object.defineProperty(URL, "createObjectURL", {
            value: undefined,
            writable: true,
            configurable: true,
        });

        const result = downloadMarkdown("# Hello", "test.md");
        expect(result).toEqual({ success: false });
    });
});
