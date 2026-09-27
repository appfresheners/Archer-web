import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

// --- Mocks -----------------------------------------------------------------

const exchangeCodeForSession = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { exchangeCodeForSession },
  }),
}));

// Capture what the handler redirects to without pulling in the full Next
// runtime. `NextResponse.redirect(url)` returns an object; we only assert the
// resolved URL string, so a light stand-in is enough.
vi.mock("next/server", () => ({
  NextResponse: {
    redirect: (url: string | URL) => ({ redirectedTo: String(url) }),
  },
}));

/** Build a request-shaped object exposing the `nextUrl` the handler reads. */
function requestFor(url: string) {
  const u = new URL(url);
  return {
    nextUrl: {
      searchParams: u.searchParams,
      origin: u.origin,
    },
  } as unknown as Parameters<typeof GET>[0];
}

const ORIGIN = "https://app.example.com";

describe("auth callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exchanges a valid code and redirects to the validated next path", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });

    const res = (await GET(
      requestFor(`${ORIGIN}/auth/callback?code=abc&next=/reset-password`),
    )) as unknown as { redirectedTo: string };

    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(res.redirectedTo).toBe(`${ORIGIN}/reset-password`);
  });

  it("defaults next to /reset-password when it is absent", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });

    const res = (await GET(
      requestFor(`${ORIGIN}/auth/callback?code=abc`),
    )) as unknown as { redirectedTo: string };

    expect(res.redirectedTo).toBe(`${ORIGIN}/reset-password`);
  });

  it("rejects an open-redirect next (protocol-relative) and falls back", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });

    const res = (await GET(
      requestFor(`${ORIGIN}/auth/callback?code=abc&next=//evil.com`),
    )) as unknown as { redirectedTo: string };

    expect(res.redirectedTo).toBe(`${ORIGIN}/reset-password`);
  });

  it("rejects an absolute-URL next and falls back", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });

    const res = (await GET(
      requestFor(
        `${ORIGIN}/auth/callback?code=abc&next=${encodeURIComponent("https://evil.com")}`,
      ),
    )) as unknown as { redirectedTo: string };

    expect(res.redirectedTo).toBe(`${ORIGIN}/reset-password`);
  });

  it("rejects a backslash protocol-relative next (/\\host) and falls back", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });

    const res = (await GET(
      requestFor(
        `${ORIGIN}/auth/callback?code=abc&next=${encodeURIComponent("/\\evil.com")}`,
      ),
    )) as unknown as { redirectedTo: string };

    expect(res.redirectedTo).toBe(`${ORIGIN}/reset-password`);
  });

  it("redirects to /sign-in with a generic error when the code is missing", async () => {
    const res = (await GET(
      requestFor(`${ORIGIN}/auth/callback`),
    )) as unknown as { redirectedTo: string };

    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(res.redirectedTo).toContain(`${ORIGIN}/sign-in?error=`);
  });

  it("redirects to /sign-in with a generic error when the exchange fails", async () => {
    exchangeCodeForSession.mockResolvedValue({
      error: { message: "invalid code" },
    });

    const res = (await GET(
      requestFor(`${ORIGIN}/auth/callback?code=bad&next=/reset-password`),
    )) as unknown as { redirectedTo: string };

    expect(res.redirectedTo).toContain(`${ORIGIN}/sign-in?error=`);
    // Generic message — no internal detail leaked.
    expect(res.redirectedTo).not.toContain("invalid code");
  });
});
