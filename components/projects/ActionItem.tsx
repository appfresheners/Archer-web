"use client";

/**
 * ActionItem — one row in a project's action list (Story 4.4).
 *
 * Layout: checkbox (reflects status; done = checked) — action text — context
 * tag chips — controls (edit / delete / move up / move down). Supports inline
 * text editing and optional context-tag editing.
 *
 * State treatments (per DESIGN.md):
 *   - available → default border
 *   - committed → primary border + primary-subtle background (the single next
 *                 action; committing itself is wired in Story 4.5)
 *   - done      → line-through + muted text + checked checkbox
 */

import ContextTagEditor from "@/components/projects/ContextTagEditor";
import type { ActionStatus } from "@/lib/supabase/schema";
import { useState } from "react";

export interface ActionItemData {
  id: string;
  text: string;
  status: ActionStatus;
  context_tags: string[] | null;
  sort_order: number;
}

export interface ActionItemProps {
  action: ActionItemData;
  disabled?: boolean;
  isFirst: boolean;
  isLast: boolean;
  onToggleDone: (action: ActionItemData) => void;
  onSaveText: (action: ActionItemData, text: string) => void;
  onSaveTags: (action: ActionItemData, tags: string[]) => void;
  onDelete: (action: ActionItemData) => void;
  onMove: (action: ActionItemData, direction: "up" | "down") => void;
  /** Commit this action as the project's single next action (Story 4.5). */
  onCommit: (action: ActionItemData) => void;
}

function containerClass(status: ActionStatus): string {
  const base =
    "flex flex-col gap-2 rounded-[var(--radius-md)] border p-3 transition-colors";
  if (status === "committed") {
    return `${base} border-primary bg-primary-subtle`;
  }
  return `${base} border-border bg-surface-raised`;
}

const iconBtn =
  "inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-sm)] text-text-secondary hover:bg-surface hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-40";

export default function ActionItem({
  action,
  disabled,
  isFirst,
  isLast,
  onToggleDone,
  onSaveText,
  onSaveTags,
  onDelete,
  onMove,
  onCommit,
}: ActionItemProps) {
  const [editing, setEditing] = useState(false);
  const [taggingOpen, setTaggingOpen] = useState(false);
  const [draft, setDraft] = useState(action.text);
  const done = action.status === "done";
  const tags = action.context_tags ?? [];

  function saveText() {
    // Guard against a double-fire when Enter (which exits edit mode) is quickly
    // followed by the input's blur handler — only save once per edit session.
    if (!editing) return;
    const trimmed = draft.trim();
    if (trimmed !== "" && trimmed !== action.text) {
      onSaveText(action, trimmed);
    }
    setEditing(false);
  }

  return (
    <li className={containerClass(action.status)}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={done}
          disabled={disabled}
          aria-label={done ? `Mark "${action.text}" not done` : `Mark "${action.text}" done`}
          onChange={() => onToggleDone(action)}
          className="mt-1 h-5 w-5 shrink-0"
        />

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {editing ? (
            <input
              value={draft}
              autoFocus
              maxLength={500}
              disabled={disabled}
              aria-label="Edit action text"
              onChange={(e) => setDraft(e.target.value)}
              onBlur={saveText}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  saveText();
                } else if (e.key === "Escape") {
                  setDraft(action.text);
                  setEditing(false);
                }
              }}
              className="min-h-[44px] rounded-[var(--radius-sm)] border border-border-strong bg-surface-raised px-2 py-1 text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
            />
          ) : (
            <span
              className={
                done
                  ? "text-text-muted line-through"
                  : "text-text-primary"
              }
            >
              {action.text}
            </span>
          )}

          {tags.length > 0 && !taggingOpen && (
            <ul className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-[var(--radius-xs)] bg-surface px-2 py-0.5 text-[length:var(--font-size-caption)] text-text-secondary"
                >
                  {tag}
                </li>
              ))}
            </ul>
          )}

          {taggingOpen && (
            <ContextTagEditor
              tags={tags}
              disabled={disabled}
              onChange={(next) => onSaveTags(action, next)}
            />
          )}
        </div>

        <div className="flex shrink-0 items-center">
          {action.status === "available" && (
            <button
              type="button"
              className="mr-1 inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] border border-primary px-3 py-1 text-[length:var(--font-size-small)] font-medium text-primary hover:bg-primary-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={`Commit "${action.text}" as the next action`}
              disabled={disabled}
              onClick={() => onCommit(action)}
            >
              Commit
            </button>
          )}
          <button
            type="button"
            className={iconBtn}
            aria-label="Move action up"
            disabled={disabled || isFirst}
            onClick={() => onMove(action, "up")}
          >
            ↑
          </button>
          <button
            type="button"
            className={iconBtn}
            aria-label="Move action down"
            disabled={disabled || isLast}
            onClick={() => onMove(action, "down")}
          >
            ↓
          </button>
          <button
            type="button"
            className={iconBtn}
            aria-label={taggingOpen ? "Close tags" : "Edit tags"}
            disabled={disabled}
            onClick={() => setTaggingOpen((v) => !v)}
          >
            #
          </button>
          <button
            type="button"
            className={iconBtn}
            aria-label="Edit action"
            disabled={disabled || editing}
            onClick={() => {
              setDraft(action.text);
              setEditing(true);
            }}
          >
            ✎
          </button>
          <button
            type="button"
            className={`${iconBtn} hover:text-destructive`}
            aria-label="Delete action"
            disabled={disabled}
            onClick={() => onDelete(action)}
          >
            🗑
          </button>
        </div>
      </div>
    </li>
  );
}
