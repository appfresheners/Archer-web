import { afterEach, describe, expect, it, vi } from "vitest";
import {
    base64ToBytes,
    bytesToBase64,
    decryptString,
    deriveKey,
    encryptString,
    generateIv,
    generateSalt,
} from "./crypto";

/** Derive a key for a passphrase, unwrapping the typed result. */
async function key(passphrase: string, salt: Uint8Array) {
    const result = await deriveKey(passphrase, salt);
    if (!result.success) throw new Error(`deriveKey failed: ${result.reason}`);
    return result.data;
}

describe("vault crypto", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    describe("generateSalt / generateIv", () => {
        it("produces a 16-byte salt and 12-byte IV", () => {
            expect(generateSalt()).toHaveLength(16);
            expect(generateIv()).toHaveLength(12);
        });

        it("produces distinct salts across calls", () => {
            const a = bytesToBase64(generateSalt());
            const b = bytesToBase64(generateSalt());
            expect(a).not.toBe(b);
        });

        it("produces distinct IVs across calls", () => {
            const a = bytesToBase64(generateIv());
            const b = bytesToBase64(generateIv());
            expect(a).not.toBe(b);
        });
    });

    describe("base64 codecs", () => {
        it("round-trips arbitrary bytes", () => {
            const bytes = new Uint8Array([0, 1, 2, 127, 128, 200, 255]);
            expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
        });
    });

    describe("deriveKey", () => {
        it("derives an AES-GCM CryptoKey via PBKDF2", async () => {
            const result = await deriveKey("correct horse", generateSalt());
            expect(result.success).toBe(true);
            if (!result.success) return;
            const cryptoKey = result.data;
            expect(cryptoKey.type).toBe("secret");
            expect(
                (cryptoKey.algorithm as AesKeyAlgorithm).name,
            ).toBe("AES-GCM");
            expect(cryptoKey.usages).toContain("encrypt");
            expect(cryptoKey.usages).toContain("decrypt");
            expect(cryptoKey.extractable).toBe(false);
        });

        it("returns a typed 'unavailable' failure when crypto.subtle is absent", async () => {
            // Generate the salt before stubbing (needs getRandomValues), then
            // simulate an environment without crypto.subtle.
            const salt = generateSalt();
            const original = globalThis.crypto;
            Object.defineProperty(globalThis, "crypto", {
                value: { ...original, subtle: undefined },
                configurable: true,
            });
            try {
                const result = await deriveKey("pw", salt);
                expect(result).toEqual({
                    success: false,
                    reason: "unavailable",
                });
            } finally {
                Object.defineProperty(globalThis, "crypto", {
                    value: original,
                    configurable: true,
                });
            }
        });
    });

    describe("encrypt / decrypt round-trip", () => {
        // Property: decrypt(encrypt(x)) === x for arbitrary UTF-8 inputs.
        const inputs = [
            "",
            "a",
            "Learn guitar in 3 months",
            "emoji 🎸🔥✅ and accents éàü",
            "line1\nline2\ttabbed",
            JSON.stringify({ schemaVersion: 1, entries: [{ id: "x" }] }),
            "x".repeat(10_000),
            "日本語のテキスト混在 mixed 中文",
        ];

        it.each(inputs)(
            "decrypt(encrypt(x)) === x for %j",
            async (plaintext) => {
                const salt = generateSalt();
                const iv = generateIv();
                const cryptoKey = await key("passphrase-123", salt);

                const enc = await encryptString(plaintext, cryptoKey, iv);
                expect(enc.success).toBe(true);
                if (!enc.success) return;

                const dec = await decryptString(enc.data, cryptoKey, iv);
                expect(dec.success).toBe(true);
                if (!dec.success) return;
                expect(dec.data).toBe(plaintext);
            },
        );

        it("ciphertext is not the plaintext bytes", async () => {
            const salt = generateSalt();
            const iv = generateIv();
            const cryptoKey = await key("pw", salt);
            const plaintext = "secret goal text";

            const enc = await encryptString(plaintext, cryptoKey, iv);
            expect(enc.success).toBe(true);
            if (!enc.success) return;

            const asText = new TextDecoder().decode(enc.data);
            expect(asText).not.toContain("secret");
        });
    });

    describe("wrong key", () => {
        it("fails with reason 'decrypt' when the passphrase differs", async () => {
            const salt = generateSalt();
            const iv = generateIv();
            const rightKey = await key("right-passphrase", salt);
            const wrongKey = await key("wrong-passphrase", salt);

            const enc = await encryptString("top secret", rightKey, iv);
            expect(enc.success).toBe(true);
            if (!enc.success) return;

            const dec = await decryptString(enc.data, wrongKey, iv);
            expect(dec).toEqual({ success: false, reason: "decrypt" });
        });

        it("fails with reason 'decrypt' when the salt differs", async () => {
            const iv = generateIv();
            const encKey = await key("same-pass", generateSalt());
            const decKey = await key("same-pass", generateSalt());

            const enc = await encryptString("data", encKey, iv);
            if (!enc.success) throw new Error("encrypt failed");

            const dec = await decryptString(enc.data, decKey, iv);
            expect(dec).toEqual({ success: false, reason: "decrypt" });
        });
    });

    describe("tampered ciphertext / IV", () => {
        it("fails with reason 'decrypt' when ciphertext is mutated", async () => {
            const salt = generateSalt();
            const iv = generateIv();
            const cryptoKey = await key("pw", salt);

            const enc = await encryptString("authentic message", cryptoKey, iv);
            if (!enc.success) throw new Error("encrypt failed");

            const tampered = new Uint8Array(enc.data);
            tampered[0] ^= 0xff; // flip bits in the first byte

            const dec = await decryptString(tampered, cryptoKey, iv);
            expect(dec).toEqual({ success: false, reason: "decrypt" });
        });

        it("fails with reason 'decrypt' when the IV is mutated", async () => {
            const salt = generateSalt();
            const iv = generateIv();
            const cryptoKey = await key("pw", salt);

            const enc = await encryptString("authentic message", cryptoKey, iv);
            if (!enc.success) throw new Error("encrypt failed");

            const wrongIv = new Uint8Array(iv);
            wrongIv[0] ^= 0xff;

            const dec = await decryptString(enc.data, cryptoKey, wrongIv);
            expect(dec).toEqual({ success: false, reason: "decrypt" });
        });
    });

    describe("client-side only (NFR8)", () => {
        it("derive/encrypt/decrypt make no network request", async () => {
            const fetchSpy = vi.fn();
            vi.stubGlobal("fetch", fetchSpy);
            try {
                const salt = generateSalt();
                const iv = generateIv();
                const cryptoKey = await key("pw", salt);
                const enc = await encryptString("x", cryptoKey, iv);
                if (!enc.success) throw new Error("encrypt failed");
                await decryptString(enc.data, cryptoKey, iv);
                expect(fetchSpy).not.toHaveBeenCalled();
            } finally {
                vi.unstubAllGlobals();
            }
        });
    });
});
