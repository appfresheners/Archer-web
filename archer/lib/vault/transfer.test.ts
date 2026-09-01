/**
 * Unit tests for the pure vault export/import core (Story 4.4).
 *
 * These run against the REAL encrypted-storage layer using jsdom's
 * localStorage + Web Crypto (verified available in 4.2/4.3), covering every
 * row of the spec's I/O & Edge-Case Matrix:
 *   - export populated / empty
 *   - import replace / merge (dedupe by id, imported wins)
 *   - invalid JSON / wrong shape / empty file
 *   - export→import round-trip (entries preserved after unlock)
 *   - storage unavailable
 *   - a no-network assertion (fetch stubbed, expected zero calls)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    ENCRYPTED_VAULT_KEY,
    listEntriesEncrypted,
    type NewEntryInput,
    saveEntryEncrypted,
} from "./encrypted-storage";
import {
    EXPORT_FILENAME,
    exportVault,
    importVault,
} from "./transfer";

const PASSPHRASE = "correct horse battery staple";

function entryInput(overrides: Partial<NewEntryInput> = {}): NewEntryInput {
    return {
        inputText: "Learn guitar",
        mode: "goal",
        generationOptions: null,
        outputMarkdown: "# Goal",
        ...overrides,
    };
}

/** Stub URL.createObjectURL / revokeObjectURL + anchor click for downloads. */
function stubDownload() {
    const createObjectURL = vi
        .fn()
        .mockReturnValue("blob:http://localhost/fake");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
        value: createObjectURL,
        writable: true,
        configurable: true,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
        value: revokeObjectURL,
        writable: true,
        configurable: true,
    });
    const clickSpy = vi.fn();
    const appendChild = vi
        .spyOn(document.body, "appendChild")
        .mockImplementation((node) => {
            if (node instanceof HTMLAnchorElement) {
                node.click = clickSpy;
            }
            return node;
        });
    const removeChild = vi
        .spyOn(document.body, "removeChild")
        .mockImplementation((node) => node);
    return { createObjectURL, revokeObjectURL, clickSpy, appendChild, removeChild };
}

describe("exportVault", () => {
    beforeEach(() => {
        localStorage.clear();
    });
    afterEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it("downloads the raw encrypted envelope for a populated vault", async () => {
        await saveEntryEncrypted(PASSPHRASE, entryInput());
        const raw = localStorage.getItem(ENCRYPTED_VAULT_KEY);
        const { createObjectURL } = stubDownload();

        const result = exportVault();

        expect(result).toEqual({
            success: true,
            data: { filename: EXPORT_FILENAME },
        });
        // The downloaded Blob content is the stored ciphertext verbatim.
        expect(createObjectURL).toHaveBeenCalledTimes(1);
        const blob = createObjectURL.mock.calls[0][0] as Blob;
        expect(blob.type).toBe("application/json");
        const text = await blob.text();
        expect(text).toBe(raw);
        // Payload is ciphertext — the plaintext goal text is NOT present.
        expect(text).not.toContain("Learn guitar");
        expect(text).not.toContain("# Goal");
    });

    it("refuses to export an empty vault (nothing stored)", () => {
        stubDownload();
        const result = exportVault();
        expect(result).toEqual({ success: false, reason: "unavailable" });
    });
});

describe("importVault validation (no partial write)", () => {
    beforeEach(() => {
        localStorage.clear();
    });
    afterEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it("rejects non-JSON text and leaves storage untouched", async () => {
        await saveEntryEncrypted(PASSPHRASE, entryInput());
        const before = localStorage.getItem(ENCRYPTED_VAULT_KEY);

        const result = await importVault("this is not json {");

        expect(result).toEqual({ success: false, reason: "unknown" });
        expect(localStorage.getItem(ENCRYPTED_VAULT_KEY)).toBe(before);
    });

    it("rejects JSON with the wrong shape and leaves storage untouched", async () => {
        await saveEntryEncrypted(PASSPHRASE, entryInput());
        const before = localStorage.getItem(ENCRYPTED_VAULT_KEY);

        const result = await importVault(
            JSON.stringify({ salt: "abc", iv: 123 }),
        );

        expect(result).toEqual({ success: false, reason: "unknown" });
        expect(localStorage.getItem(ENCRYPTED_VAULT_KEY)).toBe(before);
    });

    it("rejects an empty file and leaves storage untouched", async () => {
        await saveEntryEncrypted(PASSPHRASE, entryInput());
        const before = localStorage.getItem(ENCRYPTED_VAULT_KEY);

        const result = await importVault("   ");

        expect(result).toEqual({ success: false, reason: "unknown" });
        expect(localStorage.getItem(ENCRYPTED_VAULT_KEY)).toBe(before);
    });
});

describe("importVault replace", () => {
    beforeEach(() => {
        localStorage.clear();
    });
    afterEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it("replaces the stored vault when there is no session passphrase", async () => {
        // Build an imported envelope from a separate vault, then clear storage.
        await saveEntryEncrypted(PASSPHRASE, entryInput({ inputText: "IMPORTED" }));
        const importedFile = localStorage.getItem(ENCRYPTED_VAULT_KEY) as string;
        localStorage.clear();

        // Seed a different current vault.
        await saveEntryEncrypted("other pass", entryInput({ inputText: "CURRENT" }));

        const result = await importVault(importedFile);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.outcome).toBe("replaced");
        }
        // Stored envelope is now exactly the imported file.
        expect(localStorage.getItem(ENCRYPTED_VAULT_KEY)).toBe(importedFile);
        // And it decrypts under the imported passphrase.
        const listed = await listEntriesEncrypted(PASSPHRASE);
        expect(listed.success).toBe(true);
        if (listed.success) {
            expect(listed.data.map((e) => e.inputText)).toEqual(["IMPORTED"]);
        }
    });

    it("replaces (not merges) when the session passphrase differs", async () => {
        await saveEntryEncrypted("import pass", entryInput({ inputText: "IMPORTED" }));
        const importedFile = localStorage.getItem(ENCRYPTED_VAULT_KEY) as string;
        localStorage.clear();

        await saveEntryEncrypted(PASSPHRASE, entryInput({ inputText: "CURRENT" }));

        // Session passphrase decrypts current but NOT imported → replace.
        const result = await importVault(importedFile, { passphrase: PASSPHRASE });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.outcome).toBe("replaced");
        }
        expect(localStorage.getItem(ENCRYPTED_VAULT_KEY)).toBe(importedFile);
    });
});

describe("importVault merge", () => {
    beforeEach(() => {
        localStorage.clear();
    });
    afterEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it("unions the entries of both vaults when the session decrypts both", async () => {
        // Build an imported vault (same passphrase) with its own entries.
        await saveEntryEncrypted(PASSPHRASE, entryInput({ inputText: "imported-1" }));
        await saveEntryEncrypted(PASSPHRASE, entryInput({ inputText: "imported-2" }));
        const importedFile = localStorage.getItem(ENCRYPTED_VAULT_KEY) as string;

        // Replace storage with a different current vault (same passphrase).
        localStorage.clear();
        await saveEntryEncrypted(PASSPHRASE, entryInput({ inputText: "current-1" }));

        const result = await importVault(importedFile, { passphrase: PASSPHRASE });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.outcome).toBe("merged");
            expect(result.data.count).toBe(3);
        }

        const merged = await listEntriesEncrypted(PASSPHRASE);
        expect(merged.success).toBe(true);
        if (merged.success) {
            expect(merged.data.map((e) => e.inputText).sort()).toEqual(
                ["current-1", "imported-1", "imported-2"],
            );
        }
    });

    it("importing the same vault into itself is a no-op union (dedupe by id)", async () => {
        await saveEntryEncrypted(PASSPHRASE, entryInput({ inputText: "A" }));
        await saveEntryEncrypted(PASSPHRASE, entryInput({ inputText: "B" }));
        const selfFile = localStorage.getItem(ENCRYPTED_VAULT_KEY) as string;

        const before = await listEntriesEncrypted(PASSPHRASE);
        if (!before.success) throw new Error("list failed");
        const beforeIds = before.data.map((e) => e.id).sort();

        const result = await importVault(selfFile, { passphrase: PASSPHRASE });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.outcome).toBe("merged");
            expect(result.data.count).toBe(2);
        }
        const after = await listEntriesEncrypted(PASSPHRASE);
        if (!after.success) throw new Error("list failed");
        // Same ids, no duplicates.
        expect(after.data.map((e) => e.id).sort()).toEqual(beforeIds);
    });
});

describe("export → import round-trip", () => {
    beforeEach(() => {
        localStorage.clear();
    });
    afterEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it("preserves all entries after export into a fresh vault (unlock recovers them)", async () => {
        await saveEntryEncrypted(PASSPHRASE, entryInput({ inputText: "one" }));
        await saveEntryEncrypted(PASSPHRASE, entryInput({ inputText: "two" }));
        await saveEntryEncrypted(PASSPHRASE, entryInput({ inputText: "three" }));

        const { createObjectURL } = stubDownload();
        const exported = exportVault();
        expect(exported.success).toBe(true);
        const blob = createObjectURL.mock.calls[0][0] as Blob;
        const fileText = await blob.text();

        // Fresh browser/profile: wipe storage.
        localStorage.clear();
        expect(localStorage.getItem(ENCRYPTED_VAULT_KEY)).toBeNull();

        const imported = await importVault(fileText);
        expect(imported.success).toBe(true);
        if (imported.success) {
            expect(imported.data.outcome).toBe("replaced");
        }

        const listed = await listEntriesEncrypted(PASSPHRASE);
        expect(listed.success).toBe(true);
        if (listed.success) {
            expect(listed.data.map((e) => e.inputText).sort()).toEqual(
                ["one", "three", "two"],
            );
        }
    });
});

describe("storage unavailable", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("export fails gracefully when localStorage is absent", () => {
        const original = Object.getOwnPropertyDescriptor(
            globalThis,
            "localStorage",
        );
        Object.defineProperty(globalThis, "localStorage", {
            configurable: true,
            get() {
                throw new Error("SecurityError");
            },
        });
        try {
            const result = exportVault();
            expect(result).toEqual({ success: false, reason: "unavailable" });
        } finally {
            if (original) {
                Object.defineProperty(globalThis, "localStorage", original);
            }
        }
    });

    it("import fails gracefully when localStorage is absent", async () => {
        // Build a valid envelope first, then remove storage before importing.
        localStorage.clear();
        await saveEntryEncrypted(PASSPHRASE, entryInput());
        const file = localStorage.getItem(ENCRYPTED_VAULT_KEY) as string;

        const original = Object.getOwnPropertyDescriptor(
            globalThis,
            "localStorage",
        );
        Object.defineProperty(globalThis, "localStorage", {
            configurable: true,
            get() {
                throw new Error("SecurityError");
            },
        });
        try {
            const result = await importVault(file);
            expect(result).toEqual({ success: false, reason: "unavailable" });
        } finally {
            if (original) {
                Object.defineProperty(globalThis, "localStorage", original);
            }
            localStorage.clear();
        }
    });
});

describe("no network", () => {
    beforeEach(() => {
        localStorage.clear();
    });
    afterEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it("makes zero fetch calls during export and import", async () => {
        const fetchSpy = vi.fn();
        vi.stubGlobal("fetch", fetchSpy);

        await saveEntryEncrypted(PASSPHRASE, entryInput());
        stubDownload();
        exportVault();

        const file = localStorage.getItem(ENCRYPTED_VAULT_KEY) as string;
        localStorage.clear();
        await importVault(file);

        expect(fetchSpy).not.toHaveBeenCalled();
        vi.unstubAllGlobals();
    });
});
