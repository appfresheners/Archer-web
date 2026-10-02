"use client";

/**
 * Forgot-password request form (client component).
 *
 * Email only — submits to Supabase Auth's `resetPasswordForEmail` via the
 * browser client. The `redirectTo` is derived from the current request origin
 * (`window.location.origin`) so no host is hardcoded; it points at the app's
 * `/auth/callback` route with `next=/reset-password`.
 *
 * No account enumeration: after a submit we show the SAME neutral confirmation
 * whether or not the email is registered. The `resetPasswordForEmail` result
 * is deliberately not branched on — both the resolve and reject paths land on
 * the identical confirmation. Empty/whitespace email is blocked inline before
 * the network is touched; submit is disabled while in flight.
 */

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useId, useState } from "react";

export default function ForgotPasswordForm() {
  const emailId = useId();
  const errorId = useId();

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;

    // Inline validation before touching the network.
    if (email.trim() === "") {
      setError("Enter your email address.");
      return;
    }

    setError("");
    setLoading(true);

    // No-enumeration invariant: we swallow any result (success or error) from
    // `resetPasswordForEmail` and always show the same neutral confirmation.
    // Do NOT branch UI on the outcome — that would leak account existence.
    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`;
      await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    } catch {
      // Intentionally swallowed — a network/config error must not reveal
      // whether the address is registered. The confirmation is shown either
      // way.
    }

    setLoading(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div>
        <h1 className="text-[length:var(--font-size-section)] font-bold text-text-primary">
          Check your email
        </h1>
        <p role="status" className="mt-4 text-text-secondary">
          If an account exists for that email, we&apos;ve sent a password reset
          link. Follow it to choose a new password.
        </p>

        <div className="mt-6 text-[length:var(--font-size-small)]">
          <Link
            href="/sign-in"
            className="text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-[length:var(--font-size-section)] font-bold text-text-primary">
        Reset your password
      </h1>
      <p className="mt-2 text-text-secondary">
        Enter your email and we&apos;ll send you a link to reset your password.
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
          {loading ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <div className="mt-6 text-[length:var(--font-size-small)]">
        <Link
          href="/sign-in"
          className="text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
