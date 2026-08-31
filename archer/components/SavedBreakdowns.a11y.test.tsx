import type { VaultEntry } from "@/lib/vault/types";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { describe, expect, it, vi } from "vitest";
import SavedBreakdowns from "./SavedBreakdowns";

function entry(overrides: Partial<VaultEntry> = {}): VaultEntry {
    return {
        id: "id-1",
        inputText: "Learn guitar",
        mode: "goal",
        generationOptions: null,
        outputMarkdown: "# Goal",
        createdAt: 1_000,
        ...overrides,
    };
}

function baseProps() {
    return {
        unlocked: true,
        entries: [entry()] as VaultEntry[],
        onUnlock: vi.fn(async () => null),
        onRestore: vi.fn(),
        onDelete: vi.fn(async () => null),
        onClear: vi.fn(async () => null),
        onClose: vi.fn(),
    };
}

/** Run axe against a container and return the violations array. */
async function runAxe(container: HTMLElement) {
    const results = await axe.run(container, {
        // color-contrast can't be computed reliably in jsdom (no layout), and
        // tokens are exercised by the design system; skip that single rule.
        rules: { "color-contrast": { enabled: false } },
    });
    return results.violations;
}

describe("SavedBreakdowns accessibility (axe-core)", () => {
    it("has no axe violations when unlocked with entries", async () => {
        const { container } = render(<SavedBreakdowns {...baseProps()} />);
        const violations = await runAxe(container);
        expect(violations).toEqual([]);
    });

    it("has no axe violations in the locked passphrase form", async () => {
        const { container } = render(
            <SavedBreakdowns {...baseProps()} unlocked={false} />,
        );
        const violations = await runAxe(container);
        expect(violations).toEqual([]);
    });

    it("has no axe violations in the clear-vault confirm dialog", async () => {
        const user = userEvent.setup();
        const { container } = render(<SavedBreakdowns {...baseProps()} />);
        await user.click(screen.getByRole("button", { name: "Clear vault" }));
        const violations = await runAxe(container);
        expect(violations).toEqual([]);
    });
});

describe("SavedBreakdowns keyboard operability", () => {
    it("lets a keyboard user unlock without a mouse", async () => {
        const props = baseProps();
        const user = userEvent.setup();
        render(<SavedBreakdowns {...props} unlocked={false} />);

        await user.tab(); // Close button
        await user.tab(); // passphrase input
        expect(screen.getByLabelText("Passphrase")).toHaveFocus();
        await user.keyboard("secret");
        await user.tab(); // Unlock button
        expect(screen.getByRole("button", { name: "Unlock" })).toHaveFocus();
        await user.keyboard("{Enter}");

        expect(props.onUnlock).toHaveBeenCalledWith("secret");
    });

    it("lets a keyboard user restore an entry", async () => {
        const props = baseProps();
        const target = entry({ id: "kb", inputText: "keyboard restore" });
        const user = userEvent.setup();
        render(<SavedBreakdowns {...props} entries={[target]} />);

        const restore = screen.getByRole("button", { name: "Restore" });
        restore.focus();
        expect(restore).toHaveFocus();
        await user.keyboard("{Enter}");

        expect(props.onRestore).toHaveBeenCalledWith(target);
    });

    it("closes the clear-vault dialog with Escape", async () => {
        const props = baseProps();
        const user = userEvent.setup();
        render(<SavedBreakdowns {...props} />);

        await user.click(screen.getByRole("button", { name: "Clear vault" }));
        expect(screen.getByRole("dialog")).toBeInTheDocument();

        await user.keyboard("{Escape}");
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("uses ≥44px targets and focus rings on interactive controls", () => {
        render(<SavedBreakdowns {...baseProps()} />);
        const restore = screen.getByRole("button", { name: "Restore" });
        expect(restore.className).toContain("min-h-[44px]");
        expect(restore.className).toContain("min-w-[44px]");
        expect(restore.className).toContain("focus:ring-2");
    });
});
