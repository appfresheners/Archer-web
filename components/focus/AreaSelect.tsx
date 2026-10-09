"use client";

export interface AreaOption {
  id: string;
  name: string;
}

export default function AreaSelect({
  id,
  label = "Life Area",
  value,
  areas,
  currentArchivedArea,
  disabled = false,
  onChange,
}: {
  id: string;
  label?: string;
  value: string;
  areas: AreaOption[];
  currentArchivedArea?: AreaOption | null;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const fieldClass =
    "min-h-[44px] rounded-[var(--radius-sm)] border border-border-strong bg-surface-raised px-3 py-2 text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-medium text-text-primary">
        {label} <span className="text-text-secondary">(optional)</span>
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className={fieldClass}
      >
        <option value="">No Area</option>
        {currentArchivedArea &&
          currentArchivedArea.id === value &&
          !areas.some((area) => area.id === currentArchivedArea.id) && (
            <option value={currentArchivedArea.id} disabled>
              {currentArchivedArea.name} (archived)
            </option>
          )}
        {areas.map((area) => (
          <option key={area.id} value={area.id}>
            {area.name}
          </option>
        ))}
      </select>
    </div>
  );
}