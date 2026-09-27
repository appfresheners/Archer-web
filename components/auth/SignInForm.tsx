"use client";

/**
 * Sign-in form (client component).
 *
 * Email + password only — no OAuth, no magic link. Submits to Supabase Auth's
 * `signInWithPassword` via the browser client. On success it navigates to
 * `/app/engage` and refreshes so the middleware/server re-reads the freshly
 * set session cookie. On failure it surfaces a friendly inline error via a
 * `role="alert"` region associated with the form. Empty fields are blocked
 * before Supabase is called; the submit button is disabled while in flight to
 * prevent double-submit.
 */

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

/** Map raw Supabase errors to plain, friendly sentences. */
function friendlyError(message: string): string {
  if (/invalid login credentials/i.test(message)) {
    return "That email or password is incorrect. Please try again.";
  }
  if (/email not confirmed/i.test(message)) {
    return "Please confirm your email address before signing in.";
  }
  return message || "Something went wrong. Please try again.";
}

export default function SignInForm() {
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
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (signInError) {
        setError(friendlyError(signInError.message));
        setLoading(false);
        return;
      }

      // No session means auth did not actually establish a login (edge cases
      // in some project configs); don't navigate into a route the middleware
      // will bounce straight back.
      if (!data.session) {
        setError("Sign-in failed. Please try again.");
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
        Sign in
      </h1>
      <p className="mt-2 text-text-secondary">
        Welcome back. Enter your details to continue.
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
            autoComplete="current-password"
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
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="mt-6 flex flex-col gap-2 text-[length:var(--font-size-small)]">
        <Link
          href="/forgot-password"
          className="text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
        >
          Forgot password?
        </Link>
        <p className="text-text-secondary">
          Don&apos;t have an account?{" "}
          <Link
            href="/sign-up"
            className="text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          >
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}
