import type { VaultEntry } from "@/lib/vault/types";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
        entries: [] as VaultEntry[],
        onUnlock: vi.fn<(passphrase: string) => Promise<string | null>>(
            async () => null,
        ),
        onRestore: vi.fn<(entry: VaultEntry) => void>(),
        onDelete: vi.fn<(id: string) => Promise<string | null>>(async () => null),
        onClear: vi.fn<() => Promise<string | null>>(async () => null),
        onExport: vi.fn<() => { ok: boolean; message: string }>(() => ({
            ok: true,
            message: "Vault exported to archer-vault.json.",
        })),
        onImport: vi.fn<
            (fileText: string) => Promise<{ ok: boolean; message: string }>
        >(async () => ({ ok: true, message: "Import complete — replaced your vault." })),
        onClose: vi.fn<() => void>(),
    };
}

describe("SavedBreakdowns unlock flow", () => {
    it("shows a passphrase form when locked", () => {
        render(<SavedBreakdowns {...baseProps()} unlocked={false} />);
        expect(screen.getByLabelText("Passphrase")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Unlock" })).toBeInTheDocument();
    });

    it("calls onUnlock with the typed passphrase", async () => {
        const props = baseProps();
        const user = userEvent.setup();
        render(<SavedBreakdowns {...props} unlocked={false} />);

        await user.type(screen.getByLabelText("Passphrase"), "secret");
        await user.click(screen.getByRole("button", { name: "Unlock" }));

        expect(props.onUnlock).toHaveBeenCalledWith("secret");
    });

    it("shows a 'couldn't unlock' message when onUnlock returns an error", async () => {
        const props = baseProps();
        props.onUnlock = vi.fn(async () => "Couldn't unlock — check your passphrase and try again.");
        const user = userEvent.setup();
        render(<SavedBreakdowns {...props} unlocked={false} />);

        await user.type(screen.getByLabelText("Passphrase"), "wrong");
        await user.click(screen.getByRole("button", { name: "Unlock" }));

        await waitFor(() => {
            expect(screen.getByRole("alert")).toHaveTextContent(/couldn't unlock/i);
        });
        // No entries/list are shown while locked.
        expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });
});

describe("SavedBreakdowns list", () => {
    it("shows an empty state when unlocked with no entries", () => {
        render(<SavedBreakdowns {...baseProps()} entries={[]} />);
        expect(screen.getByText(/no saved breakdowns yet/i)).toBeInTheDocument();
    });

    it("renders entries with input text, mode, and a timestamp", () => {
        const entries = [
            entry({ id: "a", inputText: "Learn guitar", mode: "goal", createdAt: 2000 }),
        ];
        render(<SavedBreakdowns {...baseProps()} entries={entries} />);

        expect(screen.getByText("Learn guitar")).toBeInTheDocument();
        expect(screen.getByText("goal")).toBeInTheDocument();
        expect(screen.getByRole("listitem").querySelector("time")).toBeTruthy();
    });

    it("renders entries in the order provided (most-recent-first by the parent)", () => {
        const entries = [
            entry({ id: "new", inputText: "newest", createdAt: 3000 }),
            entry({ id: "old", inputText: "oldest", createdAt: 1000 }),
        ];
        render(<SavedBreakdowns {...baseProps()} entries={entries} />);

        const items = screen.getAllByRole("listitem");
        expect(items[0]).toHaveTextContent("newest");
        expect(items[1]).toHaveTextContent("oldest");
    });

    it("invokes onRestore with the full entry", async () => {
        const props = baseProps();
        const target = entry({ id: "restore-me", inputText: "Restore this" });
        const user = userEvent.setup();
        render(<SavedBreakdowns {...props} entries={[target]} />);

        await user.click(screen.getByRole("button", { name: "Restore" }));
        expect(props.onRestore).toHaveBeenCalledWith(target);
    });

    it("invokes onDelete with the entry id", async () => {
        const props = baseProps();
        const target = entry({ id: "del-me", inputText: "Delete this" });
        const user = userEvent.setup();
        render(<SavedBreakdowns {...props} entries={[target]} />);

        await user.click(screen.getByRole("button", { name: /delete breakdown/i }));
        expect(props.onDelete).toHaveBeenCalledWith("del-me");
    });
});

describe("SavedBreakdowns clear-vault confirmation", () => {
    it("does not clear until the user explicitly confirms", async () => {
        const props = baseProps();
        const user = userEvent.setup();
        render(<SavedBreakdowns {...props} entries={[entry()]} />);

        await user.click(screen.getByRole("button", { name: "Clear vault" }));

        // A confirm dialog appears and states the action cannot be undone.
        const dialog = screen.getByRole("dialog");
        expect(dialog).toHaveTextContent(/cannot be undone/i);
        // onClear not yet called.
        expect(props.onClear).not.toHaveBeenCalled();
    });

    it("does nothing when the confirmation is cancelled", async () => {
        const props = baseProps();
        const user = userEvent.setup();
        render(<SavedBreakdowns {...props} entries={[entry()]} />);

        await user.click(screen.getByRole("button", { name: "Clear vault" }));
        await user.click(screen.getByRole("button", { name: "Cancel" }));

        expect(props.onClear).not.toHaveBeenCalled();
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("calls onClear only after confirming", async () => {
        const props = baseProps();
        const user = userEvent.setup();
        render(<SavedBreakdowns {...props} entries={[entry()]} />);

        await user.click(screen.getByRole("button", { name: "Clear vault" }));
        await user.click(screen.getByRole("button", { name: "Delete everything" }));

        expect(props.onClear).toHaveBeenCalledTimes(1);
    });
});

describe("SavedBreakdowns export/import", () => {
    it("calls onExport and shows the outcome message", async () => {
        const props = baseProps();
        props.onExport = vi.fn(() => ({
            ok: true,
            message: "Vault exported to archer-vault.json.",
        }));
        const user = userEvent.setup();
        render(<SavedBreakdowns {...props} entries={[entry()]} />);

        await user.click(screen.getByRole("button", { name: /export vault/i }));

        expect(props.onExport).toHaveBeenCalledTimes(1);
        expect(screen.getByRole("status")).toHaveTextContent(/exported/i);
    });

    it("shows an error message when export fails", async () => {
        const props = baseProps();
        props.onExport = vi.fn(() => ({
            ok: false,
            message: "Nothing to export yet.",
        }));
        const user = userEvent.setup();
        render(<SavedBreakdowns {...props} entries={[entry()]} />);

        await user.click(screen.getByRole("button", { name: /export vault/i }));

        expect(screen.getByRole("alert")).toHaveTextContent(/nothing to export/i);
    });

    it("reads a chosen file and shows the merged/replaced outcome", async () => {
        const props = baseProps();
        props.onImport = vi.fn(async () => ({
            ok: true,
            message: "Import complete — merged into your vault (3 saved breakdowns total).",
        }));
        const user = userEvent.setup();
        render(<SavedBreakdowns {...props} entries={[entry()]} />);

        const file = new File(['{"schemaVersion":1}'], "archer-vault.json", {
            type: "application/json",
        });
        const input = screen.getByLabelText("Import vault file") as HTMLInputElement;
        await user.upload(input, file);

        await waitFor(() => {
            expect(props.onImport).toHaveBeenCalledTimes(1);
        });
        expect(props.onImport).toHaveBeenCalledWith('{"schemaVersion":1}');
        await waitFor(() => {
            expect(screen.getByRole("status")).toHaveTextContent(/merged/i);
        });
    });

    it("shows a rejection message when import fails", async () => {
        const props = baseProps();
        props.onImport = vi.fn(async () => ({
            ok: false,
            message: "Couldn't import that file — it isn't a valid vault export.",
        }));
        const user = userEvent.setup();
        render(<SavedBreakdowns {...props} entries={[entry()]} />);

        const file = new File(["garbage"], "bad.json", {
            type: "application/json",
        });
        const input = screen.getByLabelText("Import vault file") as HTMLInputElement;
        await user.upload(input, file);

        await waitFor(() => {
            expect(screen.getByRole("alert")).toHaveTextContent(/couldn't import/i);
        });
    });

    it("exposes a labeled, keyboard-operable import control", async () => {
        const props = baseProps();
        render(<SavedBreakdowns {...props} entries={[entry()]} />);

        // The file input is labeled for assistive tech.
        expect(screen.getByLabelText("Import vault file")).toBeInTheDocument();
        // A real button triggers it (keyboard operable, ≥44px).
        const importButton = screen.getByRole("button", { name: /import vault/i });
        expect(importButton.className).toContain("min-h-[44px]");
        expect(importButton.className).toContain("focus:ring-2");
    });
});

describe("SavedBreakdowns close", () => {
    it("calls onClose when the Close button is pressed", async () => {
        const props = baseProps();
        const user = userEvent.setup();
        render(<SavedBreakdowns {...props} />);

        await user.click(screen.getByRole("button", { name: "Close" }));
        expect(props.onClose).toHaveBeenCalled();
    });
});
