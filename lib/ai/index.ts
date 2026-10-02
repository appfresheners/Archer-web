/**
 * Public surface of the provider-agnostic AI configuration layer.
 *
 * Consumers (e.g. Epic 2's `/api/generate` rework) import from `lib/ai`:
 *   import { generate, getProviderConfig, type AiProvider } from "@/lib/ai";
 */

export { getProviderConfig, resolveProvider, resolveModel, resolveApiKey } from "./config";
export { generate } from "./generate";
export { GenerationFormatError } from "./errors";
export type { AiProvider, ProviderConfig, GenerateFn, GenerateOptions } from "./types";
