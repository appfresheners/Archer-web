"use client";

/**
 * SnapshotOpenPanel — the opening bookend of the weekly review (Story 5.5).
 *
 * Shows:
 *   - a header "Week {N} · {Mon dd} – {Sun dd}" computed from the session's
 *     stored `week_start_date` / `week_end_date` (parsed as UTC so the date
 *     doesn't drift across timezones),
 *   - a read-only "Last week you said:" block with the PRIOR week's closing
 *     snapshot (intention + blocker, and its opening retrospective if present),
 *     or a gentle "No prior snapshot yet." when there is no prior row,
 *   - a controlled textarea for the opening retrospective ("What actually moved
 *     last week? What didn't?").
 *
 * The panel is presentational + controlled: the shell owns the retrospective
 * value and the gate (Start is disabled until it is non-empty). `onChange`
 * updates the shell's state; `onCommit` (blur) triggers the debounced-ish
 * persistence PATCH. No local state, no effects.
 */

/** Just the prior-snapshot fields the panel displays (read-only). */
export interface PriorSnapshotDisplay {
  intention: string;
  blocker: string;
  opening_retrospective: string | null;
}

interface SnapshotOpenPanelProps {
  weekNumber: number;
  /** `YYYY-MM-DD` Monday of the review week. */
  weekStartDate: string;
  /** `YYYY-MM-DD` Sunday of the review week. */
  weekEndDate: string;
  /** The prior week's closing snapshot, or null if none exists. */
  priorSnapshot: PriorSnapshotDisplay | null;
  /** Controlled value of the opening retrospective. */
  value: string;
  /** Fired on every keystroke; the shell holds the value. */
  onChange: (value: string) => void;
  /** Fired on blur; the shell persists the current value. */
  onCommit: () => void;
  /** Disables input while a persist/complete request is in flight. */
  disabled?: boolean;
}

/**
 * Parse a `YYYY-MM-DD` string as a UTC calendar date. Building the Date from
 * explicit UTC parts avoids the local-timezone shift that `new Date("YYYY-MM-DD")`
 * can introduce.
 */
function parseUtcDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map((n) => Number.parseInt(n, 10));
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

/** Format a `YYYY-MM-DD` as "Mon dd" (e.g. "Sep 28"), timezone-stable. */
function formatMonthDay(iso: string): string {
  const date = parseUtcDate(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  });
}

export default function SnapshotOpenPanel({
  weekNumber,
  weekStartDate,
  weekEndDate,
  priorSnapshot,
  value,
  onChange,
  onCommit,
  disabled = false,
}: SnapshotOpenPanelProps) {
  const header = `Week ${weekNumber} · ${formatMonthDay(weekStartDate)} – ${formatMonthDay(weekEndDate)}`;

  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-border bg-surface p-[var(--spacing-card-p)]">
      <header className="flex flex-col gap-1">
        <h2 className="text-[length:var(--font-size-card)] font-semibold text-text-primary">
          {header}
        </h2>
        <p className="text-text-secondary">
          This isn&rsquo;t a report — it&rsquo;s a reality check.
        </p>
      </header>

      <section
        aria-label="Last week you said"
        className="flex flex-col gap-2 rounded-[var(--radius-sm)] border border-border bg-surface-raised p-3"
      >
        <h3 className="text-[length:var(--font-size-small)] font-semibold uppercase tracking-wide text-text-muted">
          Last week you said:
        </h3>
        {priorSnapshot ? (
          <dl className="flex flex-col gap-2 text-text-secondary">
            <div className="flex flex-col gap-0.5">
              <dt className="text-[length:var(--font-size-small)] font-medium text-text-primary">
                What mattered most
              </dt>
              <dd>{priorSnapshot.intention}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-[length:var(--font-size-small)] font-medium text-text-primary">
                What could derail it
              </dt>
              <dd>{priorSnapshot.blocker}</dd>
            </div>
            {priorSnapshot.opening_retrospective && (
              <div className="flex flex-col gap-0.5">
                <dt className="text-[length:var(--font-size-small)] font-medium text-text-primary">
                  Last week&rsquo;s retrospective
                </dt>
                <dd>{priorSnapshot.opening_retrospective}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="text-text-muted">No prior snapshot yet.</p>
        )}
      </section>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="opening-retrospective"
          className="font-medium text-text-primary"
        >
          What actually moved last week? What didn&rsquo;t?
        </label>
        <textarea
          id="opening-retrospective"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onCommit}
          disabled={disabled}
          rows={5}
          maxLength={2000}
          className="min-h-[8rem] w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 py-2 text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>
    </div>
  );
}
