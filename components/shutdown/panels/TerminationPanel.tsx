/**
 * TerminationPanel — the termination phrase step of the daily shutdown
 * (Story 10.1).
 *
 * User must type the exact termination phrase to enable the completion button.
 * Shows the phrase to say aloud, then validates input matches exactly.
 */

const TERMINATION_PHRASE = "Shutdown complete";

interface TerminationPanelProps {
  value: string;
  onChange: (value: string) => void;
  onComplete: () => void;
  disabled?: boolean;
  error?: string | null;
}

export default function TerminationPanel({
  value,
  onChange,
  onComplete,
  disabled,
  error,
}: TerminationPanelProps) {
  const isValid = value.trim() === TERMINATION_PHRASE;

  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-border bg-surface p-[var(--spacing-card-p)]">
      <div className="flex flex-col gap-1">
        <h2 className="text-[length:var(--font-size-card)] font-semibold text-text-primary">
          Complete Shutdown
        </h2>
        <p className="text-[length:var(--font-size-small)] text-text-secondary">
          Say it aloud: &ldquo;<strong>{TERMINATION_PHRASE}</strong>&rdquo;
        </p>
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Then type it here to confirm"
        className="w-full rounded-[var(--radius-sm)] border border-border bg-background px-3 py-2 text-[length:var(--font-size-body)] text-text-primary placeholder:text-text-tertiary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
      />

      {error && (
        <div className="rounded-[var(--radius-sm)] border border-red-600 bg-red-50 p-3 text-red-800">
          <p className="text-[length:var(--font-size-small)]">{error}</p>
        </div>
      )}

      <button
        type="button"
        onClick={onComplete}
        disabled={!isValid || disabled}
        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-primary px-[var(--spacing-button-px)] py-[var(--spacing-button-py)] text-[length:var(--font-size-body)] font-medium text-text-inverse focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] motion-safe:transition-colors motion-safe:duration-150 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {disabled ? "Saving..." : "Done"}
      </button>
    </div>
  );
}
