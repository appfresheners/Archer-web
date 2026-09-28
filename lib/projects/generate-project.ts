/**
 * Structured Project Mode generation.
 *
 * The AI returns STRUCTURED JSON (never markdown). This module owns:
 *   1. selecting the depth-aware system prompt,
 *   2. calling the provider via `lib/ai`'s `generate()` (which owns provider
 *      selection + the 30s timeout),
 *   3. parsing + validating the JSON into a typed shape the route persists as
 *      structured Supabase rows.
 *
 * No markdown is produced, parsed, or stored anywhere.
 */

import { generate } from "@/lib/ai";
import {
  PROJECT_FULL_GTD_SYSTEM_PROMPT,
  PROJECT_MINIMAL_SYSTEM_PROMPT,
} from "@/lib/ai/prompts";
import type { PlanningDepth, PlanningDetail } from "@/lib/supabase/schema";

/** Exactly-12 next actions is the GTD contract for a project breakdown. */
export const NEXT_ACTIONS_COUNT = 12;

/**
 * The validated, structured result of a Project Mode generation.
 *
 * `detail` carries the Full-GTD Natural Planning extras and is `null` for
 * minimal depth (mirrors `projects.planning_detail`).
 */
export interface GeneratedProject {
  name: string;
  purpose: string;
  successful_outcome: string;
  next_actions: string[];
  detail: PlanningDetail | null;
}

class GenerationFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerationFormatError";
  }
}

/**
 * Generate a structured project breakdown for the given input + depth.
 *
 * @throws the underlying `generate()` errors (timeout / provider / config) and
 *         a `GenerationFormatError` when the model returns unparseable or
 *         shape-invalid JSON.
 */
export async function generateProject(
  input: string,
  depth: PlanningDepth
): Promise<GeneratedProject> {
  const systemPrompt =
    depth === "full_gtd"
      ? PROJECT_FULL_GTD_SYSTEM_PROMPT
      : PROJECT_MINIMAL_SYSTEM_PROMPT;

  const raw = await generate(systemPrompt, `My project: ${input}`);
  const parsed = parseJson(raw);
  return validate(parsed, depth);
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

/** Coerce/validate a parsed object into a typed `GeneratedProject`. */
export function validate(
  parsed: unknown,
  depth: PlanningDepth
): GeneratedProject {
  if (typeof parsed !== "object" || parsed === null) {
    throw new GenerationFormatError("Generated content was not a JSON object.");
  }

  const obj = parsed as Record<string, unknown>;

  const name = requireString(obj.name, "name");
  const purpose = requireString(obj.purpose, "purpose");
  const successful_outcome = requireString(
    obj.successful_outcome,
    "successful_outcome"
  );
  const next_actions = requireStringArray(obj.next_actions, "next_actions");

  if (next_actions.length !== NEXT_ACTIONS_COUNT) {
    throw new GenerationFormatError(
      `Expected exactly ${NEXT_ACTIONS_COUNT} next actions but got ${next_actions.length}.`
    );
  }

  let detail: PlanningDetail | null = null;
  if (depth === "full_gtd") {
    detail = {
      principles: requireStringArray(obj.principles, "principles"),
      vision: requireString(obj.vision, "vision"),
      ideas: requireStringArray(obj.ideas, "ideas"),
      organizing: requireStringArray(obj.organizing, "organizing"),
    };
  }

  return { name, purpose, successful_outcome, next_actions, detail };
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
