/**
 * Local vault storage — the isolated, pure persistence core for saved
 * breakdowns.
 *
 * Everything here runs client-side against localStorage only (NFR8). There is
 * no React and no network. Reads tolerate missing/corrupt data (treated as an
 * empty vault); writes catch quota/unavailable failures and return a typed
 * result — nothing throws across the module boundary.
 */

import type {
    VaultEntry,
    VaultFailureReason,
    VaultResult,
    VaultSchema,
} from "./types";

/** Single versioned key holding the whole vault. */
export const VAULT_KEY = "archer.vault.v1";

const CURRENT_SCHEMA_VERSION = 1 as const;

/** Payload accepted by saveEntry — id and createdAt are generated internally. */
export type NewEntryInput = Omit<VaultEntry, "id" | "createdAt">;

/**
 * Safely obtain localStorage. Accessing `window.localStorage` can throw in
 * some environments (e.g. privacy modes), so it is probed defensively.
 */
function getStorage(): Storage | null {
    try {
        if (typeof globalThis === "undefined") {
            return null;
        }
        const storage = (globalThis as { localStorage?: Storage }).localStorage;
        return storage ?? null;
    } catch {
        return null;
    }
}

/** An empty, current-version vault container. */
function emptyVault(): VaultSchema {
    return { schemaVersion: CURRENT_SCHEMA_VERSION, entries: [] };
}

/**
 * Read and parse the stored vault. Missing, unparseable, or wrong-shaped data
 * is treated as an empty vault rather than an error, so a corrupt key never
 * blocks reads or a subsequent write.
 */
function readVault(): VaultSchema {
    const storage = getStorage();
    if (!storage) {
        return emptyVault();
    }

    let raw: string | null;
    try {
        raw = storage.getItem(VAULT_KEY);
    } catch {
        return emptyVault();
    }

    if (raw === null) {
        return emptyVault();
    }

    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!isVaultSchema(parsed)) {
            return emptyVault();
        }
        return parsed;
    } catch {
        return emptyVault();
    }
}

/** Structural guard: only accept a container with a valid entries array. */
function isVaultSchema(value: unknown): value is VaultSchema {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const candidate = value as Partial<VaultSchema>;
    return Array.isArray(candidate.entries);
}

/** Classify a caught write error into a typed failure reason. */
function classifyWriteError(error: unknown): VaultFailureReason {
    if (error instanceof Error) {
        // Browsers signal a full store via QuotaExceededError. Some engines
        // report the legacy Firefox name or a numeric code (22 / 1014).
        if (
            error.name === "QuotaExceededError" ||
            error.name === "NS_ERROR_DOM_QUOTA_REACHED"
        ) {
            return "quota";
        }
        const code = (error as { code?: number }).code;
        if (code === 22 || code === 1014) {
            return "quota";
        }
    }
    return "unknown";
}

/**
 * Serialize and persist the vault. Returns a typed result; a full store yields
 * `reason: "quota"`, a missing/throwing store yields `reason: "unavailable"`.
 */
function writeVault(vault: VaultSchema): VaultResult<void> {
    const storage = getStorage();
    if (!storage) {
        return { success: false, reason: "unavailable" };
    }

    try {
        storage.setItem(VAULT_KEY, JSON.stringify(vault));
        return { success: true, data: undefined };
    } catch (error) {
        return { success: false, reason: classifyWriteError(error) };
    }
}

/**
 * Save a new breakdown. Generates a stable id and creation timestamp, appends
 * it to the vault, and persists. On failure the on-disk vault is unchanged and
 * a typed failure is returned.
 */
/**
 * Generate a stable unique id. Prefers `crypto.randomUUID()` but falls back to
 * a Math.random-based UUID-shaped string when it is unavailable — e.g. an
 * insecure (non-HTTPS, non-localhost) context where `crypto.randomUUID` is not
 * exposed. The fallback keeps `saveEntry` from throwing so it can still return
 * a typed result. Collision resistance is weaker than the crypto path but more
 * than adequate for a single-device local vault.
 */
function generateId(): string {
    try {
        const cryptoObj = (globalThis as { crypto?: Crypto }).crypto;
        if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
            return cryptoObj.randomUUID();
        }
    } catch {
        // fall through to the Math.random fallback
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

export function saveEntry(input: NewEntryInput): VaultResult<VaultEntry> {
    const entry: VaultEntry = {
        ...input,
        id: generateId(),
        createdAt: Date.now(),
    };

    const vault = readVault();
    vault.entries.push(entry);

    const result = writeVault(vault);
    if (!result.success) {
        return result;
    }

    return { success: true, data: entry };
}

/**
 * List all entries. Callers can order newest-first by `createdAt`. Returns an
 * empty array for an empty/missing/corrupt vault.
 */
export function listEntries(): VaultEntry[] {
    return readVault().entries;
}

/** Read a single entry by id, or `null` if not found. */
export function readEntry(id: string): VaultEntry | null {
    return readVault().entries.find((entry) => entry.id === id) ?? null;
}

/**
 * Delete a single entry by id. A missing id is a successful no-op. Returns a
 * typed failure only if the underlying write fails.
 */
export function deleteEntry(id: string): VaultResult<void> {
    const vault = readVault();
    const remaining = vault.entries.filter((entry) => entry.id !== id);

    if (remaining.length === vault.entries.length) {
        // Nothing to remove — no-op success, no write needed.
        return { success: true, data: undefined };
    }

    vault.entries = remaining;
    return writeVault(vault);
}

/** Remove every entry, resetting to an empty current-version vault. */
export function clearVault(): VaultResult<void> {
    return writeVault(emptyVault());
}
