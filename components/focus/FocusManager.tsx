"use client";

import StatusBadge from "@/components/goals/StatusBadge";
import { sanitizeFocusProfile } from "@/lib/focus/validate";
import type {
  AreaOfFocus,
  FocusProfile,
  GoalStatus,
  ProjectStatus,
} from "@/lib/supabase/schema";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

export type FocusAreaData = Pick<
  AreaOfFocus,
  "id" | "name" | "description" | "sort_order" | "archived_at"
>;

export interface FocusGoalData {
  id: string;
  area_id: string;
  goal_text: string;
  status: GoalStatus;
}

export interface FocusProjectData {
  id: string;
  area_id: string;
  name: string;
  status: ProjectStatus;
  goal_id: null;
}

type ProfileData = Pick<FocusProfile, "vision" | "purpose" | "principles"> | null;

async function requestJson(url: string, method: string, body: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (response.ok) return null;
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return payload?.error ?? "Something went wrong. Please try again.";
}

function LinkedRecords({
  area,
  goals,
  projects,
}: {
  area: FocusAreaData;
  goals: FocusGoalData[];
  projects: FocusProjectData[];
}) {
  const areaGoals = goals.filter((goal) => goal.area_id === area.id);
  const areaProjects = projects.filter((project) => project.area_id === area.id);

  if (areaGoals.length === 0 && areaProjects.length === 0) {
    return <p className="text-[length:var(--font-size-small)] text-text-secondary">No linked Goals or standalone Projects.</p>;
  }

  return (
    <ul className="divide-y divide-border">
      {areaGoals.map((goal) => (
        <li key={`goal-${goal.id}`}>
          <Link
            href={`/app/goals/${goal.id}`}
            className="flex min-h-[44px] items-center justify-between gap-3 py-2 focus-visible:rounded-[var(--radius-sm)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          >
            <span className="min-w-0 break-words text-text-primary">{goal.goal_text}</span>
            <StatusBadge status={goal.status} />
          </Link>
        </li>
      ))}
      {areaProjects.map((project) => (
        <li key={`project-${project.id}`}>
          <Link
            href={`/app/projects/${project.id}`}
            className="flex min-h-[44px] items-center justify-between gap-3 py-2 focus-visible:rounded-[var(--radius-sm)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          >
            <span className="min-w-0 break-words text-text-primary">{project.name}</span>
            <StatusBadge status={project.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function AreaEditor({
  area,
  goals,
  projects,
  archived,
  busy,
  onBusy,
  onError,
  onSaved,
  onMove,
  canMoveUp,
  canMoveDown,
}: {
  area: FocusAreaData;
  goals: FocusGoalData[];
  projects: FocusProjectData[];
  archived: boolean;
  busy: boolean;
  onBusy: (value: boolean) => void;
  onError: (message: string) => void;
  onSaved: () => void;
  onMove?: (direction: "up" | "down") => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}) {
  const [name, setName] = useState(area.name);
  const [description, setDescription] = useState(area.description ?? "");
  const router = useRouter();

  async function mutate(body: unknown) {
    onBusy(true);
    onError("");
    try {
      const error = await requestJson(`/api/areas/${area.id}`, "PATCH", body);
      if (error) {
        onError(error);
        return;
      }
      onSaved();
      router.refresh();
    } catch {
      onError("Something went wrong. Please try again.");
    } finally {
      onBusy(false);
    }
  }

  return (
    <article className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-border bg-surface-raised p-[var(--spacing-card-p)]">
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void mutate({ name, description });
        }}
      >
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
          <label className="flex flex-col gap-1 text-[length:var(--font-size-small)] font-medium text-text-secondary">
            Area name
            <input
              value={name}
              maxLength={200}
              disabled={busy || archived}
              onChange={(event) => setName(event.target.value)}
              className="min-h-[44px] rounded-[var(--radius-sm)] border border-border-strong bg-background px-3 py-2 text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:opacity-60"
            />
          </label>
          <label className="flex flex-col gap-1 text-[length:var(--font-size-small)] font-medium text-text-secondary">
            Description
            <textarea
              value={description}
              maxLength={5000}
              rows={2}
              disabled={busy || archived}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-20 rounded-[var(--radius-sm)] border border-border-strong bg-background px-3 py-2 text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:opacity-60"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!archived && (
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] bg-primary px-4 py-2 font-medium text-text-inverse hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:opacity-60"
            >
              Save Area
            </button>
          )}
          {archived ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void mutate({ action: "restore" })}
              className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] border border-border-strong px-4 py-2 font-medium text-text-primary hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:opacity-60"
            >
              Restore {area.name}
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={busy || !canMoveUp}
                aria-label={`Move ${area.name} up`}
                title="Move up"
                onClick={() => onMove?.("up")}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--radius-sm)] border border-border-strong text-lg text-text-primary hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:opacity-40"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={busy || !canMoveDown}
                aria-label={`Move ${area.name} down`}
                title="Move down"
                onClick={() => onMove?.("down")}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--radius-sm)] border border-border-strong text-lg text-text-primary hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:opacity-40"
              >
                ↓
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void mutate({ action: "archive" })}
                className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] border border-border-strong px-4 py-2 font-medium text-text-primary hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:opacity-60"
              >
                Archive
              </button>
            </>
          )}
        </div>
      </form>
      <LinkedRecords area={area} goals={goals} projects={projects} />
    </article>
  );
}

export default function FocusManager({
  profile,
  areas,
  goals,
  projects,
}: {
  profile: ProfileData;
  areas: FocusAreaData[];
  goals: FocusGoalData[];
  projects: FocusProjectData[];
}) {
  const router = useRouter();
  const [vision, setVision] = useState(profile?.vision ?? "");
  const [purpose, setPurpose] = useState(profile?.purpose ?? "");
  const [principles, setPrinciples] = useState(profile?.principles.join("\n") ?? "");
  const [savedProfile, setSavedProfile] = useState(profile);
  const [editingProfile, setEditingProfile] = useState(profile === null);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);
  const [areaError, setAreaError] = useState("");

  const activeAreas = areas.filter((area) => area.archived_at === null);
  const archivedAreas = areas.filter((area) => area.archived_at !== null);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const profile = sanitizeFocusProfile({
      vision,
      purpose,
      principles: principles.split("\n"),
    });
    if (!profile) {
      setProfileSaved(false);
      setProfileError(
        "Use up to 50 principles with 500 characters each; Vision and Purpose allow 10,000 characters each.",
      );
      return;
    }

    setBusy(true);
    setProfileError("");
    setProfileSaved(false);
    try {
      const error = await requestJson("/api/focus/profile", "PUT", profile);
      if (error) {
        setProfileError(error);
      } else {
        setSavedProfile(profile);
        setEditingProfile(false);
        setProfileSaved(true);
        router.refresh();
      }
    } catch {
      setProfileError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function cancelProfileEdit() {
    setVision(savedProfile?.vision ?? "");
    setPurpose(savedProfile?.purpose ?? "");
    setPrinciples(savedProfile?.principles.join("\n") ?? "");
    setProfileError("");
    setEditingProfile(false);
  }

  async function addArea(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setAreaError("");
    try {
      const error = await requestJson("/api/areas", "POST", {
        name: newName,
        description: newDescription,
      });
      if (error) {
        setAreaError(error);
      } else {
        setNewName("");
        setNewDescription("");
        router.refresh();
      }
    } catch {
      setAreaError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function moveArea(areaId: string, direction: "up" | "down") {
    const index = activeAreas.findIndex((area) => area.id === areaId);
    const otherIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || otherIndex < 0 || otherIndex >= activeAreas.length) return;
    const orderedIds = activeAreas.map((area) => area.id);
    [orderedIds[index], orderedIds[otherIndex]] = [
      orderedIds[otherIndex],
      orderedIds[index],
    ];

    setBusy(true);
    setAreaError("");
    try {
      const error = await requestJson("/api/areas/reorder", "PATCH", { orderedIds });
      if (error) setAreaError(error);
      else router.refresh();
    } catch {
      setAreaError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-[var(--spacing-section-y)]">
      <header>
        <h1 className="text-[length:var(--font-size-section)] font-bold text-text-primary">Focus</h1>
      </header>

      <aside
        role="note"
        className="flex flex-col gap-2 rounded-[var(--radius-sm)] border-l-4 border-primary bg-primary-subtle px-4 py-3 text-text-primary"
      >
        <p>This page is for alignment with God, purpose, and long-term direction — not pressure.</p>
        <p>I do not need to solve my whole life here. I only need to reconnect with direction and choose the next faithful step.</p>
      </aside>

      <section aria-labelledby="profile-heading" className="flex flex-col gap-4">
        <h2 id="profile-heading" className="text-[length:var(--font-size-subheading)] font-semibold text-text-primary">Purpose, Vision &amp; Principles</h2>
        {editingProfile ? (
          <form onSubmit={saveProfile} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-[length:var(--font-size-small)] font-medium text-text-secondary">
              Purpose
              <textarea
                value={purpose}
                maxLength={10000}
                rows={3}
                disabled={busy}
                onChange={(event) => setPurpose(event.target.value)}
                className="min-h-24 rounded-[var(--radius-sm)] border border-border-strong bg-surface-raised px-3 py-2 text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:opacity-60"
              />
            </label>
            <label className="flex flex-col gap-1 text-[length:var(--font-size-small)] font-medium text-text-secondary">
              Vision
              <textarea
                value={vision}
                maxLength={10000}
                rows={4}
                disabled={busy}
                onChange={(event) => setVision(event.target.value)}
                className="min-h-28 rounded-[var(--radius-sm)] border border-border-strong bg-surface-raised px-3 py-2 text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:opacity-60"
              />
            </label>
            <label className="flex flex-col gap-1 text-[length:var(--font-size-small)] font-medium text-text-secondary">
              Principles
              <textarea
                value={principles}
                maxLength={25049}
                rows={4}
                disabled={busy}
                onChange={(event) => setPrinciples(event.target.value)}
                className="min-h-28 rounded-[var(--radius-sm)] border border-border-strong bg-surface-raised px-3 py-2 text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:opacity-60"
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] bg-primary px-4 py-2 font-medium text-text-inverse hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:opacity-60"
              >
                Save profile
              </button>
              {savedProfile && (
                <button
                  type="button"
                  onClick={cancelProfileEdit}
                  disabled={busy}
                  className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] border border-border-strong px-4 py-2 font-medium text-text-primary hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:opacity-60"
                >
                  Cancel
                </button>
              )}
              {profileError && <p role="alert" className="text-[length:var(--font-size-small)] text-destructive">{profileError}</p>}
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1 rounded-[var(--radius-sm)] border border-border bg-surface-raised p-4">
                <dt className="text-[length:var(--font-size-small)] font-medium text-text-secondary">Purpose</dt>
                <dd className="whitespace-pre-wrap break-words text-text-primary">{savedProfile?.purpose || "Not set yet."}</dd>
              </div>
              <div className="flex flex-col gap-1 rounded-[var(--radius-sm)] border border-border bg-surface-raised p-4">
                <dt className="text-[length:var(--font-size-small)] font-medium text-text-secondary">Vision</dt>
                <dd className="whitespace-pre-wrap break-words text-text-primary">{savedProfile?.vision || "Not set yet."}</dd>
              </div>
            </dl>
            <div className="flex flex-col gap-2">
              <h3 className="font-medium text-text-primary">Principles</h3>
              {savedProfile?.principles.length ? (
                <ul className="flex flex-col gap-2">
                  {savedProfile.principles.map((principle, index) => (
                    <li
                      key={`${index}-${principle}`}
                      className="rounded-[var(--radius-sm)] border border-border bg-surface-raised px-4 py-3 text-text-primary"
                    >
                      {principle}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-text-secondary">No principles added yet.</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setProfileSaved(false);
                  setProfileError("");
                  setEditingProfile(true);
                }}
                className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] border border-border-strong px-4 py-2 font-medium text-text-primary hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
              >
                Edit profile
              </button>
              {profileSaved && (
                <p role="status" aria-live="polite" className="text-[length:var(--font-size-small)] text-text-secondary">
                  Profile saved.
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="areas-heading" className="flex flex-col gap-4">
        <h2 id="areas-heading" className="text-[length:var(--font-size-subheading)] font-semibold text-text-primary">Areas</h2>
        <form onSubmit={addArea} className="grid gap-3 border-b border-border pb-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto] sm:items-end">
          <label className="flex flex-col gap-1 text-[length:var(--font-size-small)] font-medium text-text-secondary">
            New Area
            <input value={newName} maxLength={200} disabled={busy} onChange={(event) => setNewName(event.target.value)} className="min-h-[44px] rounded-[var(--radius-sm)] border border-border-strong bg-surface-raised px-3 py-2 text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:opacity-60" />
          </label>
          <label className="flex flex-col gap-1 text-[length:var(--font-size-small)] font-medium text-text-secondary">
            Description
            <textarea value={newDescription} maxLength={5000} rows={2} disabled={busy} onChange={(event) => setNewDescription(event.target.value)} className="min-h-20 rounded-[var(--radius-sm)] border border-border-strong bg-surface-raised px-3 py-2 text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:opacity-60" />
          </label>
          <button type="submit" disabled={busy || !newName.trim()} className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-sm)] bg-primary px-4 py-2 font-medium text-text-inverse hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:opacity-60">Add Area</button>
        </form>
        {areaError && <p role="alert" className="text-[length:var(--font-size-small)] text-destructive">{areaError}</p>}
        {activeAreas.length === 0 ? (
          <p className="text-text-secondary">No Areas yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {activeAreas.map((area, index) => (
              <li key={area.id}>
                <AreaEditor
                  area={area}
                  goals={goals}
                  projects={projects}
                  archived={false}
                  busy={busy}
                  onBusy={setBusy}
                  onError={setAreaError}
                  onSaved={() => setAreaError("")}
                  onMove={(direction) => void moveArea(area.id, direction)}
                  canMoveUp={index > 0}
                  canMoveDown={index < activeAreas.length - 1}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {archivedAreas.length > 0 && (
        <section aria-labelledby="archived-areas-heading" className="flex flex-col gap-4">
          <h2 id="archived-areas-heading" className="text-[length:var(--font-size-subheading)] font-semibold text-text-primary">Archived Areas</h2>
          <ul className="flex flex-col gap-3">
            {archivedAreas.map((area) => (
              <li key={area.id}>
                <AreaEditor
                  area={area}
                  goals={goals}
                  projects={projects}
                  archived
                  busy={busy}
                  onBusy={setBusy}
                  onError={setAreaError}
                  onSaved={() => setAreaError("")}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}