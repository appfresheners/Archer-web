/**
 * IntentionPanel — tomorrow's intention step of the daily shutdown (Story 10.1).
 *
 * Optional textarea for setting tomorrow's intention with 500-character limit.
 * Shows character count and provides helpful placeholder text.
 */

const MAX_INTENTION_LENGTH = 500;

interface IntentionPanelProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function IntentionPanel({
  value,
  onChange,
  disabled,
}: IntentionPanelProps) {
  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-border bg-surface p-[var(--spacing-card-p)]">
      <div className="flex flex-col gap-1">
        <h2 className="text-[length:var(--font-size-card)] font-semibold text-text-primary">
          Tomorrow&apos;s Intention
        </h2>
        <p className="text-[length:var(--font-size-small)] text-text-secondary">
          Optional — What matters most tomorrow? (Max 500 characters)
        </p>
      </div>
      <textarea
        value={value}
        onChange={(e) => {
          if (e.target.value.length <= MAX_INTENTION_LENGTH) {
            onChange(e.target.value);
          }
        }}
        disabled={disabled}
        placeholder="e.g., Ship the proposal review by noon, then focus on the client call prep..."
        rows={4}
        className="w-full rounded-[var(--radius-sm)] border border-border bg-background px-3 py-2 text-[length:var(--font-size-body)] text-text-primary placeholder:text-text-tertiary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
      />
      <p className="text-[length:var(--font-size-small)] text-text-secondary">
        {value.length} / {MAX_INTENTION_LENGTH} characters
      </p>
    </div>
  );
}
