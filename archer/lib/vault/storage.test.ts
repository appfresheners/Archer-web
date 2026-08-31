import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    VAULT_KEY,
    clearVault,
    deleteEntry,
    listEntries,
    readEntry,
    saveEntry,
    type NewEntryInput,
} from "./storage";
import type { VaultSchema } from "./types";

function makeInput(overrides: Partial<NewEntryInput> = {}): NewEntryInput {
    return {
        inputText: "Learn guitar",
        mode: "goal",
        generationOptions: null,
        outputMarkdown: "# My 3-Month Goal\n\nLearn guitar",
        ...overrides,
    };
}

describe("vault storage", () => {
    beforeEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    afterEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    describe("saveEntry", () => {
        it("appends a new entry with a generated id and createdAt", () => {
            const before = Date.now();
            const result = saveEntry(makeInput());
            const after = Date.now();

            expect(result.success).toBe(true);
            if (!result.success) return;

            const entry = result.data;
            expect(typeof entry.id).toBe("string");
            expect(entry.id.length).toBeGreaterThan(0);
            expect(entry.inputText).toBe("Learn guitar");
            expect(entry.mode).toBe("goal");
            expect(entry.generationOptions).toBeNull();
            expect(entry.outputMarkdown).toContain("Learn guitar");
            expect(entry.createdAt).toBeGreaterThanOrEqual(before);
            expect(entry.createdAt).toBeLessThanOrEqual(after);
        });

        it("persists the entry so it can be read back (round-trip)", () => {
            const result = saveEntry(makeInput());
            expect(result.success).toBe(true);
            if (!result.success) return;

            const entries = listEntries();
            expect(entries).toHaveLength(1);
            expect(entries[0]).toEqual(result.data);
        });

        it("generates unique ids across saves", () => {
            const a = saveEntry(makeInput());
            const b = saveEntry(makeInput());
            expect(a.success && b.success).toBe(true);
            if (!a.success || !b.success) return;
            expect(a.data.id).not.toBe(b.data.id);
        });

        it("appends without dropping existing entries", () => {
            saveEntry(makeInput({ inputText: "first" }));
            saveEntry(makeInput({ inputText: "second" }));

            const entries = listEntries();
            expect(entries.map((e) => e.inputText)).toEqual(["first", "second"]);
        });

        it("stores a versioned schema container", () => {
            saveEntry(makeInput());
            const raw = localStorage.getItem(VAULT_KEY);
            expect(raw).not.toBeNull();
            const parsed = JSON.parse(raw as string) as VaultSchema;
            expect(parsed.schemaVersion).toBe(1);
            expect(Array.isArray(parsed.entries)).toBe(true);
        });

        it("returns { success: false, reason: 'unknown' } when setItem throws a non-quota error", () => {
            vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
                throw new Error("blocked");
            });

            const result = saveEntry(makeInput());
            expect(result).toEqual({ success: false, reason: "unknown" });
        });

        it("returns { success: false, reason: 'quota' } when setItem throws QuotaExceededError", () => {
            vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
                const err = new Error("full");
                err.name = "QuotaExceededError";
                throw err;
            });

            const result = saveEntry(makeInput());
            expect(result).toEqual({ success: false, reason: "quota" });
        });

        it("returns { success: false, reason: 'quota' } for the numeric quota code", () => {
            vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
                const err = new Error("full") as Error & { code?: number };
                err.code = 22;
                throw err;
            });

            const result = saveEntry(makeInput());
            expect(result).toEqual({ success: false, reason: "quota" });
        });

        it("returns { success: false, reason: 'quota' } for the Firefox quota name", () => {
            vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
                const err = new Error("full");
                err.name = "NS_ERROR_DOM_QUOTA_REACHED";
                throw err;
            });

            const result = saveEntry(makeInput());
            expect(result).toEqual({ success: false, reason: "quota" });
        });

        it("returns { success: false, reason: 'quota' } for the Firefox numeric code 1014", () => {
            vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
                const err = new Error("full") as Error & { code?: number };
                err.code = 1014;
                throw err;
            });

            const result = saveEntry(makeInput());
            expect(result).toEqual({ success: false, reason: "quota" });
        });

        it("still saves (does not throw) when crypto.randomUUID is unavailable", () => {
            const original = globalThis.crypto;
            // Simulate an insecure context where randomUUID is not exposed.
            Object.defineProperty(globalThis, "crypto", {
                value: { ...original, randomUUID: undefined },
                configurable: true,
            });

            try {
                const result = saveEntry(makeInput());
                expect(result.success).toBe(true);
                if (!result.success) return;
                expect(typeof result.data.id).toBe("string");
                expect(result.data.id.length).toBeGreaterThan(0);
            } finally {
                Object.defineProperty(globalThis, "crypto", {
                    value: original,
                    configurable: true,
                });
            }
        });

        it("does not persist anything when the write fails", () => {
            vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
                throw new Error("blocked");
            });

            saveEntry(makeInput());

            // getItem still works — nothing was written.
            expect(localStorage.getItem(VAULT_KEY)).toBeNull();
        });
    });

    describe("listEntries", () => {
        it("returns [] for an empty vault", () => {
            expect(listEntries()).toEqual([]);
        });

        it("allows newest-first ordering by createdAt", () => {
            const now = 1_000;
            const spy = vi.spyOn(Date, "now");
            spy.mockReturnValueOnce(now);
            saveEntry(makeInput({ inputText: "older" }));
            spy.mockReturnValueOnce(now + 5_000);
            saveEntry(makeInput({ inputText: "newer" }));

            const newestFirst = [...listEntries()].sort(
                (a, b) => b.createdAt - a.createdAt
            );
            expect(newestFirst.map((e) => e.inputText)).toEqual([
                "newer",
                "older",
            ]);
        });
    });

    describe("readEntry", () => {
        it("returns the matching entry by id", () => {
            const result = saveEntry(makeInput());
            if (!result.success) throw new Error("save failed");
            expect(readEntry(result.data.id)).toEqual(result.data);
        });

        it("returns null when the id is not found", () => {
            saveEntry(makeInput());
            expect(readEntry("does-not-exist")).toBeNull();
        });

        it("returns null on an empty vault", () => {
            expect(readEntry("anything")).toBeNull();
        });
    });

    describe("deleteEntry", () => {
        it("removes a matching entry and returns success", () => {
            const result = saveEntry(makeInput());
            if (!result.success) throw new Error("save failed");

            const del = deleteEntry(result.data.id);
            expect(del.success).toBe(true);
            expect(listEntries()).toEqual([]);
        });

        it("leaves other entries intact", () => {
            const a = saveEntry(makeInput({ inputText: "keep" }));
            const b = saveEntry(makeInput({ inputText: "remove" }));
            if (!a.success || !b.success) throw new Error("save failed");

            deleteEntry(b.data.id);
            const entries = listEntries();
            expect(entries).toHaveLength(1);
            expect(entries[0].inputText).toBe("keep");
        });

        it("is a no-op success when the id is absent", () => {
            saveEntry(makeInput());
            const del = deleteEntry("does-not-exist");
            expect(del.success).toBe(true);
            expect(listEntries()).toHaveLength(1);
        });

        it("is a no-op success on an empty vault (no write attempted)", () => {
            const setSpy = vi.spyOn(Storage.prototype, "setItem");
            const del = deleteEntry("anything");
            expect(del.success).toBe(true);
            expect(setSpy).not.toHaveBeenCalled();
        });
    });

    describe("clearVault", () => {
        it("removes all entries", () => {
            saveEntry(makeInput());
            saveEntry(makeInput());

            const result = clearVault();
            expect(result.success).toBe(true);
            expect(listEntries()).toEqual([]);
        });

        it("returns a typed failure when the write fails", () => {
            vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
                throw new Error("blocked");
            });
            const result = clearVault();
            expect(result.success).toBe(false);
        });
    });

    describe("corrupt / wrong-shaped data", () => {
        it("treats unparseable JSON as an empty vault on read", () => {
            localStorage.setItem(VAULT_KEY, "{not valid json");
            expect(listEntries()).toEqual([]);
            expect(readEntry("x")).toBeNull();
        });

        it("treats wrong-shaped data (no entries array) as empty", () => {
            localStorage.setItem(VAULT_KEY, JSON.stringify({ schemaVersion: 1 }));
            expect(listEntries()).toEqual([]);
        });

        it("allows a fresh save after corrupt data without crashing", () => {
            localStorage.setItem(VAULT_KEY, "garbage");
            const result = saveEntry(makeInput());
            expect(result.success).toBe(true);
            // The corrupt blob is replaced with a valid container.
            expect(listEntries()).toHaveLength(1);
        });
    });

    describe("storage unavailable", () => {
        it("reads as empty when getItem throws", () => {
            vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
                throw new Error("unavailable");
            });
            expect(listEntries()).toEqual([]);
            expect(readEntry("x")).toBeNull();
        });
    });

    describe("client-side only (NFR8)", () => {
        it("saveEntry makes no network request", () => {
            const fetchSpy = vi.fn();
            // Fail the test loudly if the storage layer ever reaches the network.
            vi.stubGlobal("fetch", fetchSpy);
            try {
                const result = saveEntry(makeInput());
                expect(result.success).toBe(true);
                expect(fetchSpy).not.toHaveBeenCalled();
            } finally {
                vi.unstubAllGlobals();
            }
        });

        it("read/list/delete/clear make no network request", () => {
            const fetchSpy = vi.fn();
            vi.stubGlobal("fetch", fetchSpy);
            try {
                saveEntry(makeInput());
                listEntries();
                readEntry("x");
                deleteEntry("x");
                clearVault();
                expect(fetchSpy).not.toHaveBeenCalled();
            } finally {
                vi.unstubAllGlobals();
            }
        });
    });
});
