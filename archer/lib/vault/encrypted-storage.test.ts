import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    ENCRYPTED_VAULT_KEY,
    clearEncryptedVault,
    deleteEntryEncrypted,
    listEntriesEncrypted,
    readEntryEncrypted,
    saveEntryEncrypted,
    type NewEntryInput,
} from "./encrypted-storage";
import type { EncryptedVaultEnvelope } from "./types";

const PASS = "correct-horse-battery-staple";
const WRONG = "not-the-passphrase";

function makeInput(overrides: Partial<NewEntryInput> = {}): NewEntryInput {
    return {
        inputText: "Learn guitar",
        mode: "goal",
        generationOptions: null,
        outputMarkdown: "# My 3-Month Goal\n\nLearn guitar",
        ...overrides,
    };
}

describe("encrypted vault storage", () => {
    beforeEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    afterEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    describe("saveEntryEncrypted", () => {
        it("appends an entry with a generated id and createdAt", async () => {
            const before = Date.now();
            const result = await saveEntryEncrypted(PASS, makeInput());
            const after = Date.now();

            expect(result.success).toBe(true);
            if (!result.success) return;

            const entry = result.data;
            expect(typeof entry.id).toBe("string");
            expect(entry.id.length).toBeGreaterThan(0);
            expect(entry.inputText).toBe("Learn guitar");
            expect(entry.mode).toBe("goal");
            expect(entry.createdAt).toBeGreaterThanOrEqual(before);
            expect(entry.createdAt).toBeLessThanOrEqual(after);
        });

        it("save→list round-trips through decryption", async () => {
            const saved = await saveEntryEncrypted(PASS, makeInput());
            expect(saved.success).toBe(true);
            if (!saved.success) return;

            const listed = await listEntriesEncrypted(PASS);
            expect(listed.success).toBe(true);
            if (!listed.success) return;
            expect(listed.data).toHaveLength(1);
            expect(listed.data[0]).toEqual(saved.data);
        });

        it("appends without dropping existing entries", async () => {
            await saveEntryEncrypted(PASS, makeInput({ inputText: "first" }));
            await saveEntryEncrypted(PASS, makeInput({ inputText: "second" }));

            const listed = await listEntriesEncrypted(PASS);
            if (!listed.success) throw new Error("list failed");
            expect(listed.data.map((e) => e.inputText)).toEqual([
                "first",
                "second",
            ]);
        });

        it("generates unique ids across saves", async () => {
            const a = await saveEntryEncrypted(PASS, makeInput());
            const b = await saveEntryEncrypted(PASS, makeInput());
            if (!a.success || !b.success) throw new Error("save failed");
            expect(a.data.id).not.toBe(b.data.id);
        });

        it("uses a fresh IV per write (reusing the per-vault salt)", async () => {
            await saveEntryEncrypted(PASS, makeInput({ inputText: "first" }));
            const firstRaw = localStorage.getItem(ENCRYPTED_VAULT_KEY);
            const first = JSON.parse(firstRaw as string) as EncryptedVaultEnvelope;

            await saveEntryEncrypted(PASS, makeInput({ inputText: "second" }));
            const secondRaw = localStorage.getItem(ENCRYPTED_VAULT_KEY);
            const second = JSON.parse(
                secondRaw as string,
            ) as EncryptedVaultEnvelope;

            expect(second.iv).not.toBe(first.iv); // fresh IV per write
            expect(second.salt).toBe(first.salt); // stable per-vault salt
        });
    });

    describe("ciphertext at rest (FR22)", () => {
        it("stores an envelope whose ciphertext contains no plaintext", async () => {
            const secretInput = "confidential-goal-marker-xyz";
            const secretOutput = "confidential-output-marker-abc";
            await saveEntryEncrypted(
                PASS,
                makeInput({
                    inputText: secretInput,
                    outputMarkdown: secretOutput,
                }),
            );

            const raw = localStorage.getItem(ENCRYPTED_VAULT_KEY);
            expect(raw).not.toBeNull();
            // The whole stored value must not leak the plaintext.
            expect(raw).not.toContain(secretInput);
            expect(raw).not.toContain(secretOutput);

            const envelope = JSON.parse(raw as string) as EncryptedVaultEnvelope;
            expect(envelope.schemaVersion).toBe(1);
            expect(typeof envelope.salt).toBe("string");
            expect(typeof envelope.iv).toBe("string");
            expect(typeof envelope.ciphertext).toBe("string");
            // ciphertext is base64.
            expect(envelope.ciphertext).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
            expect(envelope.ciphertext).not.toContain(secretInput);
        });
    });

    describe("wrong passphrase", () => {
        it("list with wrong passphrase yields reason 'decrypt' and no data", async () => {
            await saveEntryEncrypted(PASS, makeInput());
            const listed = await listEntriesEncrypted(WRONG);
            expect(listed).toEqual({ success: false, reason: "decrypt" });
        });

        it("read with wrong passphrase yields reason 'decrypt'", async () => {
            const saved = await saveEntryEncrypted(PASS, makeInput());
            if (!saved.success) throw new Error("save failed");
            const read = await readEntryEncrypted(WRONG, saved.data.id);
            expect(read).toEqual({ success: false, reason: "decrypt" });
        });

        it("save with wrong passphrase over existing vault fails and does not overwrite", async () => {
            await saveEntryEncrypted(PASS, makeInput({ inputText: "original" }));
            const before = localStorage.getItem(ENCRYPTED_VAULT_KEY);

            const result = await saveEntryEncrypted(
                WRONG,
                makeInput({ inputText: "intruder" }),
            );
            expect(result).toEqual({ success: false, reason: "decrypt" });

            // Prior ciphertext intact; original still readable with PASS.
            expect(localStorage.getItem(ENCRYPTED_VAULT_KEY)).toBe(before);
            const listed = await listEntriesEncrypted(PASS);
            if (!listed.success) throw new Error("list failed");
            expect(listed.data.map((e) => e.inputText)).toEqual(["original"]);
        });

        it("delete with wrong passphrase yields reason 'decrypt'", async () => {
            const saved = await saveEntryEncrypted(PASS, makeInput());
            if (!saved.success) throw new Error("save failed");
            const del = await deleteEntryEncrypted(WRONG, saved.data.id);
            expect(del).toEqual({ success: false, reason: "decrypt" });
        });
    });

    describe("readEntryEncrypted", () => {
        it("returns the matching entry by id", async () => {
            const saved = await saveEntryEncrypted(PASS, makeInput());
            if (!saved.success) throw new Error("save failed");
            const read = await readEntryEncrypted(PASS, saved.data.id);
            expect(read).toEqual({ success: true, data: saved.data });
        });

        it("returns null when the id is not found", async () => {
            await saveEntryEncrypted(PASS, makeInput());
            const read = await readEntryEncrypted(PASS, "nope");
            expect(read).toEqual({ success: true, data: null });
        });

        it("returns null on an empty (absent) vault", async () => {
            const read = await readEntryEncrypted(PASS, "anything");
            expect(read).toEqual({ success: true, data: null });
        });
    });

    describe("deleteEntryEncrypted", () => {
        it("removes a matching entry and re-encrypts", async () => {
            const saved = await saveEntryEncrypted(PASS, makeInput());
            if (!saved.success) throw new Error("save failed");

            const del = await deleteEntryEncrypted(PASS, saved.data.id);
            expect(del.success).toBe(true);

            const listed = await listEntriesEncrypted(PASS);
            if (!listed.success) throw new Error("list failed");
            expect(listed.data).toEqual([]);
        });

        it("leaves other entries intact", async () => {
            const a = await saveEntryEncrypted(PASS, makeInput({ inputText: "keep" }));
            const b = await saveEntryEncrypted(PASS, makeInput({ inputText: "remove" }));
            if (!a.success || !b.success) throw new Error("save failed");

            await deleteEntryEncrypted(PASS, b.data.id);
            const listed = await listEntriesEncrypted(PASS);
            if (!listed.success) throw new Error("list failed");
            expect(listed.data).toHaveLength(1);
            expect(listed.data[0].inputText).toBe("keep");
        });

        it("is a no-op success when the id is absent (no write)", async () => {
            await saveEntryEncrypted(PASS, makeInput());
            const setSpy = vi.spyOn(Storage.prototype, "setItem");
            const del = await deleteEntryEncrypted(PASS, "nope");
            expect(del.success).toBe(true);
            expect(setSpy).not.toHaveBeenCalled();
        });
    });

    describe("clearEncryptedVault", () => {
        it("removes the stored envelope entirely", async () => {
            await saveEntryEncrypted(PASS, makeInput());
            const result = clearEncryptedVault();
            expect(result.success).toBe(true);
            expect(localStorage.getItem(ENCRYPTED_VAULT_KEY)).toBeNull();
        });

        it("is a success on an already-empty vault", () => {
            const result = clearEncryptedVault();
            expect(result.success).toBe(true);
        });

        it("returns a typed failure when removeItem throws", () => {
            vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
                throw new Error("blocked");
            });
            const result = clearEncryptedVault();
            expect(result.success).toBe(false);
        });
    });

    describe("corrupt / wrong-shaped envelope", () => {
        it("treats unparseable JSON as an empty vault on read", async () => {
            localStorage.setItem(ENCRYPTED_VAULT_KEY, "{not valid json");
            const listed = await listEntriesEncrypted(PASS);
            expect(listed).toEqual({ success: true, data: [] });
        });

        it("treats a wrong-shaped envelope as empty", async () => {
            localStorage.setItem(
                ENCRYPTED_VAULT_KEY,
                JSON.stringify({ schemaVersion: 1 }),
            );
            const listed = await listEntriesEncrypted(PASS);
            expect(listed).toEqual({ success: true, data: [] });
        });

        it("treats malformed base64 fields as empty", async () => {
            localStorage.setItem(
                ENCRYPTED_VAULT_KEY,
                JSON.stringify({
                    schemaVersion: 1,
                    salt: "!!!not base64!!!",
                    iv: "###",
                    ciphertext: "@@@",
                }),
            );
            const listed = await listEntriesEncrypted(PASS);
            // A malformed-base64 (but well-shaped) envelope collapses to an
            // empty vault on read per the documented contract.
            expect(listed).toEqual({ success: true, data: [] });
        });

        it("allows a fresh encrypted save after corrupt data", async () => {
            localStorage.setItem(ENCRYPTED_VAULT_KEY, "garbage");
            const result = await saveEntryEncrypted(PASS, makeInput());
            expect(result.success).toBe(true);
            const listed = await listEntriesEncrypted(PASS);
            if (!listed.success) throw new Error("list failed");
            expect(listed.data).toHaveLength(1);
        });
    });

    describe("storage unavailable / quota", () => {
        it("reads as empty when getItem throws", async () => {
            vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
                throw new Error("unavailable");
            });
            const listed = await listEntriesEncrypted(PASS);
            expect(listed).toEqual({ success: true, data: [] });
        });

        it("save returns reason 'quota' when setItem throws QuotaExceededError", async () => {
            vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
                const err = new Error("full");
                err.name = "QuotaExceededError";
                throw err;
            });
            const result = await saveEntryEncrypted(PASS, makeInput());
            expect(result).toEqual({ success: false, reason: "quota" });
        });

        it("save returns reason 'unknown' when setItem throws a non-quota error", async () => {
            vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
                throw new Error("blocked");
            });
            const result = await saveEntryEncrypted(PASS, makeInput());
            expect(result).toEqual({ success: false, reason: "unknown" });
        });

        it("does not persist anything when the write fails", async () => {
            vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
                throw new Error("blocked");
            });
            await saveEntryEncrypted(PASS, makeInput());
            expect(localStorage.getItem(ENCRYPTED_VAULT_KEY)).toBeNull();
        });

        it("returns reason 'unavailable' and persists nothing when secure randomness throws", async () => {
            // Insecure/non-browser context: getRandomValues is unavailable and
            // throws, while crypto.subtle stays present. Saving to an EMPTY
            // vault must generate a fresh salt, so the throw is exercised — and
            // must be caught at the module boundary rather than escaping.
            const original = globalThis.crypto.getRandomValues;
            Object.defineProperty(globalThis.crypto, "getRandomValues", {
                configurable: true,
                value: () => {
                    throw new Error("secure randomness unavailable");
                },
            });
            try {
                const result = await saveEntryEncrypted(PASS, makeInput());
                expect(result).toEqual({
                    success: false,
                    reason: "unavailable",
                });
                expect(localStorage.getItem(ENCRYPTED_VAULT_KEY)).toBeNull();
            } finally {
                Object.defineProperty(globalThis.crypto, "getRandomValues", {
                    configurable: true,
                    value: original,
                });
            }
        });
    });

    describe("client-side only (NFR8)", () => {
        it("save/list/read/delete/clear make no network request", async () => {
            const fetchSpy = vi.fn();
            vi.stubGlobal("fetch", fetchSpy);
            try {
                const saved = await saveEntryEncrypted(PASS, makeInput());
                await listEntriesEncrypted(PASS);
                if (saved.success) {
                    await readEntryEncrypted(PASS, saved.data.id);
                    await deleteEntryEncrypted(PASS, saved.data.id);
                }
                clearEncryptedVault();
                expect(fetchSpy).not.toHaveBeenCalled();
            } finally {
                vi.unstubAllGlobals();
            }
        });
    });
});
