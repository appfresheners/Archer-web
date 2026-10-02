"use client";

/**
 * Set-new-password form (client component).
 *
 * Reached after the `/auth/callback` handler has established a recovery
 * session. Submits the new password to Supabase Auth's `updateUser` via the
 * browser client (the recovery session in the cookie authorizes the update).
 *
 * On success it navigates into the app (`/app/engage`) and refreshes so the
 * middleware/server re-read the now-fully-authenticated session cookie. On
 * failure — including the case where there is no recovery session (an expired
 * or missing link) — a friendly inline `role="alert"` error is shown and the
 * user stays on the page. Empty password is blocked before the network is
 * touched; submit is disabled while in flight.
 */

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

/** Map raw Supabase errors to plain, friendly sentences. */
function friendlyError(message: string): string {
  if (/auth session missing|session_not_found|no.*session/i.test(message)) {
    return "Your reset link has expired or is invalid. Please request a new one.";
  }
  if (/password/i.test(message) && /(least|short|weak|6)/i.test(message)) {
    return "Please choose a stronger password (at least 6 characters).";
  }
  if (/same.*password|different from the old/i.test(message)) {
    return "Choose a password different from your current one.";
  }
  return message || "Something went wrong. Please try again.";
}

export default function ResetPasswordForm() {
  const router = useRouter();
  const passwordId = useId();
  const errorId = useId();

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;

    // Inline validation before touching the network.
    if (password === "") {
      setError("Enter a new password.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(friendlyError(updateError.message));
        setLoading(false);
        return;
      }

      // No user back means the update did not apply (e.g. no recovery
      // session) — treat as a failure rather than navigating into a route the
      // middleware may bounce.
      if (!data.user) {
        setError(
          "Your reset link has expired or is invalid. Please request a new one.",
        );
        setLoading(false);
        return;
      }

      router.push("/app/engage");
      router.refresh();
    } catch {
      setError(
        "Couldn't reach the server. Check your connection and try again.",
      );
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-[length:var(--font-size-section)] font-bold text-text-primary">
        Choose a new password
      </h1>
      <p className="mt-2 text-text-secondary">
        Enter a new password for your account.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor={passwordId} className="text-[length:var(--font-size-small)] font-medium text-text-primary">
            New password
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
          {loading ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
