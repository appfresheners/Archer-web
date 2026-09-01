import * as clipboardUtil from "@/lib/utils/clipboard";
import * as downloadUtil from "@/lib/utils/download";
import type { VaultEntry, VaultResult } from "@/lib/vault/types";
import * as vaultSession from "@/lib/vault/useVaultSession";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./page";

vi.mock("@/lib/utils/clipboard", () => ({
    copyToClipboard: vi.fn(),
}));

vi.mock("@/lib/utils/download", () => ({
    downloadMarkdown: vi.fn(),
}));

vi.mock("@/lib/vault/useVaultSession", () => ({
    useVaultSession: vi.fn(),
}));

const mockCopyToClipboard = clipboardUtil.copyToClipboard as ReturnType<typeof vi.fn>;
const mockDownloadMarkdown = downloadUtil.downloadMarkdown as ReturnType<typeof vi.fn>;
const mockUseVaultSession = vaultSession.useVaultSession as ReturnType<typeof vi.fn>;

// Shared handles reset per test so assertions target the current render.
const mockSave = vi.fn<
    (input: unknown) => Promise<VaultResult<VaultEntry>>
>();
const mockUnlock = vi.fn<(passphrase: string) => Promise<VaultResult<VaultEntry[]>>>();
const mockRemove = vi.fn<(id: string) => Promise<VaultResult<void>>>();
const mockClear = vi.fn<() => Promise<VaultResult<void>>>();
const mockList = vi.fn<() => Promise<VaultResult<VaultEntry[]>>>();
const mockExportVault = vi.fn<() => VaultResult<{ filename: string }>>();
const mockImportVault =
    vi.fn<
        (fileText: string) => Promise<
            VaultResult<{ outcome: "merged" | "replaced"; count: number }>
        >
    >();
const mockLock = vi.fn();

// Build a session stub. `unlocked` and `entries` can be overridden per test.
function makeSession(
    overrides: Partial<{ unlocked: boolean; entries: VaultEntry[] }> = {}
) {
    return {
        unlocked: overrides.unlocked ?? true,
        entries: overrides.entries ?? [],
        unlock: mockUnlock,
        list: mockList,
        save: mockSave,
        remove: mockRemove,
        clear: mockClear,
        exportVault: mockExportVault,
        importVault: mockImportVault,
        lock: mockLock,
    };
}

// Default the vault to an unlocked session with a successful save so the
// existing generation suites persist without extra ceremony.
// vi.restoreAllMocks() clears implementations, so re-apply before each test.
beforeEach(() => {
    mockSave.mockResolvedValue({
        success: true,
        data: {
            id: "test-id",
            inputText: "",
            mode: "goal",
            generationOptions: null,
            outputMarkdown: "",
            createdAt: 0,
        },
    });
    mockUnlock.mockResolvedValue({ success: true, data: [] });
    mockRemove.mockResolvedValue({ success: true, data: undefined });
    mockClear.mockResolvedValue({ success: true, data: undefined });
    mockList.mockResolvedValue({ success: true, data: [] });
    mockExportVault.mockReturnValue({
        success: true,
        data: { filename: "archer-vault.json" },
    });
    mockImportVault.mockResolvedValue({
        success: true,
        data: { outcome: "replaced", count: 0 },
    });
    mockUseVaultSession.mockReturnValue(makeSession());
});

const MOCK_GOAL_RESPONSE = `# My 3-Month Goal

**Learn guitar**

## I'll know I succeeded when…

- [ ] Can play 5 songs from memory
- [ ] Can switch between basic chords fluently

## GTD Projects

### Guitar basics mastered

#### Purpose
Foundation for all guitar playing

#### Successful Outcome
Can play open chords cleanly

#### Next Actions
- [ ] Open YouTube and search "beginner guitar lesson 1"
- [ ] Watch the first 5 minutes
`;

const MOCK_PROJECT_RESPONSE = `# Build portfolio website

## Purpose
Showcase work to potential employers

## Successful Outcome
Live website accessible at a public URL with at least 3 project showcases

## Next Actions
- [ ] Open browser and navigate to vercel.com
- [ ] Click "Sign Up" and create account
- [ ] Open terminal and type "npx create-next-app portfolio"
`;

function mockFetchSuccess(markdown: string) {
    global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ markdown }),
    });
}

function mockFetchError(error: string) {
    global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error }),
    });
}

describe("Home page with ModeToggle integration", () => {
    beforeEach(() => {
        mockFetchSuccess(MOCK_GOAL_RESPONSE);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("renders the ModeToggle component", () => {
        render(<Home />);
        expect(screen.getByRole("tablist", { name: "Template mode" })).toBeInTheDocument();
    });

    it("defaults to goal mode", () => {
        render(<Home />);
        const goalTab = screen.getByRole("tab", { name: "Goal" });
        expect(goalTab).toHaveAttribute("aria-selected", "true");
    });

    it("switches mode when clicking Project tab", () => {
        render(<Home />);
        const projectTab = screen.getByRole("tab", { name: "Project" });
        fireEvent.click(projectTab);
        expect(projectTab).toHaveAttribute("aria-selected", "true");
        expect(screen.getByRole("tab", { name: "Goal" })).toHaveAttribute("aria-selected", "false");
    });

    it("clears input text when switching modes", async () => {
        const user = userEvent.setup();
        render(<Home />);

        const input = screen.getByRole("textbox");
        await user.type(input, "Learn guitar");
        expect(input).toHaveValue("Learn guitar");

        const projectTab = screen.getByRole("tab", { name: "Project" });
        await user.click(projectTab);

        expect(screen.getByRole("textbox")).toHaveValue("");
    });

    it("preserves existing hero text", () => {
        render(<Home />);
        expect(screen.getByRole("heading", { name: "Archer" })).toBeInTheDocument();
        expect(screen.getByText("Type a goal. Get the next actions.")).toBeInTheDocument();
    });

    it("places toggle below hero text", () => {
        render(<Home />);
        const heading = screen.getByRole("heading", { name: "Archer" });
        const tablist = screen.getByRole("tablist", { name: "Template mode" });
        expect(heading.compareDocumentPosition(tablist)).toBe(
            Node.DOCUMENT_POSITION_FOLLOWING
        );
    });
});

describe("Home page API generation integration", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("calls fetch with goal mode on submit in Goal mode", async () => {
        mockFetchSuccess(MOCK_GOAL_RESPONSE);
        const user = userEvent.setup();
        render(<Home />);

        const input = screen.getByRole("textbox");
        await user.type(input, "Learn guitar");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        expect(global.fetch).toHaveBeenCalledWith("/api/generate", expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ input: "Learn guitar", mode: "goal" }),
        }));
    });

    it("calls fetch with project mode on submit in Project mode", async () => {
        mockFetchSuccess(MOCK_PROJECT_RESPONSE);
        const user = userEvent.setup();
        render(<Home />);

        const projectTab = screen.getByRole("tab", { name: "Project" });
        await user.click(projectTab);

        const input = screen.getByRole("textbox");
        await user.type(input, "Build portfolio");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        expect(global.fetch).toHaveBeenCalledWith("/api/generate", expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ input: "Build portfolio", mode: "project" }),
        }));
    });

    it("shows loading state while generating", async () => {
        // Make fetch never resolve to keep loading state
        global.fetch = vi.fn().mockReturnValue(new Promise(() => { }));
        const user = userEvent.setup();
        render(<Home />);

        const input = screen.getByRole("textbox");
        await user.type(input, "Learn guitar");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        expect(screen.getByText(/Researching and generating/i)).toBeInTheDocument();
    });

    it("shows error message when API returns an error", async () => {
        mockFetchError("OpenAI API key not configured.");
        const user = userEvent.setup();
        render(<Home />);

        const input = screen.getByRole("textbox");
        await user.type(input, "Learn guitar");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(screen.getByRole("alert")).toBeInTheDocument();
            expect(screen.getByText(/OpenAI API key not configured/i)).toBeInTheDocument();
        });
    });

    it("clears output state when mode switches", async () => {
        mockFetchSuccess(MOCK_GOAL_RESPONSE);
        const user = userEvent.setup();
        render(<Home />);

        const input = screen.getByRole("textbox");
        await user.type(input, "Learn guitar");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(screen.getByRole("region", { name: "Generated GTD template" })).toBeInTheDocument();
        });

        const projectTab = screen.getByRole("tab", { name: "Project" });
        await user.click(projectTab);

        expect(screen.queryByRole("region", { name: "Generated GTD template" })).not.toBeInTheDocument();
    });
});

describe("OutputPanel integration with Home page", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("does NOT render OutputPanel when output state is empty (initial load)", () => {
        render(<Home />);
        expect(screen.queryByRole("region", { name: "Generated GTD template" })).not.toBeInTheDocument();
    });

    it("renders OutputPanel after submitting valid input in Goal mode", async () => {
        mockFetchSuccess(MOCK_GOAL_RESPONSE);
        const user = userEvent.setup();
        render(<Home />);

        const input = screen.getByRole("textbox");
        await user.type(input, "Learn guitar");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(screen.getByRole("region", { name: "Generated GTD template" })).toBeInTheDocument();
        });
    });

    it("renders OutputPanel after submitting valid input in Project mode", async () => {
        mockFetchSuccess(MOCK_PROJECT_RESPONSE);
        const user = userEvent.setup();
        render(<Home />);

        const projectTab = screen.getByRole("tab", { name: "Project" });
        await user.click(projectTab);

        const input = screen.getByRole("textbox");
        await user.type(input, "Build portfolio");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(screen.getByRole("region", { name: "Generated GTD template" })).toBeInTheDocument();
        });
    });

    it("OutputPanel disappears when mode is switched (output cleared)", async () => {
        mockFetchSuccess(MOCK_GOAL_RESPONSE);
        const user = userEvent.setup();
        render(<Home />);

        const input = screen.getByRole("textbox");
        await user.type(input, "Learn guitar");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(screen.getByRole("region", { name: "Generated GTD template" })).toBeInTheDocument();
        });

        const projectTab = screen.getByRole("tab", { name: "Project" });
        await user.click(projectTab);

        expect(screen.queryByRole("region", { name: "Generated GTD template" })).not.toBeInTheDocument();
    });

    it("focus moves to OutputPanel after generation", async () => {
        mockFetchSuccess(MOCK_GOAL_RESPONSE);
        const user = userEvent.setup();
        render(<Home />);

        const input = screen.getByRole("textbox");
        await user.type(input, "Learn guitar");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        await waitFor(() => {
            const panel = screen.getByRole("region", { name: "Generated GTD template" });
            expect(document.activeElement).toBe(panel);
        });
    });
});

describe("OutputPanel renders actual template content", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("renders Goal Mode heading and user input after generation", async () => {
        mockFetchSuccess(MOCK_GOAL_RESPONSE);
        const user = userEvent.setup();
        render(<Home />);

        const input = screen.getByRole("textbox");
        await user.type(input, "Learn guitar");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(screen.getByRole("heading", { name: /3-Month Goal/i })).toBeInTheDocument();
            expect(screen.getByText(/Learn guitar/)).toBeInTheDocument();
        });
    });

    it("renders Project Mode content after generation", async () => {
        mockFetchSuccess(MOCK_PROJECT_RESPONSE);
        const user = userEvent.setup();
        render(<Home />);

        const projectTab = screen.getByRole("tab", { name: "Project" });
        await user.click(projectTab);

        const input = screen.getByRole("textbox");
        await user.type(input, "Build portfolio");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(screen.getByText(/Build portfolio website/)).toBeInTheDocument();
        });
    });
});

describe("Reduced motion scroll behavior", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        Object.defineProperty(window, "matchMedia", {
            writable: true,
            value: (query: string) => ({
                matches: false,
                media: query,
                onchange: null,
                addListener: () => { },
                removeListener: () => { },
                addEventListener: () => { },
                removeEventListener: () => { },
                dispatchEvent: () => false,
            }),
        });
    });

    it("uses behavior 'auto' when prefers-reduced-motion is enabled", async () => {
        mockFetchSuccess(MOCK_GOAL_RESPONSE);
        const scrollSpy = vi.fn();
        Element.prototype.scrollIntoView = scrollSpy;

        Object.defineProperty(window, "matchMedia", {
            writable: true,
            value: (query: string) => ({
                matches: query === "(prefers-reduced-motion: reduce)",
                media: query,
                onchange: null,
                addListener: () => { },
                removeListener: () => { },
                addEventListener: () => { },
                removeEventListener: () => { },
                dispatchEvent: () => false,
            }),
        });

        const user = userEvent.setup();
        render(<Home />);

        const input = screen.getByRole("textbox");
        await user.type(input, "Learn guitar");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(scrollSpy).toHaveBeenCalledWith(
                expect.objectContaining({ behavior: "auto" })
            );
        });

        Element.prototype.scrollIntoView = () => { };
    });

    it("uses behavior 'smooth' when prefers-reduced-motion is not enabled", async () => {
        mockFetchSuccess(MOCK_GOAL_RESPONSE);
        const scrollSpy = vi.fn();
        Element.prototype.scrollIntoView = scrollSpy;

        const user = userEvent.setup();
        render(<Home />);

        const input = screen.getByRole("textbox");
        await user.type(input, "Learn guitar");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(scrollSpy).toHaveBeenCalledWith(
                expect.objectContaining({ behavior: "smooth" })
            );
        });

        Element.prototype.scrollIntoView = () => { };
    });
});

describe("ActionBar integration with Home page", () => {
    beforeEach(() => {
        mockFetchSuccess(MOCK_GOAL_RESPONSE);
        mockCopyToClipboard.mockResolvedValue({ success: true });
        mockDownloadMarkdown.mockReturnValue({ success: true });
    });

    afterEach(() => {
        mockCopyToClipboard.mockReset();
        mockDownloadMarkdown.mockReset();
        vi.restoreAllMocks();
    });

    it("does NOT render ActionBar when output is empty (initial load)", () => {
        render(<Home />);
        expect(screen.queryByRole("button", { name: /copy markdown/i })).not.toBeInTheDocument();
    });

    it("renders ActionBar after generating output in Goal mode", async () => {
        const user = userEvent.setup();
        render(<Home />);

        const input = screen.getByRole("textbox");
        await user.type(input, "Learn guitar");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(screen.getByRole("button", { name: /copy markdown/i })).toBeInTheDocument();
        });
    });

    it("renders ActionBar after generating output in Project mode", async () => {
        mockFetchSuccess(MOCK_PROJECT_RESPONSE);
        const user = userEvent.setup();
        render(<Home />);

        const projectTab = screen.getByRole("tab", { name: "Project" });
        await user.click(projectTab);

        const input = screen.getByRole("textbox");
        await user.type(input, "Build portfolio");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(screen.getByRole("button", { name: /copy markdown/i })).toBeInTheDocument();
        });
    });

    it("copy button triggers clipboard write with raw markdown (not HTML)", async () => {
        const user = userEvent.setup();
        render(<Home />);

        const input = screen.getByRole("textbox");
        await user.type(input, "Learn guitar");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(screen.getByRole("button", { name: /copy markdown/i })).toBeInTheDocument();
        });

        const copyButton = screen.getByRole("button", { name: /copy markdown/i });
        await user.click(copyButton);

        expect(mockCopyToClipboard).toHaveBeenCalledTimes(1);
        const calledWith = mockCopyToClipboard.mock.calls[0][0];
        expect(calledWith).toContain("#");
        expect(calledWith).not.toContain("<h1>");
    });

    it("ActionBar disappears when mode is switched (output cleared)", async () => {
        const user = userEvent.setup();
        render(<Home />);

        const input = screen.getByRole("textbox");
        await user.type(input, "Learn guitar");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(screen.getByRole("button", { name: /copy markdown/i })).toBeInTheDocument();
        });

        const projectTab = screen.getByRole("tab", { name: "Project" });
        await user.click(projectTab);

        expect(screen.queryByRole("button", { name: /copy markdown/i })).not.toBeInTheDocument();
    });
});

describe("Download button integration with Home page", () => {
    beforeEach(() => {
        mockFetchSuccess(MOCK_GOAL_RESPONSE);
        mockCopyToClipboard.mockResolvedValue({ success: true });
        mockDownloadMarkdown.mockReturnValue({ success: true });
    });

    afterEach(() => {
        mockCopyToClipboard.mockReset();
        mockDownloadMarkdown.mockReset();
        vi.restoreAllMocks();
    });

    it("does NOT render Download button when output is empty (initial load)", () => {
        render(<Home />);
        expect(screen.queryByRole("button", { name: /download \.md/i })).not.toBeInTheDocument();
    });

    it("renders Download button after generating output", async () => {
        const user = userEvent.setup();
        render(<Home />);

        const input = screen.getByRole("textbox");
        await user.type(input, "Learn guitar");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(screen.getByRole("button", { name: /download \.md/i })).toBeInTheDocument();
        });
    });

    it("download triggers with correct filename format in Goal mode", async () => {
        const user = userEvent.setup();
        render(<Home />);

        const input = screen.getByRole("textbox");
        await user.type(input, "Become a proficient guitarist in 3 months");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(screen.getByRole("button", { name: /download \.md/i })).toBeInTheDocument();
        });

        const downloadButton = screen.getByRole("button", { name: /download \.md/i });
        await user.click(downloadButton);

        expect(mockDownloadMarkdown).toHaveBeenCalledTimes(1);
        const [, filename] = mockDownloadMarkdown.mock.calls[0];
        expect(filename).toBe("archer-goal-become-a-proficient-guitarist-in-3-months.md");
    });

    it("download triggers with correct filename format in Project mode", async () => {
        mockFetchSuccess(MOCK_PROJECT_RESPONSE);
        const user = userEvent.setup();
        render(<Home />);

        const projectTab = screen.getByRole("tab", { name: "Project" });
        await user.click(projectTab);

        const input = screen.getByRole("textbox");
        await user.type(input, "Build portfolio website");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(screen.getByRole("button", { name: /download \.md/i })).toBeInTheDocument();
        });

        const downloadButton = screen.getByRole("button", { name: /download \.md/i });
        await user.click(downloadButton);

        expect(mockDownloadMarkdown).toHaveBeenCalledTimes(1);
        const [, filename] = mockDownloadMarkdown.mock.calls[0];
        expect(filename).toBe("archer-project-build-portfolio-website.md");
    });

    it("Download button disappears when mode is switched (output cleared)", async () => {
        const user = userEvent.setup();
        render(<Home />);

        const input = screen.getByRole("textbox");
        await user.type(input, "Learn guitar");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(screen.getByRole("button", { name: /download \.md/i })).toBeInTheDocument();
        });

        const projectTab = screen.getByRole("tab", { name: "Project" });
        await user.click(projectTab);

        expect(screen.queryByRole("button", { name: /download \.md/i })).not.toBeInTheDocument();
    });
});

describe("Vault persistence integration with Home page", () => {
    beforeEach(() => {
        mockFetchSuccess(MOCK_GOAL_RESPONSE);
        // Clear call history accumulated by earlier describe blocks (which also
        // render <Home /> and trigger save). vi.restoreAllMocks() does not
        // reset a module-factory vi.fn()'s call count, so clear it explicitly.
        mockSave.mockClear();
        mockSave.mockResolvedValue({
            success: true,
            data: {
                id: "test-id",
                inputText: "",
                mode: "goal",
                generationOptions: null,
                outputMarkdown: "",
                createdAt: 0,
            },
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("persists an encrypted vault entry on successful generation (unlocked)", async () => {
        const user = userEvent.setup();
        render(<Home />);

        const input = screen.getByRole("textbox");
        await user.type(input, "Learn guitar");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(screen.getByRole("region", { name: "Generated GTD template" })).toBeInTheDocument();
        });

        expect(mockSave).toHaveBeenCalledTimes(1);
        expect(mockSave).toHaveBeenCalledWith(
            expect.objectContaining({
                inputText: "Learn guitar",
                mode: "goal",
                generationOptions: null,
                outputMarkdown: MOCK_GOAL_RESPONSE,
            })
        );
    });

    it("does not call save when generation fails", async () => {
        mockFetchError("OpenAI API key not configured.");
        const user = userEvent.setup();
        render(<Home />);

        const input = screen.getByRole("textbox");
        await user.type(input, "Learn guitar");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(screen.getByRole("alert")).toBeInTheDocument();
        });

        expect(mockSave).not.toHaveBeenCalled();
    });

    it("does not save but keeps output when the session is locked", async () => {
        mockUseVaultSession.mockReturnValue(makeSession({ unlocked: false }));
        const user = userEvent.setup();
        render(<Home />);

        const input = screen.getByRole("textbox");
        await user.type(input, "Learn guitar");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(screen.getByText(/unlock your vault/i)).toBeInTheDocument();
        });

        expect(mockSave).not.toHaveBeenCalled();
        // Output is still visible despite not saving.
        expect(screen.getByRole("region", { name: "Generated GTD template" })).toBeInTheDocument();
    });

    it("shows a save-failure notice while keeping output visible", async () => {
        mockSave.mockResolvedValue({ success: false, reason: "unknown" });
        const user = userEvent.setup();
        render(<Home />);

        const input = screen.getByRole("textbox");
        await user.type(input, "Learn guitar");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(screen.getByText(/couldn't save to your local vault/i)).toBeInTheDocument();
        });

        // Output remains rendered despite the save failure.
        expect(screen.getByRole("region", { name: "Generated GTD template" })).toBeInTheDocument();
    });

    it("shows a quota-specific message when the vault is full", async () => {
        mockSave.mockResolvedValue({ success: false, reason: "quota" });
        const user = userEvent.setup();
        render(<Home />);

        const input = screen.getByRole("textbox");
        await user.type(input, "Learn guitar");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(screen.getByText(/storage is full/i)).toBeInTheDocument();
        });

        expect(screen.getByRole("region", { name: "Generated GTD template" })).toBeInTheDocument();
    });

    it("dismisses the save-failure notice when Dismiss is clicked", async () => {
        mockSave.mockResolvedValue({ success: false, reason: "unknown" });
        const user = userEvent.setup();
        render(<Home />);

        const input = screen.getByRole("textbox");
        await user.type(input, "Learn guitar");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(screen.getByText(/couldn't save to your local vault/i)).toBeInTheDocument();
        });

        await user.click(screen.getByRole("button", { name: /dismiss save notice/i }));

        expect(screen.queryByText(/couldn't save to your local vault/i)).not.toBeInTheDocument();
        // Output still visible after dismissing.
        expect(screen.getByRole("region", { name: "Generated GTD template" })).toBeInTheDocument();
    });
});

describe("Saved-breakdowns view and restore integration", () => {
    beforeEach(() => {
        mockFetchSuccess(MOCK_GOAL_RESPONSE);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("opens the saved-breakdowns view from the header button", async () => {
        const user = userEvent.setup();
        render(<Home />);

        await user.click(screen.getByRole("button", { name: /saved breakdowns/i }));

        expect(screen.getByRole("region", { name: "Saved breakdowns" })).toBeInTheDocument();
    });

    it("restores an entry: rehydrates output, mode, input, and options", async () => {
        const restored: VaultEntry = {
            id: "restore-1",
            inputText: "Restored goal",
            mode: "project",
            generationOptions: { depth: "deep" },
            outputMarkdown: "# Restored output\n\nExact markdown",
            createdAt: 42,
        };
        mockUseVaultSession.mockReturnValue(
            makeSession({ unlocked: true, entries: [restored] })
        );

        const user = userEvent.setup();
        render(<Home />);

        await user.click(screen.getByRole("button", { name: /saved breakdowns/i }));
        await user.click(screen.getByRole("button", { name: "Restore" }));

        // Output panel shows the saved markdown exactly.
        await waitFor(() => {
            expect(
                screen.getByRole("region", { name: "Generated GTD template" })
            ).toBeInTheDocument();
        });
        expect(screen.getByText(/Restored output/)).toBeInTheDocument();

        // Mode switched to the saved mode.
        expect(screen.getByRole("tab", { name: "Project" })).toHaveAttribute(
            "aria-selected",
            "true"
        );
        // Input rehydrated.
        expect(screen.getByRole("textbox")).toHaveValue("Restored goal");

        // Generation options are restored to an observable surface exactly as
        // saved (FR37 / AC2 "options match"). The output section mirrors them
        // onto data-generation-options; a non-null payload must survive the
        // restore round-trip with fidelity.
        const outputRegion = screen.getByRole("region", {
            name: "Generated GTD template",
        });
        const outputSection = outputRegion.closest(
            "section[data-generation-options]"
        );
        expect(outputSection).not.toBeNull();
        expect(outputSection).toHaveAttribute(
            "data-generation-options",
            JSON.stringify({ depth: "deep" })
        );
    });

    it("importing from the saved view surfaces the outcome message", async () => {
        mockUseVaultSession.mockReturnValue(
            makeSession({ unlocked: true, entries: [] })
        );
        mockImportVault.mockResolvedValue({
            success: true,
            data: { outcome: "merged", count: 2 },
        });

        const user = userEvent.setup();
        render(<Home />);

        await user.click(screen.getByRole("button", { name: /saved breakdowns/i }));

        const file = new File(['{"schemaVersion":1}'], "archer-vault.json", {
            type: "application/json",
        });
        const input = screen.getByLabelText("Import vault file") as HTMLInputElement;
        await user.upload(input, file);

        await waitFor(() => {
            expect(mockImportVault).toHaveBeenCalledWith('{"schemaVersion":1}');
        });
        await waitFor(() => {
            expect(screen.getByText(/merged/i)).toBeInTheDocument();
        });
    });

    it("surfaces the 'replaced' message when import replaces the vault", async () => {
        mockUseVaultSession.mockReturnValue(
            makeSession({ unlocked: true, entries: [] })
        );
        mockImportVault.mockResolvedValue({
            success: true,
            data: { outcome: "replaced", count: 0 },
        });

        const user = userEvent.setup();
        render(<Home />);

        await user.click(screen.getByRole("button", { name: /saved breakdowns/i }));

        const file = new File(['{"schemaVersion":1}'], "archer-vault.json", {
            type: "application/json",
        });
        const input = screen.getByLabelText("Import vault file") as HTMLInputElement;
        await user.upload(input, file);

        await waitFor(() => {
            expect(screen.getByText(/replaced/i)).toBeInTheDocument();
        });
        // The merged wording must NOT appear on the replace path.
        expect(screen.queryByText(/merged/i)).not.toBeInTheDocument();
    });

    it("uses singular 'breakdown' wording when a merge yields exactly one entry", async () => {
        mockUseVaultSession.mockReturnValue(
            makeSession({ unlocked: true, entries: [] })
        );
        mockImportVault.mockResolvedValue({
            success: true,
            data: { outcome: "merged", count: 1 },
        });

        const user = userEvent.setup();
        render(<Home />);

        await user.click(screen.getByRole("button", { name: /saved breakdowns/i }));

        const file = new File(['{"schemaVersion":1}'], "archer-vault.json", {
            type: "application/json",
        });
        const input = screen.getByLabelText("Import vault file") as HTMLInputElement;
        await user.upload(input, file);

        await waitFor(() => {
            expect(
                screen.getByText(/1 saved breakdown total/i)
            ).toBeInTheDocument();
        });
    });

    it("surfaces a storage-specific message when import fails on a full store", async () => {
        mockUseVaultSession.mockReturnValue(
            makeSession({ unlocked: true, entries: [] })
        );
        mockImportVault.mockResolvedValue({ success: false, reason: "quota" });

        const user = userEvent.setup();
        render(<Home />);

        await user.click(screen.getByRole("button", { name: /saved breakdowns/i }));

        const file = new File(['{"schemaVersion":1}'], "archer-vault.json", {
            type: "application/json",
        });
        const input = screen.getByLabelText("Import vault file") as HTMLInputElement;
        await user.upload(input, file);

        await waitFor(() => {
            expect(screen.getByText(/storage is full/i)).toBeInTheDocument();
        });
        // A storage failure must not be mislabeled as an invalid file.
        expect(
            screen.queryByText(/isn't a valid vault export/i)
        ).not.toBeInTheDocument();
    });

    it("exporting from the saved view surfaces a success message", async () => {
        mockUseVaultSession.mockReturnValue(
            makeSession({ unlocked: true, entries: [] })
        );
        mockExportVault.mockReturnValue({
            success: true,
            data: { filename: "archer-vault.json" },
        });

        const user = userEvent.setup();
        render(<Home />);

        await user.click(screen.getByRole("button", { name: /saved breakdowns/i }));
        await user.click(screen.getByRole("button", { name: /export vault/i }));

        expect(mockExportVault).toHaveBeenCalledTimes(1);
        expect(
            screen.getByText(/vault exported to archer-vault\.json/i)
        ).toBeInTheDocument();
    });

    it("restore does not go through the mode-change reset (output kept)", async () => {
        const restored: VaultEntry = {
            id: "restore-2",
            inputText: "Keep me",
            mode: "goal",
            generationOptions: null,
            outputMarkdown: "# Kept output",
            createdAt: 7,
        };
        mockUseVaultSession.mockReturnValue(
            makeSession({ unlocked: true, entries: [restored] })
        );

        const user = userEvent.setup();
        render(<Home />);

        await user.click(screen.getByRole("button", { name: /saved breakdowns/i }));
        await user.click(screen.getByRole("button", { name: "Restore" }));

        await waitFor(() => {
            expect(screen.getByText(/Kept output/)).toBeInTheDocument();
        });
        expect(screen.getByRole("textbox")).toHaveValue("Keep me");
    });
});
