/**
 * Structured Goal Mode breakdown generation (Pattern C, Story 3.6).
 *
 * The AI returns STRUCTURED JSON (never markdown). This module owns:
 *   1. building the user message from the goal + the user's self-assessment
 *      (confirmed framework with ratings, drivers, barriers, if–then plan),
 *   2. calling the provider via `lib/ai`'s `generate()` (which owns provider
 *      selection + the 30s timeout),
 *   3. parsing + validating the JSON into a typed shape the route persists as
 *      structured `goals` + `projects` + `actions` rows.
 *
 * The user's ratings/drivers/barriers/if–then are sent as CONTEXT to tailor the
 * output but are NOT parsed back out of the model response — they are persisted
 * verbatim by the route from the wizard payload. No markdown is produced,
 * parsed, or stored anywhere.
 *
 * Mirrors `lib/projects/generate-project.ts` (parse + validate + format error).
 */

import { generate, GenerationFormatError, type GenerateOptions } from "@/lib/ai";
import { GOAL_GENERATE_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import type { SkillFrameworkItem } from "@/lib/supabase/schema";

/** Exactly-12 next actions is the GTD contract for each generated project. */
export const NEXT_ACTIONS_COUNT = 12;

/** Wizard minimum: fewer success criteria and the goal is not measurable. */
export const MIN_SUCCESS_CRITERIA = 3;

/** Inclusive range for the number of generated GTD projects. */
export const MIN_PROJECTS = 5;
export const MAX_PROJECTS = 6;

/** A single generated GTD project within the breakdown. */
export interface GeneratedGoalProject {
  name: string;
  purpose: string;
  successful_outcome: string;
  next_actions: string[];
}

/** The validated, structured result of a Goal Mode breakdown generation. */
export interface GeneratedGoal {
  goal_statement: string;
  success_criteria: string[];
  projects: GeneratedGoalProject[];
}

/**
 * The self-assessment inputs the wizard sends and the generator tailors to.
 * `framework` is the confirmed Target Profile with each `user_rating` inline
 * (the persisted `SkillFrameworkItem` shape).
 */
export interface GenerateGoalPayload {
  goal: string;
  why: string;
  framework: SkillFrameworkItem[];
  drivers: string[];
  barriers: string[];
  ifThen: string;
}

/**
 * Build the user message the model reasons over. The framework is rendered with
 * each attribute's required level, the user's current rating, and the computed
 * gap so the model can prioritise the largest gaps first. Drivers, barriers,
 * and the if–then plan are included verbatim as context.
 */
export function buildUserMessage(payload: GenerateGoalPayload): string {
  const { goal, why, framework, drivers, barriers, ifThen } = payload;

  const frameworkLines = framework
    .map((item) => {
      const gap = Math.max(0, item.required_level - item.user_rating);
      return `- ${item.name}: required ${item.required_level}, current ${item.user_rating}, gap ${gap}`;
    })
    .join("\n");

  const driverLines = drivers.map((d) => `- ${d}`).join("\n");
  const barrierLines = barriers.map((b) => `- ${b}`).join("\n");

  return [
    `My goal: ${goal}`,
      `Why this goal matters to me: ${why}`,
    "",
    "My skill framework (required level, my current level, and the gap):",
    frameworkLines,
    "",
    "My drivers (strengths already working for me):",
    driverLines,
    "",
    "My barriers (what gets in my way):",
    barrierLines,
    "",
    `My if–then plan: ${ifThen}`,
  ].join("\n");
}

/**
 * Generate a structured goal breakdown for the given self-assessment payload.
 *
 * @throws the underlying `generate()` errors (timeout / provider / config) and
 *         a `GenerationFormatError` when the model returns unparseable or
 *         shape-invalid JSON.
 */
export async function generateGoal(
  payload: GenerateGoalPayload,
  options?: GenerateOptions,
): Promise<GeneratedGoal> {
  const raw = await generate(
    GOAL_GENERATE_SYSTEM_PROMPT,
    buildUserMessage(payload),
    options,
  );
  const parsed = parseJson(raw);
  return validate(parsed);
}

/**
 * Parse the model's response into an object.
 *
 * Tolerant of a model that wraps the JSON in ```json code fences or adds
 * incidental leading/trailing prose: we extract the outermost `{...}` span and
 * parse that. Anything else is a format error.
 */
export function parseJson(raw: string): unknown {
  const trimmed = raw.trim();

  // Fast path: already pure JSON.
  try {
    return JSON.parse(trimmed);
  } catch {
    // Fall through to fenced/embedded extraction.
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      // fall through
    }
  }

  throw new GenerationFormatError(
    "The generator returned a response that was not valid JSON. Please try again."
  );
}

/** Coerce/validate a parsed object into a typed `GeneratedGoal`. */
export function validate(parsed: unknown): GeneratedGoal {
  if (typeof parsed !== "object" || parsed === null) {
    throw new GenerationFormatError("Generated content was not a JSON object.");
  }

  const obj = parsed as Record<string, unknown>;

  const goal_statement = requireString(obj.goal_statement, "goal_statement");

  const success_criteria = requireStringArray(
    obj.success_criteria,
    "success_criteria"
  );
  if (success_criteria.length < MIN_SUCCESS_CRITERIA) {
    throw new GenerationFormatError(
      `Expected at least ${MIN_SUCCESS_CRITERIA} success criteria but got ${success_criteria.length}.`
    );
  }

  if (!Array.isArray(obj.projects)) {
    throw new GenerationFormatError(
      'Generated content was missing the "projects" list.'
    );
  }
  const rawProjects = obj.projects;
  if (rawProjects.length < MIN_PROJECTS || rawProjects.length > MAX_PROJECTS) {
    throw new GenerationFormatError(
      `Expected ${MIN_PROJECTS}–${MAX_PROJECTS} projects but got ${rawProjects.length}.`
    );
  }

  const projects = rawProjects.map((project, index) =>
    validateProject(project, index)
  );

  return { goal_statement, success_criteria, projects };
}

/** Validate a single project into a typed `GeneratedGoalProject`. */
function validateProject(
  project: unknown,
  index: number
): GeneratedGoalProject {
  if (typeof project !== "object" || project === null) {
    throw new GenerationFormatError(
      `Project at position ${index + 1} was not an object.`
    );
  }

  const obj = project as Record<string, unknown>;

  const name = requireString(obj.name, `projects[${index}].name`);
  const purpose = requireString(obj.purpose, `projects[${index}].purpose`);
  const successful_outcome = requireString(
    obj.successful_outcome,
    `projects[${index}].successful_outcome`
  );
  const next_actions = requireStringArray(
    obj.next_actions,
    `projects[${index}].next_actions`
  );

  if (next_actions.length !== NEXT_ACTIONS_COUNT) {
    throw new GenerationFormatError(
      `Expected exactly ${NEXT_ACTIONS_COUNT} next actions for project ${index + 1} but got ${next_actions.length}.`
    );
  }

  return { name, purpose, successful_outcome, next_actions };
}

function requireString(value: unknown, field: string): string {
  if (typeof value === "string" && value.trim() !== "") {
    return value.trim();
  }
  throw new GenerationFormatError(
    `Generated content was missing the "${field}" field.`
  );
}

function requireStringArray(value: unknown, field: string): string[] {
  if (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((v) => typeof v === "string" && v.trim() !== "")
  ) {
    return value.map((v) => (v as string).trim());
  }
  throw new GenerationFormatError(
    `Generated content had an invalid or empty "${field}" list.`
  );
}
