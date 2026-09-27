/**
 * Single generation entry point for the AI provider layer.
 *
 * `generate(systemPrompt, userMessage)` resolves the active provider config and
 * dispatches to the provider-specific fetch call with a shared 30s
 * AbortController timeout. Provider HTTP errors are mapped to clear, actionable
 * messages. Secrets are never logged.
 *
 * Provider request shapes mirror the proven MVP1 route (Gemini
 * `x-goog-api-key` + `system_instruction`/`contents`; OpenAI/Groq bearer +
 * chat/completions `messages`) but model/key/provider are driven entirely by
 * lib/ai/config.ts with no fallbacks.
 */

import { getProviderConfig } from "./config";
import type { AiProvider, ProviderConfig } from "./types";

const REQUEST_TIMEOUT_MS = 30_000;
const TEMPERATURE = 0.7;
const MAX_TOKENS = 8192;

/** Human-readable provider labels for error messages. */
const PROVIDER_LABEL: Record<AiProvider, string> = {
    gemini: "Gemini",
    groq: "Groq",
    openai: "OpenAI",
};

/**
 * Dispatch a generation request to the active provider.
 *
 * @param systemPrompt - The system instruction driving the generation.
 * @param userMessage - The user's message/input.
 * @returns The generated text.
 * @throws On misconfiguration, provider HTTP failure, or a >30s timeout.
 */
export async function generate(
    systemPrompt: string,
    userMessage: string
): Promise<string> {
    const config = getProviderConfig();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        return await dispatch(config, systemPrompt, userMessage, controller.signal);
    } catch (error) {
        // Detect the abort by name across runtimes — the abort may be a
        // DOMException (browser/undici) or a plain Error named "AbortError",
        // and DOMException is not an `instanceof Error` in every runtime.
        if (
            typeof error === "object" &&
            error !== null &&
            "name" in error &&
            (error as { name?: unknown }).name === "AbortError"
        ) {
            throw new Error(
                `${PROVIDER_LABEL[config.id]} request timed out after ${REQUEST_TIMEOUT_MS / 1000
                }s. Please try again.`
            );
        }
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

/** Route the request to the correct provider-specific builder. */
function dispatch(
    config: ProviderConfig,
    systemPrompt: string,
    userMessage: string,
    signal: AbortSignal
): Promise<string> {
    switch (config.id) {
        case "gemini":
            return generateWithGemini(config, systemPrompt, userMessage, signal);
        case "groq":
        case "openai":
            return generateWithOpenAiCompatible(
                config,
                systemPrompt,
                userMessage,
                signal
            );
        default: {
            // Exhaustive today; guards against a future provider being added to
            // the union without a dispatch branch (would otherwise return undefined).
            const unreachable: never = config.id;
            throw new Error(`Unsupported AI provider: ${String(unreachable)}`);
        }
    }
}

/** Gemini: `x-goog-api-key` header + `system_instruction`/`contents` body. */
async function generateWithGemini(
    config: ProviderConfig,
    systemPrompt: string,
    userMessage: string,
    signal: AbortSignal
): Promise<string> {
    const response = await fetch(config.endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": config.apiKey,
        },
        body: JSON.stringify({
            system_instruction: {
                parts: [{ text: systemPrompt }],
            },
            contents: [
                {
                    parts: [{ text: userMessage }],
                },
            ],
            generationConfig: {
                temperature: TEMPERATURE,
                maxOutputTokens: MAX_TOKENS,
            },
        }),
        signal,
    });

    await assertOk(response, config.id);

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return assertText(text, config.id);
}

/** OpenAI/Groq: bearer token + chat/completions `messages` body. */
async function generateWithOpenAiCompatible(
    config: ProviderConfig,
    systemPrompt: string,
    userMessage: string,
    signal: AbortSignal
): Promise<string> {
    const response = await fetch(config.endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
            model: config.model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage },
            ],
            temperature: TEMPERATURE,
            max_tokens: MAX_TOKENS,
        }),
        signal,
    });

    await assertOk(response, config.id);

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    return assertText(text, config.id);
}

/**
 * Guard against an empty-but-OK response (e.g. a safety-blocked or filtered
 * generation returns 200 with no text). Surface it as a clear error rather
 * than silently returning "" as if generation succeeded.
 */
function assertText(text: unknown, provider: AiProvider): string {
    if (typeof text === "string" && text.trim() !== "") {
        return text;
    }
    throw new Error(
        `${PROVIDER_LABEL[provider]} returned no content (the response may have been blocked or filtered). Please try again.`
    );
}

/**
 * Map a non-OK provider response to a clear, actionable error.
 *
 * The provider's raw error payload is logged (never the API key), and a
 * user-facing message is thrown.
 */
async function assertOk(response: Response, provider: AiProvider): Promise<void> {
    if (response.ok) {
        return;
    }

    const errorData = await response.json().catch(() => ({}));
    console.error(`[ai/generate] ${provider} API error:`, errorData);

    throw new Error(
        `${PROVIDER_LABEL[provider]} request failed (HTTP ${response.status}). Check your API key, model, and account/billing status.`
    );
}
