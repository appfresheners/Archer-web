/**
 * Unit tests for the vault session hook.
 *
 * These run the hook against the REAL encrypted-storage layer using jsdom's
 * localStorage + Web Crypto (verified available in 4.2), so the session seam
 * is exercised end-to-end: unlock success/empty/wrong-passphrase, list
 * ordering (most-recent-first), delete-in-place, clear, and the `unavailable`
 * mapping when storage is absent.
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { NewEntryInput } from "./encrypted-storage";
import {
    ENCRYPTED_VAULT_KEY,
    saveEntryEncrypted,
} from "./encrypted-storage";
import { useVaultSession } from "./useVaultSession";

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

describe("useVaultSession", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
    });

    it("unlocks an empty vault with any passphrase (no entries, no error)", async () => {
        const { result } = renderHook(() => useVaultSession());

        let outcome;
        await act(async () => {
            outcome = await result.current.unlock(PASSPHRASE);
        });

        expect(outcome).toEqual({ success: true, data: [] });
        expect(result.current.unlocked).toBe(true);
        expect(result.current.entries).toEqual([]);
    });

    it("unlocks a populated vault with the correct passphrase", async () => {
        await saveEntryEncrypted(PASSPHRASE, entryInput({ inputText: "A" }));

        const { result } = renderHook(() => useVaultSession());
        await act(async () => {
            await result.current.unlock(PASSPHRASE);
        });

        expect(result.current.unlocked).toBe(true);
        expect(result.current.entries).toHaveLength(1);
        expect(result.current.entries[0].inputText).toBe("A");
    });

    it("rejects a wrong passphrase with reason 'decrypt' and leaks nothing", async () => {
        await saveEntryEncrypted(PASSPHRASE, entryInput());

        const { result } = renderHook(() => useVaultSession());
        let outcome;
        await act(async () => {
            outcome = await result.current.unlock("wrong passphrase");
        });

        expect(outcome).toEqual({ success: false, reason: "decrypt" });
        expect(result.current.unlocked).toBe(false);
        expect(result.current.entries).toEqual([]);
    });

    it("lists entries most-recent-first by createdAt", async () => {
        // Seed three entries with increasing createdAt by writing directly.
        await saveEntryEncrypted(PASSPHRASE, entryInput({ inputText: "oldest" }));
        await new Promise((r) => setTimeout(r, 2));
        await saveEntryEncrypted(PASSPHRASE, entryInput({ inputText: "middle" }));
        await new Promise((r) => setTimeout(r, 2));
        await saveEntryEncrypted(PASSPHRASE, entryInput({ inputText: "newest" }));

        const { result } = renderHook(() => useVaultSession());
        await act(async () => {
            await result.current.unlock(PASSPHRASE);
        });

        expect(result.current.entries.map((e) => e.inputText)).toEqual([
            "newest",
            "middle",
            "oldest",
        ]);
    });

    it("saves a new entry through the session and shows it first", async () => {
        const { result } = renderHook(() => useVaultSession());
        await act(async () => {
            await result.current.unlock(PASSPHRASE);
        });

        await act(async () => {
            await result.current.save(entryInput({ inputText: "first" }));
        });
        await act(async () => {
            await result.current.save(entryInput({ inputText: "second" }));
        });

        expect(result.current.entries).toHaveLength(2);
        expect(result.current.entries[0].inputText).toBe("second");
    });

    it("deletes a single entry in place without re-reading the whole list", async () => {
        const saved = await saveEntryEncrypted(
            PASSPHRASE,
            entryInput({ inputText: "keep" }),
        );
        const toDelete = await saveEntryEncrypted(
            PASSPHRASE,
            entryInput({ inputText: "remove" }),
        );
        if (!saved.success || !toDelete.success) throw new Error("seed failed");

        const { result } = renderHook(() => useVaultSession());
        await act(async () => {
            await result.current.unlock(PASSPHRASE);
        });
        expect(result.current.entries).toHaveLength(2);

        await act(async () => {
            await result.current.remove(toDelete.data.id);
        });

        expect(result.current.entries).toHaveLength(1);
        expect(result.current.entries[0].inputText).toBe("keep");
    });

    it("clears the vault and empties the in-memory list", async () => {
        await saveEntryEncrypted(PASSPHRASE, entryInput());

        const { result } = renderHook(() => useVaultSession());
        await act(async () => {
            await result.current.unlock(PASSPHRASE);
        });
        expect(result.current.entries).toHaveLength(1);

        await act(async () => {
            await result.current.clear();
        });

        expect(result.current.entries).toEqual([]);
        expect(localStorage.getItem(ENCRYPTED_VAULT_KEY)).toBeNull();
    });

    it("locks the session, forgetting the passphrase and entries", async () => {
        await saveEntryEncrypted(PASSPHRASE, entryInput());
        const { result } = renderHook(() => useVaultSession());
        await act(async () => {
            await result.current.unlock(PASSPHRASE);
        });
        expect(result.current.unlocked).toBe(true);

        act(() => {
            result.current.lock();
        });

        expect(result.current.unlocked).toBe(false);
        expect(result.current.entries).toEqual([]);
    });

    it("unlock treats absent storage as an empty vault (graceful degradation)", async () => {
        const original = Object.getOwnPropertyDescriptor(
            globalThis,
            "localStorage",
        );
        // Simulate storage being absent/throwing on access.
        Object.defineProperty(globalThis, "localStorage", {
            configurable: true,
            get() {
                throw new Error("SecurityError");
            },
        });

        try {
            const { result } = renderHook(() => useVaultSession());
            let outcome;
            await act(async () => {
                outcome = await result.current.save(entryInput());
            });
            // save without a prior unlock returns decrypt guard; unlock first.
            await act(async () => {
                outcome = await result.current.unlock(PASSPHRASE);
            });
            // With no storage, readVault sees no envelope → treated as empty
            // vault and unlock succeeds with zero entries. This documents the
            // graceful-degradation contract from 4.2.
            expect(outcome).toEqual({ success: true, data: [] });
        } finally {
            if (original) {
                Object.defineProperty(globalThis, "localStorage", original);
            }
        }
    });

    it("returns 'unavailable' when saving with storage absent", async () => {
        const { result } = renderHook(() => useVaultSession());
        await act(async () => {
            await result.current.unlock(PASSPHRASE);
        });

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
            let outcome;
            await act(async () => {
                outcome = await result.current.save(entryInput());
            });
            expect(outcome).toEqual({ success: false, reason: "unavailable" });
        } finally {
            if (original) {
                Object.defineProperty(globalThis, "localStorage", original);
            }
        }
    });
});
