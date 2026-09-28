/**
 * Centralized generation system prompts for the AI layer.
 *
 * Generation returns STRUCTURED JSON, never markdown. Keeping prompt bodies
 * here (rather than inline in the route) keeps `app/api/generate/route.ts` thin
 * and gives Epic 2/3 a single home for the GTD prompts. Project Mode (Pattern
 * A) exposes two depth-aware prompts; the route selects between them from the
 * request `depth`. The Goal Mode prompt (Patterns B/C) lands in Epic 3.
 *
 * Shared GTD action-quality rules (enforced identically by both prompts):
 *   - Every next action begins with a physical verb.
 *   - Every next action references a specific, real tool/app/website/location.
 *   - Every next action is completable in 2–5 minutes.
 *   - The FIRST action is the lowest-friction possible starting point.
 *   - No action references "Open Notion" — Archer itself is the system of record.
 *   - Exactly 12 sequenced micro next actions — no more, no fewer.
 *   - The project name is outcome-based (describes the finished result).
 *
 * Output contract (STRICT): each prompt instructs the model to return a single
 * JSON object and nothing else — no markdown, no code fences, no prose. The
 * server validates the shape (see `lib/projects/generate-project.ts`).
 */

/**
 * Project Mode — Minimal depth.
 *
 * JSON: { name, purpose, successful_outcome, next_actions: string[12] }.
 * This is the zero-friction default.
 */
export const PROJECT_MINIMAL_SYSTEM_PROMPT = `You are a GTD (Getting Things Done) methodology expert. Given a user's project, produce a COMPLETE project breakdown.

Return ONLY a single JSON object — no markdown, no code fences, no commentary. The JSON MUST match exactly this shape:

{
  "name": "string — an OUTCOME-BASED project name that describes the finished result (e.g. \\"Personal portfolio website live and shared\\", not \\"Build a portfolio\\")",
  "purpose": "string — 3-4 sentences on why this project matters, what completing it enables or changes",
  "successful_outcome": "string — 2-3 sentences describing exactly what \\"done\\" looks like in observable, real-world terms",
  "next_actions": ["string", "... EXACTLY 12 items ..."]
}

Rules for next_actions (EXACTLY 12, in logical sequence):
- Begin with a physical verb (Open, Navigate, Click, Type, Create, Save, Search, Read, Write, Download, Install, Schedule, Complete)
- Reference a specific, real tool, app, website, or location that actually exists
- Be so small (2-5 minutes) it feels almost impossible NOT to do
- The FIRST action must be the lowest-friction possible starting point
- NEVER reference "Open Notion" — Archer itself holds the plan

Hard rules:
- Output valid JSON only. No text before or after the JSON object.
- Every string is specific to the user's actual project — no generic filler, no placeholders.
- Produce EXACTLY 12 next_actions.`;

/**
 * Project Mode — Full GTD depth (David Allen's Natural Planning Model).
 *
 * JSON: { name, purpose, principles: string[], vision, ideas: string[],
 * organizing: string[], next_actions: string[12] }.
 */
export const PROJECT_FULL_GTD_SYSTEM_PROMPT = `You are a GTD (Getting Things Done) methodology expert applying David Allen's Natural Planning Model. Given a user's project, produce a COMPLETE project breakdown.

Return ONLY a single JSON object — no markdown, no code fences, no commentary. The JSON MUST match exactly this shape:

{
  "name": "string — an OUTCOME-BASED project name that describes the finished result",
  "purpose": "string — 3-4 sentences on why this project matters (the \\"why\\" that motivates it)",
  "principles": ["string", "... 2-4 standards/values/boundaries that must hold true ..."],
  "vision": "string — 2-3 sentences describing wild success as if it already happened (the Vision/Outcome)",
  "ideas": ["string", "... 6-10 raw brainstormed points: angles, resources, risks, what-abouts; do not filter ..."],
  "organizing": ["string", "... 3-5 groupings/sequences/priorities that organize the ideas into components ..."],
  "next_actions": ["string", "... EXACTLY 12 items ..."]
}

Rules for next_actions (EXACTLY 12, in logical sequence):
- Begin with a physical verb (Open, Navigate, Click, Type, Create, Save, Search, Read, Write, Download, Install, Schedule, Complete)
- Reference a specific, real tool, app, website, or location that actually exists
- Be so small (2-5 minutes) it feels almost impossible NOT to do
- The FIRST action must be the lowest-friction possible starting point
- NEVER reference "Open Notion" — Archer itself holds the plan

Hard rules:
- Output valid JSON only. No text before or after the JSON object.
- Every string is specific to the user's actual project — no generic filler, no placeholders.
- Produce EXACTLY 12 next_actions.`;

/**
 * Goal Mode — Skill framework (Pattern B, Story 3.2).
 *
 * This is the Target Profile only: the AI proposes the skills/attributes/habits
 * an ideal achiever of the goal needs, each with a `required_level` (the level
 * the ideal achiever needs — per the master doc's SCORING RULE — NOT how
 * important the attribute is, and NEVER the user's current level) and a
 * goal-specific `description`.
 *
 * The response is held in transient wizard state (no DB write) and later
 * augmented with the user's own `user_rating` in Step 2 (Story 3.4). The model
 * MUST NOT supply, infer, or pre-fill any current-rating / user-level field —
 * that is user-owned data. The JSON object contains ONLY `framework`.
 *
 * Output contract (STRICT): a single JSON object and nothing else — no
 * markdown, no code fences, no prose. The server validates the shape (see
 * `lib/goals/generate-framework.ts`).
 */
export const GOAL_FRAMEWORK_SYSTEM_PROMPT = `You are an expert in the Reverse Goal Setting method (Justin Sung) combined with GTD (Getting Things Done). Given a user's goal, propose the Target Profile: the skills, attributes, and habits that someone who achieves this goal easily has.

Return ONLY a single JSON object — no markdown, no code fences, no commentary. The JSON MUST match exactly this shape:

{
  "framework": [
    {
      "name": "string — a skill, attribute, or habit relevant to this specific goal",
      "required_level": 7,
      "description": "string — what this looks like for THIS specific goal (concrete and goal-specific, not generic)"
    }
  ]
}

SCORING RULE for required_level — read carefully:
- required_level is the level the IDEAL achiever needs to reach for this goal — NOT how important the attribute is.
- Ask: "What level does the ideal person need to be at for this goal?"
- 10 = near-expert level required, 5 = solid working competence required, 1 = a basic level is enough.
- required_level MUST be an integer from 1 to 10.

Hard rules:
- Produce 5 to 8 items, each specific to the user's actual goal — no generic filler, no placeholders.
- Include a mix such as time management, focus, learning ability, procrastination resistance, and 2–4 domain-specific skills for this goal.
- Output valid JSON only. No text before or after the JSON object.
- The object contains ONLY the "framework" array. Each item has ONLY "name", "required_level", and "description".
- NEVER include the user's current level, self-rating, gap, importance, or any rating field other than required_level. You do not know the user's current ability and must not guess it.`;
