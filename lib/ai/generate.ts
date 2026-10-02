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
import type { AiProvider, GenerateOptions, ProviderConfig } from "./types";

const REQUEST_TIMEOUT_MS = 30_000;
const TEMPERATURE = 0.7;
const MAX_TOKENS = 8192;

/** Retries are limited to 429/5xx, at most two additional attempts. */
const MAX_RETRIES = 2;
/** Base of the exponential backoff (full jitter is applied on top of it). */
const BASE_BACKOFF_MS = 500;
/** Upper bound for a single backoff delay, so retries fit the 30s budget. */
const MAX_BACKOFF_MS = 10_000;
/** Longest scrubbed provider detail we are willing to log. */
const MAX_DETAIL_LENGTH = 200;

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
 * @param options - Optional `signal` from the caller (e.g. the incoming HTTP
 *   request). Aborting it cancels the upstream provider fetch.
 * @returns The generated text.
 * @throws On misconfiguration, provider HTTP failure, or a >30s timeout.
 */
export async function generate(
    systemPrompt: string,
    userMessage: string,
    options: GenerateOptions = {}
): Promise<string> {
    const config = getProviderConfig();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    // A caller-supplied signal (client disconnect) cancels the upstream call.
    const onExternalAbort = () => controller.abort();
    if (options.signal?.aborted) {
        controller.abort();
    } else {
        options.signal?.addEventListener("abort", onExternalAbort, { once: true });
    }

    try {
        return await dispatch(config, systemPrompt, userMessage, controller.signal);
    } catch (error) {
        // Detect the abort by name across runtimes — the abort may be a
        // DOMException (browser/undici) or a plain Error named "AbortError",
        // and DOMException is not an `instanceof Error` in every runtime.
        if (isAbortError(error)) {
            throw new Error(
                `${PROVIDER_LABEL[config.id]} request timed out after ${REQUEST_TIMEOUT_MS / 1000
                }s. Please try again.`
            );
        }
        throw error;
    } finally {
        clearTimeout(timeout);
        options.signal?.removeEventListener("abort", onExternalAbort);
    }
}

/** Route the request to the correct provider-specific builder. */
function callProvider(
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

/**
 * Dispatch with retry/backoff. Only 429 and 5xx are retried (client errors are
 * never transient); at most {@link MAX_RETRIES} additional attempts, with
 * exponential backoff + full jitter, honoring `Retry-After` when present. The
 * shared AbortSignal bounds the whole loop to the 30s timeout budget.
 */
async function dispatch(
    config: ProviderConfig,
    systemPrompt: string,
    userMessage: string,
    signal: AbortSignal
): Promise<string> {
    let attempt = 0;
    while (true) {
        try {
            return await callProvider(config, systemPrompt, userMessage, signal);
        } catch (error) {
            if (
                !(error instanceof ProviderHttpError) ||
                (error.status !== 429 && error.status < 500) ||
                attempt >= MAX_RETRIES
            ) {
                throw error;
            }
            await sleep(computeBackoff(attempt, error.retryAfterSeconds), signal);
            attempt += 1;
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
 * A provider HTTP failure with enough metadata to drive retry decisions.
 * Internal to this module — the message is the user-safe (key-free) text.
 */
class ProviderHttpError extends Error {
    readonly status: number;
    readonly retryAfterSeconds: number | null;

    constructor(
        provider: AiProvider,
        status: number,
        retryAfterSeconds: number | null
    ) {
        super(providerErrorMessage(provider, status));
        this.name = "ProviderHttpError";
        this.status = status;
        this.retryAfterSeconds = retryAfterSeconds;
    }
}

/** A status-appropriate, user-safe (key-free) provider error message. */
function providerErrorMessage(provider: AiProvider, status: number): string {
    if (status === 429) {
        return `${PROVIDER_LABEL[provider]} is rate-limiting requests (HTTP 429). Please wait a moment and try again.`;
    }
    if (status >= 500) {
        return `${PROVIDER_LABEL[provider]} is experiencing a temporary problem (HTTP ${status}). Please try again.`;
    }
    return `${PROVIDER_LABEL[provider]} request failed (HTTP ${status}). Check your API key, model, and account/billing status.`;
}

/**
 * Map a non-OK provider response to a clear, actionable error.
 *
 * The body is read as TEXT (never assumed to be JSON), a short scrubbed
 * diagnostic is extracted, and only `provider + status + short message` is
 * logged. No key, prompt, or full response body is ever logged.
 */
async function assertOk(response: Response, provider: AiProvider): Promise<void> {
    if (response.ok) {
        return;
    }

    const bodyText = await response.text();
    const detail = extractProviderDetail(bodyText);

    console.error(
        `[ai/generate] ${provider} API error (HTTP ${response.status})` +
            (detail ? `: ${detail}` : "")
    );

    throw new ProviderHttpError(
        provider,
        response.status,
        parseRetryAfterSeconds(response.headers.get("retry-after"))
    );
}

/** True when an error is an abort (DOMException or plain Error named AbortError). */
function isAbortError(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        (error as { name?: unknown }).name === "AbortError"
    );
}

/** A plain cross-runtime abort error used when a backoff sleep is interrupted. */
function makeAbortError(): Error {
    const error = new Error("Aborted");
    error.name = "AbortError";
    return error;
}

/** Extract a short, scrubbed provider message from an error body. */
function extractProviderDetail(bodyText: string): string {
    const trimmed = bodyText.trim();
    if (trimmed === "") {
        return "";
    }

    try {
        const parsed = JSON.parse(trimmed) as { error?: unknown };
        const errorField = parsed.error;
        if (typeof errorField === "object" && errorField !== null) {
            const message = (errorField as { message?: unknown }).message;
            if (typeof message === "string" && message.trim() !== "") {
                return truncateDetail(message);
            }
        }
        if (typeof errorField === "string" && errorField.trim() !== "") {
            return truncateDetail(errorField);
        }
    } catch {
        // Not JSON — fall through to the raw text below.
    }

    return truncateDetail(trimmed);
}

/** Collapse whitespace + truncate so a log line stays short and single-line. */
function truncateDetail(detail: string): string {
    const cleaned = detail.split("\n", 1)[0].replace(/\s+/g, " ").trim();
    return cleaned.length > MAX_DETAIL_LENGTH
        ? `${cleaned.slice(0, MAX_DETAIL_LENGTH)}…`
        : cleaned;
}

/** Parse `Retry-After` (delta-seconds or HTTP-date) into seconds, or null. */
function parseRetryAfterSeconds(value: string | null): number | null {
    if (!value) {
        return null;
    }
    const trimmed = value.trim();
    if (trimmed === "") {
        return null;
    }
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
        return Math.max(0, numeric);
    }
    const date = Date.parse(trimmed);
    if (Number.isFinite(date)) {
        return Math.max(0, Math.ceil((date - Date.now()) / 1000));
    }
    return null;
}

/**
 * Compute the delay before the next retry: honor `Retry-After` when present
 * (capped to the timeout budget), otherwise exponential backoff with full
 * jitter (`random(0, base * 2^attempt)`).
 */
function computeBackoff(attempt: number, retryAfterSeconds: number | null): number {
    if (retryAfterSeconds !== null && Number.isFinite(retryAfterSeconds)) {
        return Math.min(retryAfterSeconds * 1000, MAX_BACKOFF_MS);
    }
    return Math.floor(Math.random() * (BASE_BACKOFF_MS * 2 ** attempt));
}

/** Abortable sleep: rejects when the signal aborts so retries respect the budget. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal.aborted) {
            reject(makeAbortError());
            return;
        }
        const onAbort = () => {
            clearTimeout(timer);
            reject(makeAbortError());
        };
        const timer = setTimeout(() => {
            signal.removeEventListener("abort", onAbort);
            resolve();
        }, ms);
        signal.addEventListener("abort", onAbort, { once: true });
    });
}
