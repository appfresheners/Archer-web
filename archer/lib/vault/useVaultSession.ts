/**
 * useVaultSession — the in-memory unlock/session seam onto the encrypted vault.
 *
 * `encrypted-storage.ts` is passphrase-keyed and async, so the app needs one
 * place that holds the passphrase in React memory for the current session and
 * exposes ordered, typed results to purely-presentational components. Keeping
 * that glue in `lib/` (not inside a component) preserves the AR4/AR6 layering
 * the vault modules already follow and keeps `SavedBreakdowns.tsx` free of any
 * storage logic.
 *
 * The passphrase lives only in React state for the session — it is never
 * persisted anywhere at rest, and no network request is ever made (NFR8). All
 * wrappers mirror the typed `VaultResult` boundary of the storage layer so
 * components render messages instead of catching throws.
 *
 * Ordering (most-recent-first by `createdAt`) is applied here because
 * `listEntriesEncrypted` returns entries in insertion order.
 */

"use client";

import { useCallback, useState } from "react";
import {
    clearEncryptedVault,
    deleteEntryEncrypted,
    listEntriesEncrypted,
    type NewEntryInput,
    saveEntryEncrypted,
} from "./encrypted-storage";
import type { VaultEntry, VaultResult } from "./types";

/** Sort a copy of the entries most-recent-first by createdAt. */
function sortNewestFirst(entries: VaultEntry[]): VaultEntry[] {
    return [...entries].sort((a, b) => b.createdAt - a.createdAt);
}

export interface VaultSession {
    /** True once a passphrase has been accepted for this session. */
    unlocked: boolean;
    /** Entries most-recent-first; empty until unlocked/listed. */
    entries: VaultEntry[];

    /**
     * Attempt to unlock with a passphrase. On success the session is marked
     * unlocked, the passphrase is held in memory, and `entries` is populated
     * (most-recent-first). A wrong passphrase yields `reason: "decrypt"` and
     * leaves the session locked with no entries leaked.
     */
    unlock: (passphrase: string) => Promise<VaultResult<VaultEntry[]>>;

    /** Re-read and re-sort the list for the unlocked session. */
    list: () => Promise<VaultResult<VaultEntry[]>>;

    /**
     * Save a new breakdown through the encrypted layer using the session
     * passphrase. Refreshes the in-memory list on success.
     */
    save: (input: NewEntryInput) => Promise<VaultResult<VaultEntry>>;

    /** Delete a single entry by id and update the list in place. */
    remove: (id: string) => Promise<VaultResult<void>>;

    /** Clear the whole encrypted vault and empty the in-memory list. */
    clear: () => Promise<VaultResult<void>>;

    /** Forget the passphrase and lock the session (in-memory only). */
    lock: () => void;
}

/**
 * React hook owning the session passphrase + unlock state and thin async
 * wrappers over the encrypted storage layer. Holds no persistence itself.
 */
export function useVaultSession(): VaultSession {
    const [passphrase, setPassphrase] = useState<string | null>(null);
    const [unlocked, setUnlocked] = useState(false);
    const [entries, setEntries] = useState<VaultEntry[]>([]);

    const unlock = useCallback(
        async (candidate: string): Promise<VaultResult<VaultEntry[]>> => {
            const result = await listEntriesEncrypted(candidate);
            if (!result.success) {
                // Wrong passphrase / unavailable: stay locked, leak nothing.
                return result;
            }
            const ordered = sortNewestFirst(result.data);
            setPassphrase(candidate);
            setUnlocked(true);
            setEntries(ordered);
            return { success: true, data: ordered };
        },
        [],
    );

    const list = useCallback(async (): Promise<VaultResult<VaultEntry[]>> => {
        if (passphrase === null) {
            return { success: false, reason: "decrypt" };
        }
        const result = await listEntriesEncrypted(passphrase);
        if (!result.success) {
            return result;
        }
        const ordered = sortNewestFirst(result.data);
        setEntries(ordered);
        return { success: true, data: ordered };
    }, [passphrase]);

    const save = useCallback(
        async (input: NewEntryInput): Promise<VaultResult<VaultEntry>> => {
            if (passphrase === null) {
                return { success: false, reason: "decrypt" };
            }
            const result = await saveEntryEncrypted(passphrase, input);
            if (result.success) {
                // Refresh the in-memory list so the new entry appears first.
                const listed = await listEntriesEncrypted(passphrase);
                if (listed.success) {
                    setEntries(sortNewestFirst(listed.data));
                }
            }
            return result;
        },
        [passphrase],
    );

    const remove = useCallback(
        async (id: string): Promise<VaultResult<void>> => {
            if (passphrase === null) {
                return { success: false, reason: "decrypt" };
            }
            const result = await deleteEntryEncrypted(passphrase, id);
            if (result.success) {
                // Update the list in place without a re-read/reload.
                setEntries((prev) => prev.filter((entry) => entry.id !== id));
            }
            return result;
        },
        [passphrase],
    );

    const clear = useCallback(async (): Promise<VaultResult<void>> => {
        const result = clearEncryptedVault();
        if (result.success) {
            setEntries([]);
        }
        return result;
    }, []);

    const lock = useCallback(() => {
        setPassphrase(null);
        setUnlocked(false);
        setEntries([]);
    }, []);

    return { unlocked, entries, unlock, list, save, remove, clear, lock };
}
