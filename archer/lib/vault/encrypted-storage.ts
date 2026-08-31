/**
 * Encrypted local vault storage — the passphrase-keyed persistence layer.
 *
 * Mirrors `storage.ts` (defensive `getStorage()` probing, `classifyWriteError`
 * quota handling, `generateId` fallback, typed `VaultResult` boundary) but
 * persists the whole serialized `VaultSchema` container as AES-GCM ciphertext
 * inside a JSON envelope under a dedicated versioned key. Everything runs
 * client-side against localStorage only (NFR8): no React, no network, no
 * third-party crypto.
 *
 * Read paths tolerate a missing/corrupt envelope by collapsing to an empty
 * vault; a wrong passphrase surfaces as a typed `reason: "decrypt"`
 * ("couldn't unlock") and never leaks partial data. Write paths catch
 * quota/unavailable and leave any prior ciphertext intact on failure.
 *
 * Story scope (4.2): this delivers the encryption core and encrypted storage
 * layer only. The passphrase-prompt UI and unlock/list surface belong to
 * Story 4.3; the plaintext `storage.ts` path is intentionally left untouched.
 */

import {
    base64ToBytes,
    bytesToBase64,
    decryptString,
    deriveKey,
    encryptString,
    generateIv,
    generateSalt,
} from "./crypto";
import type {
    EncryptedVaultEnvelope,
    VaultEntry,
    VaultFailureReason,
    VaultResult,
    VaultSchema,
} from "./types";

/** Single versioned key holding the encrypted vault envelope. */
export const ENCRYPTED_VAULT_KEY = "archer.vault.enc.v1";

const CURRENT_SCHEMA_VERSION = 1 as const;

/** Payload accepted by saveEntryEncrypted — id and createdAt are generated. */
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

/** Structural guard: only accept a container with a valid entries array. */
function isVaultSchema(value: unknown): value is VaultSchema {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const candidate = value as Partial<VaultSchema>;
    return Array.isArray(candidate.entries);
}

/** Structural guard for the persisted envelope: all base64 fields present. */
function isEnvelope(value: unknown): value is EncryptedVaultEnvelope {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const candidate = value as Partial<EncryptedVaultEnvelope>;
    return (
        typeof candidate.salt === "string" &&
        typeof candidate.iv === "string" &&
        typeof candidate.ciphertext === "string"
    );
}

/** Classify a caught write error into a typed failure reason. */
function classifyWriteError(error: unknown): VaultFailureReason {
    if (error instanceof Error) {
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
 * Generate a stable unique id. Prefers `crypto.randomUUID()` and falls back to
 * a Math.random-based UUID-shaped string when unavailable — mirroring
 * `storage.ts` so an insecure context can still save.
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

/** Read the raw envelope from storage, or null if absent/unreadable/corrupt. */
function readEnvelope(): EncryptedVaultEnvelope | null {
    const storage = getStorage();
    if (!storage) {
        return null;
    }

    let raw: string | null;
    try {
        raw = storage.getItem(ENCRYPTED_VAULT_KEY);
    } catch {
        return null;
    }

    if (raw === null) {
        return null;
    }

    try {
        const parsed = JSON.parse(raw) as unknown;
        return isEnvelope(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

/**
 * Decrypt the stored envelope into a `VaultSchema` for the given passphrase.
 *
 * - No/corrupt envelope → treated as an empty vault (`success`, empty entries),
 *   so a subsequent fresh save still works.
 * - Wrong passphrase / tampered bytes → `reason: "decrypt"`, no data leaked.
 * - Web Crypto unavailable → `reason: "unavailable"`.
 */
async function readVault(
    passphrase: string,
): Promise<VaultResult<VaultSchema>> {
    const envelope = readEnvelope();
    if (!envelope) {
        // Missing or corrupt envelope: behave as an empty vault.
        return { success: true, data: emptyVault() };
    }

    let salt: Uint8Array;
    let iv: Uint8Array;
    let ciphertext: Uint8Array;
    try {
        salt = base64ToBytes(envelope.salt);
        iv = base64ToBytes(envelope.iv);
        ciphertext = base64ToBytes(envelope.ciphertext);
    } catch {
        // Malformed base64 inside an otherwise well-shaped envelope.
        return { success: true, data: emptyVault() };
    }

    const keyResult = await deriveKey(passphrase, salt);
    if (!keyResult.success) {
        return keyResult;
    }

    const decrypted = await decryptString(ciphertext, keyResult.data, iv);
    if (!decrypted.success) {
        return decrypted;
    }

    try {
        const parsed = JSON.parse(decrypted.data) as unknown;
        if (!isVaultSchema(parsed)) {
            return { success: true, data: emptyVault() };
        }
        return { success: true, data: parsed };
    } catch {
        return { success: true, data: emptyVault() };
    }
}

/**
 * Encrypt and persist a vault container under the given passphrase. Reuses the
 * existing per-vault salt when present so the passphrase stays stable across
 * writes; generates one on first write. A fresh IV is generated per write.
 * On failure the prior ciphertext is left intact.
 */
async function writeVault(
    passphrase: string,
    vault: VaultSchema,
): Promise<VaultResult<void>> {
    const storage = getStorage();
    if (!storage) {
        return { success: false, reason: "unavailable" };
    }

    // Reuse the per-vault salt if one already exists; otherwise generate it.
    const existing = readEnvelope();
    let salt: Uint8Array | null = null;
    if (existing) {
        try {
            salt = base64ToBytes(existing.salt);
        } catch {
            salt = null;
        }
    }
    // Generating secure random bytes can throw when the environment lacks
    // crypto.getRandomValues; keep the never-throw boundary by mapping it to a
    // typed "unavailable" failure instead of letting the exception escape.
    let iv: Uint8Array;
    try {
        if (!salt) {
            salt = generateSalt();
        }
        iv = generateIv();
    } catch {
        return { success: false, reason: "unavailable" };
    }

    const keyResult = await deriveKey(passphrase, salt);
    if (!keyResult.success) {
        return keyResult;
    }
    const encrypted = await encryptString(
        JSON.stringify(vault),
        keyResult.data,
        iv,
    );
    if (!encrypted.success) {
        return encrypted;
    }

    const envelope: EncryptedVaultEnvelope = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        salt: bytesToBase64(salt),
        iv: bytesToBase64(iv),
        ciphertext: bytesToBase64(encrypted.data),
    };

    try {
        storage.setItem(ENCRYPTED_VAULT_KEY, JSON.stringify(envelope));
        return { success: true, data: undefined };
    } catch (error) {
        return { success: false, reason: classifyWriteError(error) };
    }
}

/**
 * Save a new breakdown into the encrypted vault. Decrypts the current
 * container (read-modify-write), appends a new entry with a generated id and
 * timestamp, and re-encrypts with a fresh IV. A wrong passphrase against an
 * existing vault yields `reason: "decrypt"` and no write occurs.
 */
export async function saveEntryEncrypted(
    passphrase: string,
    input: NewEntryInput,
): Promise<VaultResult<VaultEntry>> {
    const current = await readVault(passphrase);
    if (!current.success) {
        return current;
    }

    const entry: VaultEntry = {
        ...input,
        id: generateId(),
        createdAt: Date.now(),
    };

    const vault = current.data;
    vault.entries.push(entry);

    const written = await writeVault(passphrase, vault);
    if (!written.success) {
        return written;
    }

    return { success: true, data: entry };
}

/**
 * List all entries in the encrypted vault. Returns `reason: "decrypt"` on a
 * wrong passphrase (no entries leaked) and an empty array for a
 * missing/corrupt vault.
 */
export async function listEntriesEncrypted(
    passphrase: string,
): Promise<VaultResult<VaultEntry[]>> {
    const current = await readVault(passphrase);
    if (!current.success) {
        return current;
    }
    return { success: true, data: current.data.entries };
}

/**
 * Read a single entry by id from the encrypted vault. On success `data` is the
 * matching entry or `null` when absent. A wrong passphrase yields
 * `reason: "decrypt"`.
 */
export async function readEntryEncrypted(
    passphrase: string,
    id: string,
): Promise<VaultResult<VaultEntry | null>> {
    const current = await readVault(passphrase);
    if (!current.success) {
        return current;
    }
    const found = current.data.entries.find((entry) => entry.id === id) ?? null;
    return { success: true, data: found };
}

/**
 * Delete a single entry by id. A missing id is a successful no-op (no write).
 * A wrong passphrase yields `reason: "decrypt"`; a failed write yields a typed
 * failure with the prior ciphertext intact.
 */
export async function deleteEntryEncrypted(
    passphrase: string,
    id: string,
): Promise<VaultResult<void>> {
    const current = await readVault(passphrase);
    if (!current.success) {
        return current;
    }

    const vault = current.data;
    const remaining = vault.entries.filter((entry) => entry.id !== id);
    if (remaining.length === vault.entries.length) {
        // Nothing to remove — no-op success, no write needed.
        return { success: true, data: undefined };
    }

    vault.entries = remaining;
    return writeVault(passphrase, vault);
}

/**
 * Remove the encrypted vault entirely. Deletes the stored envelope so no
 * ciphertext (or its salt) remains. Idempotent — clearing an absent vault is a
 * success.
 */
export function clearEncryptedVault(): VaultResult<void> {
    const storage = getStorage();
    if (!storage) {
        return { success: false, reason: "unavailable" };
    }
    try {
        storage.removeItem(ENCRYPTED_VAULT_KEY);
        return { success: true, data: undefined };
    } catch (error) {
        return { success: false, reason: classifyWriteError(error) };
    }
}
