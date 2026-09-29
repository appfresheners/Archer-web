"use client";

/**
 * SnapshotClosePanel — the closing bookend of the weekly review (Story 5.5).
 *
 * Two `aria-required` textareas:
 *   - "What matters most this coming week?" (`closing_intention`)
 *   - "What's the main thing that could derail it?" (`closing_blocker`)
 * and a "Complete review" action. The button stays clickable while fields are
 * empty (only disabled while busy) so pressing it reveals the inline
 * `aria-required` validation; the shell's handler blocks the actual completion
 * and flips `showErrors`. Empty required fields then wire `aria-invalid` +
 * `aria-describedby` to their message so status reaches assistive tech, not
 * just colour.
 *
 * Presentational + controlled: the shell owns the two values, the busy flag,
 * and the completion handler. `onChange` updates the shell's state; `onCommit`
 * (blur) persists via PATCH; `onComplete` runs the completion route. No local
 * state, no effects.
 *
 * Validation visibility: to avoid shouting on first render, an empty field only
 * shows its message once the user has attempted completion (`showErrors`) — the
 * shell flips that flag when Complete is pressed with an empty field. Copy stays
 * honest and brief per DESIGN/EXPERIENCE.
 */

import { SNAPSHOT_FIELD_MAX_LENGTH } from "@/lib/review/validate";

interface SnapshotClosePanelProps {
  intention: string;
  blocker: string;
  /** Fired on keystroke for the intention field. */
  onIntentionChange: (value: string) => void;
  /** Fired on keystroke for the blocker field. */
  onBlockerChange: (value: string) => void;
  /** Fired on blur of either field; the shell persists. */
  onCommit: () => void;
  /** Runs the completion route (shell-owned). */
  onComplete: () => void;
  /** Whether a persist/complete request is in flight. */
  busy: boolean;
  /** Show inline validation messages (set after an attempted completion). */
  showErrors: boolean;
}

export default function SnapshotClosePanel({
  intention,
  blocker,
  onIntentionChange,
  onBlockerChange,
  onCommit,
  onComplete,
  busy,
  showErrors,
}: SnapshotClosePanelProps) {
  const intentionEmpty = intention.trim().length === 0;
  const blockerEmpty = blocker.trim().length === 0;

  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-border bg-surface p-[var(--spacing-card-p)]">
      <header className="flex flex-col gap-1">
        <h2 className="text-[length:var(--font-size-card)] font-semibold text-text-primary">
          Close the loop
        </h2>
        <p className="text-text-secondary">
          Name the week ahead so next week has something to check against.
        </p>
      </header>

      <div className="flex flex-col gap-2">
        <label htmlFor="closing-intention" className="font-medium text-text-primary">
          What matters most this coming week?
        </label>
        <textarea
          id="closing-intention"
          value={intention}
          onChange={(event) => onIntentionChange(event.target.value)}
          onBlur={onCommit}
          disabled={busy}
          aria-required="true"
          aria-invalid={showErrors && intentionEmpty ? "true" : undefined}
          aria-describedby={
            showErrors && intentionEmpty ? "closing-intention-error" : undefined
          }
          rows={3}
          maxLength={SNAPSHOT_FIELD_MAX_LENGTH}
          className="w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 py-2 text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
        />
        {showErrors && intentionEmpty && (
          <p
            id="closing-intention-error"
            className="text-[length:var(--font-size-small)] text-destructive"
          >
            Add an intention before completing.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="closing-blocker" className="font-medium text-text-primary">
          What&rsquo;s the main thing that could derail it?
        </label>
        <textarea
          id="closing-blocker"
          value={blocker}
          onChange={(event) => onBlockerChange(event.target.value)}
          onBlur={onCommit}
          disabled={busy}
          aria-required="true"
          aria-invalid={showErrors && blockerEmpty ? "true" : undefined}
          aria-describedby={
            showErrors && blockerEmpty ? "closing-blocker-error" : undefined
          }
          rows={3}
          maxLength={SNAPSHOT_FIELD_MAX_LENGTH}
          className="w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 py-2 text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
        />
        {showErrors && blockerEmpty && (
          <p
            id="closing-blocker-error"
            className="text-[length:var(--font-size-small)] text-destructive"
          >
            Name a blocker before completing.
          </p>
        )}
      </div>

      {/* The button stays clickable when fields are empty (only disabled while
          busy) so that pressing it with an empty field reveals the inline
          `aria-required` validation via the shell's handler, rather than a
          silently-disabled control the AC's "inline validation" would never
          surface. `aria-disabled` reflects the not-yet-completable state. */}
      <button
        type="button"
        onClick={onComplete}
        disabled={busy}
        aria-disabled={intentionEmpty || blockerEmpty ? "true" : undefined}
        className="inline-flex min-h-[44px] items-center self-start rounded-[var(--radius-sm)] bg-primary px-4 py-2 font-medium text-text-inverse transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Completing…" : "Complete review"}
      </button>
    </div>
  );
}
