export const MAX_FOCUS_TEXT = 10000;
export const MAX_PRINCIPLES = 50;
export const MAX_PRINCIPLE_LENGTH = 500;
export const MAX_AREA_NAME = 200;
export const MAX_AREA_DESCRIPTION = 5000;

export interface FocusProfileInput {
  vision: string | null;
  purpose: string | null;
  principles: string[];
}

export interface AreaInput {
  name: string;
  description: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalText(value: unknown, maxLength: number): string | null | undefined {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if (text.length > maxLength) return undefined;
  return text || null;
}

export function sanitizeFocusProfile(body: unknown): FocusProfileInput | null {
  if (!isRecord(body)) return null;

  const vision = optionalText(body.vision, MAX_FOCUS_TEXT);
  const purpose = optionalText(body.purpose, MAX_FOCUS_TEXT);
  if (vision === undefined || purpose === undefined) return null;

  const rawPrinciples = body.principles ?? [];
  if (!Array.isArray(rawPrinciples) || rawPrinciples.length > MAX_PRINCIPLES) {
    return null;
  }
  const principles: string[] = [];
  for (const value of rawPrinciples) {
    if (typeof value !== "string") return null;
    const principle = value.trim();
    if (principle.length > MAX_PRINCIPLE_LENGTH) return null;
    if (principle) principles.push(principle);
  }

  return { vision, purpose, principles };
}

export function sanitizeAreaInput(body: unknown): AreaInput | null {
  if (!isRecord(body) || typeof body.name !== "string") return null;
  const name = body.name.trim();
  if (!name || name.length > MAX_AREA_NAME) return null;

  const description = optionalText(body.description, MAX_AREA_DESCRIPTION);
  if (description === undefined) return null;

  return { name, description };
}