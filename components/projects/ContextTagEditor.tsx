"use client";

/**
 * ContextTagEditor — add/remove optional `@energy` / `@location` / `@tool`
 * context tags on an action. Tags are `@key:value`; the key is chosen from a
 * small select and the value typed in an adjacent field. Tagging is optional —
 * an action with no tags is valid.
 */

import { CONTEXT_TAG_KEYS, type ContextTagKey } from "@/lib/actions/tags";
import { useState } from "react";

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
  const [key, setKey] = useState<ContextTagKey>("energy");
  const [value, setValue] = useState("");

  function addTag() {
    const trimmed = value.trim();
    if (trimmed === "") return;
    const tag = `@${key}:${trimmed}`;
    if (!tags.includes(tag)) onChange([...tags, tag]);
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
        <label className="sr-only" htmlFor="tag-key">
          Context tag type
        </label>
        <select
          id="tag-key"
          value={key}
          disabled={disabled}
          onChange={(e) => setKey(e.target.value as ContextTagKey)}
          className="min-h-[44px] rounded-[var(--radius-sm)] border border-border-strong bg-surface-raised px-2 py-1 text-[length:var(--font-size-small)] text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:opacity-60"
        >
          {CONTEXT_TAG_KEYS.map((k) => (
            <option key={k} value={k}>
              @{k}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="tag-value">
          Context tag value
        </label>
        <input
          id="tag-value"
          value={value}
          disabled={disabled}
          placeholder="value"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag();
            }
          }}
          className="min-h-[44px] flex-1 rounded-[var(--radius-sm)] border border-border-strong bg-surface-raised px-2 py-1 text-[length:var(--font-size-small)] text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:opacity-60"
        />
        <button
          type="button"
          onClick={addTag}
          disabled={disabled || value.trim() === ""}
          className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] border border-border-strong px-3 py-1 text-[length:var(--font-size-small)] font-medium text-text-primary hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Add tag
        </button>
      </div>
    </div>
  );
}
