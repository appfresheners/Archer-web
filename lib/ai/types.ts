/**
 * Shared types for the provider-agnostic AI configuration layer.
 *
 * Provider selection, model, and API keys are driven entirely by environment
 * variables (see lib/ai/config.ts). No provider details, models, or keys are
 * hardcoded in code.
 */

/** Supported AI providers. Resolved from the `AI_PROVIDER` env var. */
export type AiProvider = "gemini" | "groq" | "openai";

/**
 * Fully resolved configuration for the active provider.
 *
 * `apiKey` is a secret and must never be logged. Log `id` and `model` only.
 */
export interface ProviderConfig {
    /** The active provider id. */
    id: AiProvider;
    /** Model name resolved from the provider's model env var (no fallback). */
    model: string;
    /** API key resolved from the provider's key env var (env-only, never logged). */
    apiKey: string;
    /** Fully-formed provider endpoint URL for the resolved model. */
    endpoint: string;
}

/**
 * The single generation entry point.
 *
 * Dispatches to the active provider using the resolved config and returns the
 * generated text. Throws an actionable error on misconfiguration, provider HTTP
 * failure, or timeout.
 */
export type GenerateFn = (
    systemPrompt: string,
    userMessage: string
) => Promise<string>;
