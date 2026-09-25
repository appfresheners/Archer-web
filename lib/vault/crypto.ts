/**
 * Vault crypto core — an isolated, pure Web Crypto module.
 *
 * Built only on the browser-native Web Crypto API (`crypto.subtle`,
 * `crypto.getRandomValues`): PBKDF2 derives an AES-GCM key from a user
 * passphrase, AES-GCM encrypts/decrypts (NFR9). There is no React, no network,
 * and no third-party crypto dependency (AR4/AR6).
 *
 * A per-vault random salt is generated once and stored alongside the
 * ciphertext; a fresh random IV is generated per write. Decryption never
 * throws across the module boundary: a wrong passphrase (or tampered bytes)
 * fails the AES-GCM authentication tag and is surfaced as a typed
 * `reason: "decrypt"` result — never partial or garbage data.
 */

import type { VaultResult } from "./types";

/** PBKDF2 iteration count. High enough to slow brute force on a passphrase. */
const PBKDF2_ITERATIONS = 210_000;
/** Salt length in bytes (128-bit) — plenty to defeat precomputation. */
const SALT_LENGTH = 16;
/** AES-GCM IV length in bytes (96-bit) — the recommended GCM nonce size. */
const IV_LENGTH = 12;
/** Derived AES key length in bits. */
const AES_KEY_LENGTH = 256;

/**
 * Obtain the Web Crypto `SubtleCrypto` interface defensively. It is absent in
 * insecure contexts and some non-browser environments, so probing keeps the
 * module from throwing at the boundary.
 */
function getSubtle(): SubtleCrypto | null {
    try {
        const cryptoObj = (globalThis as { crypto?: Crypto }).crypto;
        return cryptoObj?.subtle ?? null;
    } catch {
        return null;
    }
}

/** Fill a fresh byte array with cryptographically strong random values. */
function randomBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    // crypto.getRandomValues is required; if absent the environment cannot
    // provide secure randomness and callers derive/encrypt paths will fail.
    (globalThis as { crypto: Crypto }).crypto.getRandomValues(bytes);
    return bytes;
}

/** Generate a fresh per-vault PBKDF2 salt. */
export function generateSalt(): Uint8Array {
    return randomBytes(SALT_LENGTH);
}

/** Generate a fresh per-write AES-GCM IV. */
export function generateIv(): Uint8Array {
    return randomBytes(IV_LENGTH);
}

/** Encode raw bytes as a base64 string (browser-native btoa). */
export function bytesToBase64(bytes: Uint8Array): string {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/** Decode a base64 string back to raw bytes (browser-native atob). */
export function base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/**
 * Derive a 256-bit AES-GCM key from a passphrase and salt via PBKDF2
 * (SHA-256). The key is non-extractable and usable only for encrypt/decrypt.
 * Returns a typed `unavailable` failure when Web Crypto is absent.
 */
export async function deriveKey(
    passphrase: string,
    salt: Uint8Array,
): Promise<VaultResult<CryptoKey>> {
    const subtle = getSubtle();
    if (!subtle) {
        return { success: false, reason: "unavailable" };
    }

    try {
        const keyMaterial = await subtle.importKey(
            "raw",
            new TextEncoder().encode(passphrase),
            "PBKDF2",
            false,
            ["deriveKey"],
        );

        const key = await subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: salt as BufferSource,
                iterations: PBKDF2_ITERATIONS,
                hash: "SHA-256",
            },
            keyMaterial,
            { name: "AES-GCM", length: AES_KEY_LENGTH },
            false,
            ["encrypt", "decrypt"],
        );

        return { success: true, data: key };
    } catch {
        return { success: false, reason: "unavailable" };
    }
}

/**
 * Encrypt a UTF-8 plaintext string with AES-GCM under the given key and IV.
 * Returns the ciphertext bytes (including the GCM authentication tag). Returns
 * a typed `unknown` failure if Web Crypto is unavailable or the operation
 * fails — never throws across the boundary.
 */
export async function encryptString(
    plaintext: string,
    key: CryptoKey,
    iv: Uint8Array,
): Promise<VaultResult<Uint8Array>> {
    const subtle = getSubtle();
    if (!subtle) {
        return { success: false, reason: "unavailable" };
    }

    try {
        const encoded = new TextEncoder().encode(plaintext);
        const ciphertext = await subtle.encrypt(
            { name: "AES-GCM", iv: iv as BufferSource },
            key,
            encoded as BufferSource,
        );
        return { success: true, data: new Uint8Array(ciphertext) };
    } catch {
        return { success: false, reason: "unknown" };
    }
}

/**
 * Decrypt AES-GCM ciphertext bytes with the given key and IV back into a
 * UTF-8 string. A wrong key or tampered ciphertext/IV fails the GCM
 * authentication tag and is caught, yielding a typed `reason: "decrypt"`
 * ("couldn't unlock") result — no partial or garbage data is ever returned.
 */
export async function decryptString(
    ciphertext: Uint8Array,
    key: CryptoKey,
    iv: Uint8Array,
): Promise<VaultResult<string>> {
    const subtle = getSubtle();
    if (!subtle) {
        return { success: false, reason: "unavailable" };
    }

    try {
        const plaintext = await subtle.decrypt(
            { name: "AES-GCM", iv: iv as BufferSource },
            key,
            ciphertext as BufferSource,
        );
        return { success: true, data: new TextDecoder().decode(plaintext) };
    } catch {
        return { success: false, reason: "decrypt" };
    }
}
