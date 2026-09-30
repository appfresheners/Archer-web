/**
 * Structured Goal Mode framework generation (Pattern B, Story 3.2).
 *
 * The AI returns STRUCTURED JSON (never markdown). This module owns:
 *   1. selecting the framework system prompt,
 *   2. calling the provider via `lib/ai`'s `generate()` (which owns provider
 *      selection + the 30s timeout),
 *   3. parsing + validating the JSON into a typed shape the route returns to
 *      the client (NO database write — the wizard holds it in transient state).
 *
 * The AI supplies only the Target Profile — each item's `name`,
 * `required_level` (the level the ideal achiever needs, 1–10), and a
 * goal-specific `description`. It NEVER supplies the user's current rating;
 * `user_rating` is user-owned data collected later (Story 3.4). The validated
 * shape here is `SkillFrameworkItem` minus `user_rating`, so Patterns C/Step 2
 * add `user_rating` without renaming.
 *
 * Mirrors `lib/projects/generate-project.ts` (parse + validate + format error).
 */

import { generate } from "@/lib/ai";
import { GOAL_FRAMEWORK_SYSTEM_PROMPT } from "@/lib/ai/prompts";

/** Wizard minimum: fewer than this and the gap analysis is not meaningful. */
export const MIN_FRAMEWORK_ITEMS = 3;

/** Sane upper bound to reject a runaway/malformed response. */
export const MAX_FRAMEWORK_ITEMS = 12;

/** Inclusive range for a Target Profile required level. */
export const MIN_REQUIRED_LEVEL = 1;
export const MAX_REQUIRED_LEVEL = 10;

/**
 * A single Target Profile item as proposed by the AI.
 *
 * Aligns with `SkillFrameworkItem` (lib/supabase/schema.ts) minus `user_rating`
 * — the user's self-assessment is added downstream (Story 3.4 / Pattern C).
 */
export interface FrameworkItem {
  name: string;
  required_level: number;
  description: string;
}

/** The validated, structured result of a framework generation. */
export interface GeneratedFramework {
  framework: FrameworkItem[];
}

class GenerationFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerationFormatError";
  }
}

/**
 * Generate a structured skill framework (Target Profile) for the given goal.
 *
 * @throws the underlying `generate()` errors (timeout / provider / config) and
 *         a `GenerationFormatError` when the model returns unparseable or
 *         shape-invalid JSON.
 */
export async function generateFramework(
  goal: string,
  why: string,
): Promise<GeneratedFramework> {
  const raw = await generate(
    GOAL_FRAMEWORK_SYSTEM_PROMPT,
    `My goal: ${goal}\n\nWhy this goal matters to me: ${why}`,
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

/** Coerce/validate a parsed object into a typed `GeneratedFramework`. */
export function validate(parsed: unknown): GeneratedFramework {
  if (typeof parsed !== "object" || parsed === null) {
    throw new GenerationFormatError("Generated content was not a JSON object.");
  }

  const obj = parsed as Record<string, unknown>;

  if (!Array.isArray(obj.framework)) {
    throw new GenerationFormatError(
      'Generated content was missing the "framework" list.'
    );
  }

  const items = obj.framework;

  if (items.length < MIN_FRAMEWORK_ITEMS) {
    throw new GenerationFormatError(
      `Expected at least ${MIN_FRAMEWORK_ITEMS} framework items but got ${items.length}.`
    );
  }

  if (items.length > MAX_FRAMEWORK_ITEMS) {
    throw new GenerationFormatError(
      `Expected at most ${MAX_FRAMEWORK_ITEMS} framework items but got ${items.length}.`
    );
  }

  const framework = items.map((item, index) => validateItem(item, index));

  return { framework };
}

/** Validate a single framework item into a typed `FrameworkItem`. */
function validateItem(item: unknown, index: number): FrameworkItem {
  if (typeof item !== "object" || item === null) {
    throw new GenerationFormatError(
      `Framework item at position ${index + 1} was not an object.`
    );
  }

  const obj = item as Record<string, unknown>;

  const name = requireString(obj.name, `framework[${index}].name`);
  const description = requireString(
    obj.description,
    `framework[${index}].description`
  );
  const required_level = requireLevel(
    obj.required_level,
    `framework[${index}].required_level`
  );

  return { name, required_level, description };
}

function requireString(value: unknown, field: string): string {
  if (typeof value === "string" && value.trim() !== "") {
    return value.trim();
  }
  throw new GenerationFormatError(
    `Generated content was missing the "${field}" field.`
  );
}

function requireLevel(value: unknown, field: string): number {
  if (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_REQUIRED_LEVEL &&
    value <= MAX_REQUIRED_LEVEL
  ) {
    return value;
  }
  throw new GenerationFormatError(
    `Generated content had an invalid "${field}" (expected an integer ${MIN_REQUIRED_LEVEL}–${MAX_REQUIRED_LEVEL}).`
  );
}
