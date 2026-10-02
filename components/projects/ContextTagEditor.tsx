"use client";

/**
 * ContextTagEditor — add/remove fixed location and energy context tags.
 * Values are selected from the GTD options in `lib/actions/tags`; there is no
 * free-text tag entry.
 */

import {
  ENERGY_OPTIONS,
  LOCATION_OPTIONS,
  type ContextTagKey,
} from "@/lib/actions/tags";
import { useId, useState } from "react";

export interface ContextTagEditorProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
}

export default function ContextTagEditor({
  tags,
  onChange,
  disabled,
}: ContextTagEditorProps) {
  const [key, setKey] = useState<ContextTagKey>("location");
  const [value, setValue] = useState("");
  const keyId = useId();
  const valueId = useId();
  const options = key === "energy" ? ENERGY_OPTIONS : LOCATION_OPTIONS;

  function addTag() {
    if (value === "") return;
    const tag = `@${key}:${value}`;
    if (tags.includes(tag)) {
      setValue("");
      return;
    }
    const next = key === "energy"
      ? tags.filter((existing) => !existing.startsWith("@energy:"))
      : tags;
    onChange([...next, tag]);
    setValue("");
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  return (
    <div className="flex flex-col gap-2">
      {tags.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <li key={tag}>
              <span className="inline-flex items-center gap-1 rounded-[var(--radius-xs)] bg-surface px-2 py-0.5 text-[length:var(--font-size-caption)] text-text-secondary">
                {tag}
                <button
                  type="button"
                  aria-label={`Remove ${tag}`}
                  onClick={() => removeTag(tag)}
                  disabled={disabled}
                  className="rounded-full px-1 text-text-muted hover:text-destructive focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-focus-ring)] disabled:opacity-60"
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={keyId}>
          Tag category
        </label>
        <select
          id={keyId}
          value={key}
          disabled={disabled}
          onChange={(e) => {
            setKey(e.target.value as ContextTagKey);
            setValue("");
          }}
          className="min-h-[44px] rounded-[var(--radius-sm)] border border-border-strong bg-surface-raised px-2 py-1 text-[length:var(--font-size-small)] text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:opacity-60"
        >
          <option value="location">Location</option>
          <option value="energy">Energy</option>
        </select>
        <label className="sr-only" htmlFor={valueId}>
          Select {key}
        </label>
        <select
          id={valueId}
          value={value}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          className="min-h-[44px] flex-1 rounded-[var(--radius-sm)] border border-border-strong bg-surface-raised px-2 py-1 text-[length:var(--font-size-small)] text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:opacity-60"
        >
          <option value="">Choose {key}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={addTag}
          disabled={disabled || value === ""}
          className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] border border-border-strong px-3 py-1 text-[length:var(--font-size-small)] font-medium text-text-primary hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Add tag
        </button>
      </div>
    </div>
  );
}
