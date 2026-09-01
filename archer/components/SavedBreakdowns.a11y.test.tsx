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
        onExport: vi.fn(() => ({
            ok: true,
            message: "Vault exported to archer-vault.json.",
        })),
        onImport: vi.fn(async () => ({
            ok: true,
            message: "Import complete — replaced your vault.",
        })),
        identityLink: vi.fn(() => "https://archer.example/#key=secret"),
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

    it("has no axe violations for the export/import controls", async () => {
        const { container } = render(<SavedBreakdowns {...baseProps()} />);
        // The controls are always present when unlocked.
        expect(
            screen.getByRole("button", { name: /export vault/i }),
        ).toBeInTheDocument();
        expect(screen.getByLabelText("Import vault file")).toBeInTheDocument();
        const violations = await runAxe(container);
        expect(violations).toEqual([]);
    });

    it("has no axe violations for the revealed portable-identity controls and QR", async () => {
        const user = userEvent.setup();
        const { container } = render(<SavedBreakdowns {...baseProps()} />);

        await user.click(
            screen.getByRole("button", { name: /reveal portable identity/i }),
        );
        // Wait for the QR (with its text alternative) to render.
        await screen.findByRole("img", { name: /qr code/i });

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

    it("lets a keyboard user reveal and copy the portable identity", async () => {
        const props = baseProps();
        const user = userEvent.setup();
        render(<SavedBreakdowns {...props} />);

        const revealButton = screen.getByRole("button", {
            name: /reveal portable identity/i,
        });
        revealButton.focus();
        expect(revealButton).toHaveFocus();
        expect(revealButton.className).toContain("min-h-[44px]");
        await user.keyboard("{Enter}");

        expect(props.identityLink).toHaveBeenCalled();
        // The QR carries a meaningful text alternative.
        const qr = await screen.findByRole("img", { name: /qr code/i });
        expect(qr).toBeInTheDocument();

        const copyButton = screen.getByRole("button", { name: /copy link/i });
        expect(copyButton.className).toContain("min-h-[44px]");
    });

    it("lets a keyboard user trigger export and import via buttons", async () => {
        const props = baseProps();
        const user = userEvent.setup();
        render(<SavedBreakdowns {...props} />);

        const exportButton = screen.getByRole("button", { name: /export vault/i });
        exportButton.focus();
        expect(exportButton).toHaveFocus();
        await user.keyboard("{Enter}");
        expect(props.onExport).toHaveBeenCalledTimes(1);

        // Import button is a real, focusable button that proxies the file input.
        const importButton = screen.getByRole("button", { name: /import vault/i });
        importButton.focus();
        expect(importButton).toHaveFocus();
        expect(importButton.className).toContain("min-h-[44px]");
    });
});
