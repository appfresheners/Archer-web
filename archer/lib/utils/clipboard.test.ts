import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { copyToClipboard } from "./clipboard";

describe("copyToClipboard utility", () => {
    const originalClipboard = navigator.clipboard;

    beforeEach(() => {
        Object.defineProperty(navigator, "clipboard", {
            value: {
                writeText: vi.fn(),
            },
            writable: true,
            configurable: true,
        });
    });

    afterEach(() => {
        Object.defineProperty(navigator, "clipboard", {
            value: originalClipboard,
            writable: true,
            configurable: true,
        });
    });

    it("returns { success: true } when writeText resolves", async () => {
        (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

        const result = await copyToClipboard("# Hello");

        expect(result).toEqual({ success: true });
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith("# Hello");
    });

    it("returns { success: false } when writeText rejects", async () => {
        (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mockRejectedValue(
            new DOMException("Denied", "NotAllowedError")
        );

        const result = await copyToClipboard("# Hello");

        expect(result).toEqual({ success: false });
    });

    it("returns { success: false } when clipboard API is unavailable", async () => {
        Object.defineProperty(navigator, "clipboard", {
            value: undefined,
            writable: true,
            configurable: true,
        });

        const result = await copyToClipboard("# Hello");

        expect(result).toEqual({ success: false });
    });
});
