/**
 * Vault type definitions.
 *
 * These types describe the persisted shape of the local breakdown vault.
 * They are deliberately free of any React or browser-API dependency so the
 * vault can stay an isolated persistence layer (AR4/AR6).
 *
 * The whole vault is stored as a single versioned container (`VaultSchema`)
 * under one localStorage key. Keeping it as one atomic JSON blob makes it
 * trivial for Story 4.2 to wrap the serialized container in encrypt/decrypt
 * without a per-entry migration.
 */

/** A single saved breakdown. */
export interface VaultEntry {
    /** Stable unique id, generated via crypto.randomUUID(). */
    id: string;
    /** The raw text the user typed to generate the breakdown. */
    inputText: string;
    /** Which template produced the breakdown. */
    mode: "goal" | "project";
    /**
     * Generation options captured at save time.
     *
     * Epic 5 owns the concrete `GenerationOptions` type; this stays an open,
     * nullable record for now so the field name is locked without forcing a
     * data migration when the type tightens later.
     */
    generationOptions: Record<string, unknown> | null;
    /** The generated GTD breakdown, as markdown. */
    outputMarkdown: string;
    /** Creation timestamp (Date.now()); enables newest-first ordering. */
    createdAt: number;
}

/**
 * The persisted container.
 *
 * `schemaVersion` lets the stored shape evolve safely. It is carried on the
 * container (not per-entry) so a single check gates migration decisions.
 */
export interface VaultSchema {
    schemaVersion: 1;
    entries: VaultEntry[];
}

/**
 * Reasons a vault operation can fail. `unavailable` covers storage being
 * absent or throwing on access; `quota` distinguishes a full store so callers
 * can show a tailored message; `decrypt` signals a failed unlock (wrong
 * passphrase or tampered ciphertext) — the "couldn't unlock" outcome, never
 * partial/garbage data; `unknown` is the catch-all.
 */
export type VaultFailureReason =
    | "unavailable"
    | "quota"
    | "decrypt"
    | "unknown";

/**
 * The persisted envelope for the encrypted vault (Story 4.2).
 *
 * The whole serialized `VaultSchema` container is encrypted with AES-GCM and
 * stored here as base64 fields inside a JSON envelope, so the shape can evolve
 * without a hand-rolled binary format. The `salt` is per-vault (generated once,
 * not secret — its job is to defeat precomputation) and the `iv` is fresh per
 * write. Neither the passphrase nor the derived key is ever persisted.
 */
export interface EncryptedVaultEnvelope {
    schemaVersion: 1;
    /** base64 — per-vault PBKDF2 salt, generated once. */
    salt: string;
    /** base64 — fresh AES-GCM IV per write. */
    iv: string;
    /** base64 — AES-GCM ciphertext over JSON.stringify(VaultSchema). */
    ciphertext: string;
}

/**
 * Discriminated result for vault operations. Vault functions never throw
 * across the module boundary — they return this instead.
 *
 * On success, `data` carries the operation-specific payload (e.g. the saved
 * entry). On failure, `reason` describes what went wrong.
 */
export type VaultResult<T = void> =
    | { success: true; data: T }
    | { success: false; reason: VaultFailureReason };
