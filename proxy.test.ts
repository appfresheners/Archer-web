import type { User } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the session-refresh helper so we can drive the auth branch directly and
// avoid touching real Supabase / network. Each test sets the resolved `user`.
const updateSessionMock = vi.fn();
vi.mock('@/lib/supabase/middleware', () => ({
  updateSession: (...args: unknown[]) => updateSessionMock(...args),
}));

import { proxy } from './proxy';

const FAKE_USER = { id: 'user-123' } as User;

function makeRequest(pathname: string): NextRequest {
  return new NextRequest(new URL(`https://app.test${pathname}`));
}

function mockSession(user: User | null) {
  updateSessionMock.mockResolvedValue({
    response: NextResponse.next(),
    user,
  });
}

describe('root proxy auth guard', () => {
  beforeEach(() => {
    updateSessionMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('redirects an unauthenticated request to /app/* to /sign-in', async () => {
    mockSession(null);
    const res = await proxy(makeRequest('/app/engage'));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://app.test/sign-in');
  });

  it('lets an authenticated request to /app/* pass through', async () => {
    mockSession(FAKE_USER);
    const res = await proxy(makeRequest('/app/inbox'));

    // Passthrough response has no redirect location.
    expect(res.headers.get('location')).toBeNull();
    expect(res.status).toBe(200);
  });

  it('redirects an unauthenticated visit to / to /sign-in', async () => {
    mockSession(null);
    const res = await proxy(makeRequest('/'));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://app.test/sign-in');
  });

  it('redirects an authenticated visit to / to /app/engage', async () => {
    mockSession(FAKE_USER);
    const res = await proxy(makeRequest('/'));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://app.test/app/engage');
  });

  it('always runs the session-refresh path', async () => {
    mockSession(FAKE_USER);
    await proxy(makeRequest('/app/goals'));

    expect(updateSessionMock).toHaveBeenCalledTimes(1);
  });

  it('does not treat a lookalike prefix like /apple as an /app route', async () => {
    // Guard is defense-in-depth; the matcher already scopes to /app/:path*,
    // but if such a path reached the guard it must not be redirected.
    mockSession(null);
    const res = await proxy(makeRequest('/apple'));

    expect(res.headers.get('location')).toBeNull();
    expect(res.status).toBe(200);
  });

  it('carries refreshed auth cookies through the /app/* → /sign-in redirect', async () => {
    // A session refreshed during updateSession sets cookies on its response;
    // the redirect must preserve them or the refresh is lost on the bounce.
    const refreshed = NextResponse.next();
    refreshed.cookies.set('sb-access-token', 'refreshed-value');
    updateSessionMock.mockResolvedValue({ response: refreshed, user: null });

    const res = await proxy(makeRequest('/app/engage'));

    expect(res.status).toBe(307);
    expect(res.cookies.get('sb-access-token')?.value).toBe('refreshed-value');
  });

  it('carries refreshed auth cookies through the / → /app/engage redirect', async () => {
    const refreshed = NextResponse.next();
    refreshed.cookies.set('sb-refresh-token', 'r-value');
    updateSessionMock.mockResolvedValue({ response: refreshed, user: FAKE_USER });

    const res = await proxy(makeRequest('/'));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://app.test/app/engage');
    expect(res.cookies.get('sb-refresh-token')?.value).toBe('r-value');
  });
});

describe('supabase env accessor (fail-loud contract)', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
    vi.spyOn(console, 'error').mockImplementation(() => { });
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it('throws a clear, logged error naming a missing variable', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const { getSupabaseUrl } = await import('./lib/supabase/env');

    expect(() => getSupabaseUrl()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('NEXT_PUBLIC_SUPABASE_URL'),
    );
  });

  it('returns the value when the variable is present', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-abc';
    const { getSupabaseAnonKey } = await import('./lib/supabase/env');

    expect(getSupabaseAnonKey()).toBe('anon-abc');
  });

  it('treats an empty/whitespace value as missing', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = '   ';
    const { getServiceRoleKey } = await import('./lib/supabase/env');

    expect(() => getServiceRoleKey()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});
