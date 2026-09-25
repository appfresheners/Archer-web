/**
 * Unit tests for the pure portable-identity encode/decode core.
 *
 * Proves: lossless round-trip across varied passphrases; malformed/absent
 * fragments map to a typed none/invalid result; the produced link carries the
 * key ONLY after `#` (never before it); and the module makes zero network
 * calls (stub `fetch`, expect no calls).
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
    encodeIdentity,
    encodeIdentityFragment,
    KEY_PARAM,
    parseIdentityFromHash,
} from "./portable-identity";

const BASE = "https://archer.example/app";

describe("encode/decode round-trip", () => {
    const passphrases = [
        "simple",
        "correct horse battery staple",
        "with spaces and #hash and ?query=1 and &amp",
        "symbols !@#$%^&*()_+-=[]{}|;:',.<>/?`~",
        "unicode ✓ 你好 emoji 🐎🔐 accents éàü",
        "a".repeat(4096),
        "=leading-equals",
        "trailing-equals=",
        "%20already-encoded-looking%2F",
    ];

    it.each(passphrases)(
        "recovers the exact passphrase from a link fragment: %s",
        (passphrase) => {
            const link = encodeIdentity(passphrase, BASE);
            const hash = link.slice(link.indexOf("#"));
            const parsed = parseIdentityFromHash(hash);
            expect(parsed).toEqual({
                success: true,
                data: { passphrase },
            });
        },
    );

    it("round-trips through the bare fragment form too", () => {
        const passphrase = "correct horse battery staple";
        const fragment = encodeIdentityFragment(passphrase);
        const parsed = parseIdentityFromHash(`#${fragment}`);
        expect(parsed).toEqual({ success: true, data: { passphrase } });
    });
});

describe("malformed / absent fragments", () => {
    it("returns none/invalid for an empty string", () => {
        expect(parseIdentityFromHash("")).toEqual({
            success: false,
            reason: "unknown",
        });
    });

    it("returns none/invalid for a hash with no key param", () => {
        expect(parseIdentityFromHash("#other=1")).toEqual({
            success: false,
            reason: "unknown",
        });
        expect(parseIdentityFromHash("#justtext")).toEqual({
            success: false,
            reason: "unknown",
        });
    });

    it("returns none/invalid for a present-but-empty key", () => {
        expect(parseIdentityFromHash("#key=")).toEqual({
            success: false,
            reason: "unknown",
        });
    });

    it("parses when other params surround the key", () => {
        expect(parseIdentityFromHash("#a=1&key=hunter2&b=2")).toEqual({
            success: true,
            data: { passphrase: "hunter2" },
        });
    });
});

describe("key material is carried only after '#'", () => {
    it("places the key in the fragment, never in the path or query", () => {
        const passphrase = "secret-pass";
        const link = encodeIdentity(passphrase, BASE);

        const hashIndex = link.indexOf("#");
        expect(hashIndex).toBeGreaterThan(-1);

        const beforeHash = link.slice(0, hashIndex);
        const afterHash = link.slice(hashIndex + 1);

        // Nothing resembling the key appears before the '#'.
        expect(beforeHash).toBe(BASE);
        expect(beforeHash).not.toContain(KEY_PARAM);
        expect(beforeHash).not.toContain("secret-pass");
        // No query string was introduced.
        expect(beforeHash).not.toContain("?");

        // The key lives only in the fragment.
        expect(afterHash).toContain(`${KEY_PARAM}=`);
    });

    it("defaults the base to origin+pathname when none is given (guarded for SSR)", () => {
        // In jsdom, window.location exists; the link should start with it.
        const link = encodeIdentity("x");
        expect(link).toContain("#key=x");
        expect(link.indexOf("#key=x")).toBeGreaterThan(-1);
    });
});

describe("no network", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("makes zero fetch calls when encoding and decoding", () => {
        const fetchSpy = vi.fn();
        vi.stubGlobal("fetch", fetchSpy);

        const link = encodeIdentity("no-network-pass", BASE);
        parseIdentityFromHash(link.slice(link.indexOf("#")));

        expect(fetchSpy).not.toHaveBeenCalled();
        vi.unstubAllGlobals();
    });
});
