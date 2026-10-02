/**
 * Env-driven configuration contract for the AI provider layer.
 *
 * Every value (provider, model, key) comes from environment variables. There
 * are NO hardcoded model fallbacks: a missing model var fails loud, naming the
 * variable. Documented defaults live only in `.env.example`, never in code.
 * Secrets are never logged — only the provider id and model name are safe.
 */

import type { AiProvider, ProviderConfig } from "./types";

const VALID_PROVIDERS: readonly AiProvider[] = ["gemini", "groq", "openai"];

/** Recognized `AI_LOG_LEVEL` values (default `warn`). */
const LOG_LEVELS = ["debug", "info", "warn", "error", "silent"] as const;
type LogLevel = (typeof LOG_LEVELS)[number];

/**
 * Minimal env-gated log level. `AI_LOG_LEVEL` defaults to `warn`, so the
 * per-call `console.info` in `getProviderConfig` is silent unless the caller
 * opts into `info`/`debug`. No logging framework — one small helper only.
 */
function resolveLogLevel(): LogLevel {
    const raw = process.env.AI_LOG_LEVEL?.trim().toLowerCase();
    if (raw && (LOG_LEVELS as readonly string[]).includes(raw)) {
        return raw as LogLevel;
    }
    return "warn";
}

/** True when informational logs are enabled (AI_LOG_LEVEL=info|debug). */
function shouldLogInfo(): boolean {
    const level = resolveLogLevel();
    return level === "info" || level === "debug";
}

/** Per-provider env var names and endpoint builders. No models or keys inline. */
const PROVIDER_ENV: Record<
    AiProvider,
    {
        modelVar: string;
        keyVar: string;
        keyIssuanceUrl: string;
        endpoint: (model: string) => string;
    }
> = {
    gemini: {
        modelVar: "GEMINI_MODEL",
        keyVar: "GEMINI_API_KEY",
        keyIssuanceUrl: "https://aistudio.google.com/apikey",
        endpoint: (model) =>
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    },
    groq: {
        modelVar: "GROQ_MODEL",
        keyVar: "GROQ_API_KEY",
        keyIssuanceUrl: "https://console.groq.com",
        endpoint: () => "https://api.groq.com/openai/v1/chat/completions",
    },
    openai: {
        modelVar: "OPENAI_MODEL",
        keyVar: "OPENAI_API_KEY",
        keyIssuanceUrl: "https://platform.openai.com/api-keys",
        endpoint: () => "https://api.openai.com/v1/chat/completions",
    },
};

/**
 * Resolve the active provider from `AI_PROVIDER`.
 *
 * - Unset/empty → defaults to `gemini`.
 * - Value is lowercased and must be one of `gemini | groq | openai`.
 * - An invalid non-empty value throws a clear error naming the value.
 */
export function resolveProvider(): AiProvider {
    const raw = process.env.AI_PROVIDER?.trim().toLowerCase();

    if (!raw) {
        return "gemini";
    }

    if ((VALID_PROVIDERS as readonly string[]).includes(raw)) {
        return raw as AiProvider;
    }

    throw new Error(
        `Invalid AI_PROVIDER "${process.env.AI_PROVIDER}". Set AI_PROVIDER to one of: ${VALID_PROVIDERS.join(
            ", "
        )} (or leave it unset to default to gemini).`
    );
}

/**
 * Resolve the model for the given provider from its model env var.
 *
 * There is NO hardcoded fallback: a missing/empty var throws a clear, logged
 * error naming the variable. Documented defaults live only in `.env.example`.
 */
export function resolveModel(provider: AiProvider): string {
    const { modelVar } = PROVIDER_ENV[provider];
    const model = process.env[modelVar]?.trim();

    if (!model) {
        const message = `${modelVar} is not set. Set ${modelVar} in your environment (see .env.example for the documented default). No model fallback is applied.`;
        console.error(`[ai/config] ${message}`);
        throw new Error(message);
    }

    return model;
}

/**
 * Resolve the API key for the given provider from its key env var.
 *
 * A missing/empty key throws a clear, actionable error including key-issuance
 * guidance. Keys are read only from env — never from request input — and the
 * value is never logged.
 */
export function resolveApiKey(provider: AiProvider): string {
    const { keyVar, keyIssuanceUrl } = PROVIDER_ENV[provider];
    const apiKey = process.env[keyVar]?.trim();

    if (!apiKey) {
        const message = `${keyVar} is not configured. Get a key at ${keyIssuanceUrl} and add ${keyVar} to your environment (.env).`;
        console.error(`[ai/config] ${message}`);
        throw new Error(message);
    }

    return apiKey;
}

/**
 * Compose the fully resolved provider configuration.
 *
 * Logs only the safe fields (provider id + model name), never the key.
 */
export function getProviderConfig(): ProviderConfig {
    const id = resolveProvider();
    const model = resolveModel(id);
    const apiKey = resolveApiKey(id);
    const endpoint = PROVIDER_ENV[id].endpoint(model);

    if (shouldLogInfo()) {
        console.info(`[ai/config] provider=${id} model=${model}`);
    }

    return { id, model, apiKey, endpoint };
}
