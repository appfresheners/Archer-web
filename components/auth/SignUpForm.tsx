"use client";

/**
 * Sign-up form (client component).
 *
 * Email + password only — no OAuth, no magic link. Submits to Supabase Auth's
 * `signUp` via the browser client. Email confirmation is disabled in the
 * Supabase config, so a successful sign-up establishes a session immediately;
 * we then navigate to `/app/engage` and refresh so the middleware/server
 * re-reads the session cookie. Failures (duplicate email, weak password) are
 * surfaced as a friendly inline `role="alert"` error. Empty fields are blocked
 * before Supabase is called; submit is disabled while in flight.
 */

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

/** Map raw Supabase errors to plain, friendly sentences. */
function friendlyError(message: string): string {
  if (/already registered|already been registered|user already exists/i.test(message)) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (/password/i.test(message) && /(least|short|weak|6)/i.test(message)) {
    return "Please choose a stronger password (at least 6 characters).";
  }
  return message || "Something went wrong. Please try again.";
}

export default function SignUpForm() {
  const router = useRouter();
  const emailId = useId();
  const passwordId = useId();
  const errorId = useId();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;

    // Inline validation before touching the network.
    if (email.trim() === "" || password === "") {
      setError("Enter your email and password.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (signUpError) {
        setError(friendlyError(signUpError.message));
        setLoading(false);
        return;
      }

      // Supabase's anti-enumeration behavior: signing up with an email that is
      // already registered returns a user with an empty `identities` array and
      // no error. Treat that as "already exists" rather than a fake success.
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        setError("An account with this email already exists. Try signing in instead.");
        setLoading(false);
        return;
      }

      // No session means email confirmation is required (config-dependent) —
      // don't navigate into a route the middleware will bounce back.
      if (!data.session) {
        setError("Check your email to confirm your account, then sign in.");
        setLoading(false);
        return;
      }

      router.push("/app/engage");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-[length:var(--font-size-section)] font-bold text-text-primary">
        Create account
      </h1>
      <p className="mt-2 text-text-secondary">
        Enter your email and a password to get started.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor={emailId} className="text-[length:var(--font-size-small)] font-medium text-text-primary">
            Email
          </label>
          <input
            id={emailId}
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => {
              if (error) setError("");
              setEmail(e.target.value);
            }}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={error ? errorId : undefined}
            className="min-h-[44px] w-full rounded-[var(--radius-sm)] border border-border bg-background px-4 py-3 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={passwordId} className="text-[length:var(--font-size-small)] font-medium text-text-primary">
            Password
          </label>
          <input
            id={passwordId}
            name="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => {
              if (error) setError("");
              setPassword(e.target.value);
            }}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={error ? errorId : undefined}
            className="min-h-[44px] w-full rounded-[var(--radius-sm)] border border-border bg-background px-4 py-3 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
          />
        </div>

        {error && (
          <p
            id={errorId}
            role="alert"
            className="flex items-start gap-2 rounded-[var(--radius-sm)] bg-destructive-subtle px-3 py-2 text-[length:var(--font-size-small)] text-destructive"
          >
            <span aria-hidden="true">⚠</span>
            <span>{error}</span>
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="min-h-[44px] w-full rounded-[var(--radius-sm)] bg-primary px-6 py-3 font-bold text-text-inverse focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:bg-primary/40 disabled:text-white/60 motion-safe:transition-colors motion-safe:duration-150 hover:bg-primary-hover"
        >
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-[length:var(--font-size-small)] text-text-secondary">
        Already have an account?{" "}
        <Link
          href="/sign-in"
          className="text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
