/**
 * Portable passwordless identity — the pure encode/decode core (Story 4.5).
 *
 * Threat note — why the key rides in the URL *fragment*:
 * The fragment (everything after `#`) is, by the HTTP spec and every browser's
 * implementation, NEVER placed on the wire. When a browser requests
 * `https://app/#key=…`, only `https://app/` is sent to the server — the
 * fragment stays on the device and is available only to client-side JS via
 * `location.hash`. Placing the vault's unlock key material there therefore
 * satisfies "not sent to any Archer-owned server" (NFR8) without any server
 * cooperation. This is the standard "capability URL in the fragment" pattern
 * used by password managers and end-to-end-encrypted web apps.
 *
 * The encoded value IS the vault key material: it is exactly the session
 * passphrase (which derives the AES-GCM key via PBKDF2 in 4.2). Encoding is
 * fully reversible (`encodeURIComponent`/`decodeURIComponent`) so decode is
 * lossless; the passphrase is never derived, weakened, or re-hashed here.
 *
 * This module is pure: no React, no network, no crypto, no persistence. It
 * only builds and parses strings, and returns typed `VaultResult` values so it
 * never throws across its boundary (AR4/AR6).
 */

import type { VaultResult } from "./types";

/** The fragment parameter that carries the encoded passphrase. */
export const KEY_PARAM = "key";

/** The decoded portable identity: exactly the unlock passphrase. */
export interface PortableIdentity {
    /** The vault unlock passphrase, recovered verbatim from the fragment. */
    passphrase: string;
}

/**
 * Build a saveable link whose fragment encodes the passphrase.
 *
 * The passphrase is placed ONLY after the `#`, URL-encoded so any character
 * (unicode, symbols, spaces) round-trips losslessly. The `base` defaults to
 * the current origin + path so the link opens the same app; callers may pass
 * an explicit base (e.g. on the server / in tests) to avoid touching
 * `location`.
 *
 * Example: `https://app.example/#key=correct%20horse`
 */
export function encodeIdentity(passphrase: string, base?: string): string {
    const resolvedBase = base ?? currentBase();
    return `${resolvedBase}#${KEY_PARAM}=${encodeURIComponent(passphrase)}`;
}

/**
 * Just the encoded fragment value (no `#`, no base) — useful when a caller
 * only needs the `key=…` portion.
 */
export function encodeIdentityFragment(passphrase: string): string {
    return `${KEY_PARAM}=${encodeURIComponent(passphrase)}`;
}

/**
 * Parse a portable identity out of a location hash string (e.g. the value of
 * `window.location.hash`, with or without a leading `#`).
 *
 * Returns `{ success: true, data: { passphrase } }` when a `key` parameter is
 * present, with the passphrase decoded verbatim. An absent or malformed
 * fragment yields a typed `reason: "unknown"` ("no/invalid identity") — this
 * function never throws.
 */
export function parseIdentityFromHash(
    hash: string,
): VaultResult<PortableIdentity> {
    if (typeof hash !== "string" || hash.length === 0) {
        return { success: false, reason: "unknown" };
    }

    // Strip a single leading '#'. URLSearchParams itself does its own
    // percent-decoding of values, so we don't decode twice.
    const raw = hash.startsWith("#") ? hash.slice(1) : hash;

    let value: string | null;
    try {
        value = new URLSearchParams(raw).get(KEY_PARAM);
    } catch {
        return { success: false, reason: "unknown" };
    }

    // A present-but-empty key (`#key=`) is not a usable identity.
    if (value === null || value.length === 0) {
        return { success: false, reason: "unknown" };
    }

    return { success: true, data: { passphrase: value } };
}

/**
 * The default link base: current origin + pathname, guarded for SSR/prerender.
 * Returns an empty string when `window`/`location` is unavailable so a call on
 * the server produces a relative `#key=…` link rather than throwing (this app
 * is a Next.js static export).
 */
function currentBase(): string {
    if (typeof window === "undefined" || typeof window.location === "undefined") {
        return "";
    }
    return `${window.location.origin}${window.location.pathname}`;
}
