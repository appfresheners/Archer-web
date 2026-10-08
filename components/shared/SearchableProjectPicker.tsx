"use client";

import type { ProjectStatus } from "@/lib/supabase/schema";
import { useEffect, useId, useRef, useState } from "react";

export interface SearchableProjectOption {
  id: string;
  name: string;
  status: ProjectStatus;
  goal_id: string | null;
  parent_goal_text: string | null;
}

interface SearchableProjectPickerProps {
  label: string;
  options: SearchableProjectOption[];
  value: string;
  onValueChange: (value: string) => void;
  allowClear?: boolean;
  disabled?: boolean;
  emptyOptionsMessage?: string;
}

function optionLabel(project: SearchableProjectOption): string {
  return `${project.name} — ${project.parent_goal_text || "No goal"}`;
}

export default function SearchableProjectPicker({
  label,
  options,
  value,
  onValueChange,
  allowClear = false,
  disabled = false,
  emptyOptionsMessage = "No projects available",
}: SearchableProjectPickerProps) {
  const id = useId();
  const inputId = `${id}-input`;
  const listboxId = `${id}-listbox`;
  const activeOptionRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const eligibleOptions = options.filter(
    (project) => project.status !== "archived" && project.status !== "completed",
  );
  const selectedProject = eligibleOptions.find((project) => project.id === value);
  const inputValue = isEditing ? query : selectedProject ? optionLabel(selectedProject) : "";
  const normalizedQuery = query.trim().toLowerCase();
  const matches = eligibleOptions.filter((project) =>
    project.name.toLowerCase().includes(normalizedQuery),
  );
  const visibleMatches = matches.slice(0, 50);
  const activeProject = visibleMatches[activeIndex];

  useEffect(() => {
    if (isOpen) activeOptionRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, isOpen]);

  function selectProject(project: SearchableProjectOption) {
    onValueChange(project.id);
    setQuery("");
    setIsEditing(false);
    setIsOpen(false);
    setActiveIndex(-1);
  }

  function clearSelection() {
    onValueChange("");
    setQuery("");
    setIsEditing(false);
    setIsOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setActiveIndex(visibleMatches.length > 0 ? 0 : -1);
      } else {
        setActiveIndex((current) =>
          Math.min(current < 0 ? 0 : current + 1, visibleMatches.length - 1),
        );
      }
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setActiveIndex(visibleMatches.length - 1);
      } else {
        setActiveIndex((current) => Math.max(current < 0 ? visibleMatches.length - 1 : current - 1, 0));
      }
    } else if (event.key === "Enter" && isOpen && activeProject) {
      event.preventDefault();
      selectProject(activeProject);
    } else if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      setIsOpen(false);
      setIsEditing(false);
      setQuery("");
      setActiveIndex(-1);
    } else if (event.key === "Tab") {
      setIsOpen(false);
      setIsEditing(false);
      setActiveIndex(-1);
    }
  }

  const matchAnnouncement = `${matches.length} matching ${matches.length === 1 ? "project" : "projects"}${
    normalizedQuery ? ` for ${query.trim()}` : ""
  }`;

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={inputId}
        className="text-[length:var(--font-size-small)] font-medium text-text-secondary"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-activedescendant={activeProject ? `${id}-option-${activeProject.id}` : undefined}
          autoComplete="off"
          disabled={disabled}
          placeholder="Search projects…"
          value={inputValue}
          onFocus={() => {
            if (!isEditing) {
              setIsEditing(true);
              setQuery("");
            }
            setIsOpen(true);
          }}
          onClick={() => setIsOpen(true)}
          onChange={(event) => {
            if (value) onValueChange("");
            setIsEditing(true);
            setQuery(event.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            setIsOpen(false);
            setIsEditing(false);
            setActiveIndex(-1);
          }}
          className="min-h-[44px] w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface-raised px-3 py-2 pr-16 text-[length:var(--font-size-small)] text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
        />
        {allowClear && (value || query) && !disabled && (
          <button
            type="button"
            aria-label={value ? "Clear project selection" : "Clear search"}
            onClick={clearSelection}
            className="absolute right-1 top-0 min-h-[44px] min-w-[44px] cursor-pointer rounded-[var(--radius-sm)] px-2 text-text-secondary hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          >
            Clear
          </button>
        )}
        <div
          hidden={!isOpen}
          className="absolute z-20 mt-1 w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface-raised shadow-lg"
        >
          {eligibleOptions.length > 0 && matches.length === 0 && (
            <p role="status" className="px-3 py-3 text-text-secondary">
              No projects match
            </p>
          )}
          <div
            id={listboxId}
            role="listbox"
            aria-label={`${label} options`}
            className="max-h-64 overflow-y-auto"
          >
            {visibleMatches.map((project, index) => (
              <div
                id={`${id}-option-${project.id}`}
                key={project.id}
                ref={index === activeIndex ? activeOptionRef : undefined}
                role="option"
                aria-selected={project.id === value}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectProject(project)}
                className={`flex min-h-[44px] cursor-pointer flex-col justify-center px-3 py-2 text-[length:var(--font-size-small)] text-text-primary ${
                  index === activeIndex
                    ? "bg-primary-subtle"
                    : project.id === value
                      ? "border-l-2 border-primary bg-surface"
                      : "hover:bg-surface"
                }`}
              >
                <span className="font-medium">{project.name}</span>
                <span className="text-text-secondary">
                  {project.parent_goal_text || "No goal"}
                </span>
              </div>
            ))}
          </div>
          {matches.length > 50 && (
            <p className="border-t border-border px-3 py-2 text-[length:var(--font-size-small)] text-text-secondary">
              Keep typing to narrow results
            </p>
          )}
        </div>
      </div>
      {eligibleOptions.length === 0 && (
        <span role="status" className="text-[length:var(--font-size-small)] text-text-secondary">
          {emptyOptionsMessage}
        </span>
      )}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {matchAnnouncement}
      </span>
    </div>
  );
}