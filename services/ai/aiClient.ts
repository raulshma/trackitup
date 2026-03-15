import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, streamText, type FinishReason } from "ai";

import {
  isAiKeyStorageAvailable,
  loadStoredOpenRouterApiKey,
} from "./aiKeyStorage.ts";
import { normalizeOpenRouterTextModel } from "./aiPreferences.ts";

export {
  DEFAULT_OPENROUTER_TEXT_MODEL,
  normalizeOpenRouterTextModel
} from "./aiPreferences.ts";
export const DEFAULT_AI_MAX_OUTPUT_TOKENS = 700;
export const DEFAULT_AI_TIMEOUT_MS = 30_000;
export const TRACKITUP_AI_CLIENT_TITLE = "TrackItUp";

export type OpenRouterTextGenerationOptions = {
  prompt: string;
  system?: string;
  model?: string;
  user?: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
  headers?: Record<string, string | undefined>;
};

export type AiServiceAvailability = {
  status: "ready" | "missing-api-key" | "storage-unavailable";
  message: string;
};

export type AiTextGenerationResult =
  | {
      status: "success";
      text: string;
      modelId: string;
      finishReason: FinishReason;
      usage: {
        inputTokens: number | undefined;
        outputTokens: number | undefined;
        totalTokens: number | undefined;
      };
    }
  | {
      status:
        | "invalid-prompt"
        | "missing-api-key"
        | "storage-unavailable"
        | "error";
      message: string;
      modelId: string;
    };

export function buildTrackItUpAiHeaders(
  headers?: Record<string, string | undefined>,
) {
  return Object.fromEntries(
    Object.entries({ "X-Title": TRACKITUP_AI_CLIENT_TITLE, ...headers }).filter(
      ([, value]) => typeof value === "string" && value.trim().length > 0,
    ),
  ) as Record<string, string>;
}

export function normalizeOpenRouterTextGenerationOptions(
  options: OpenRouterTextGenerationOptions,
) {
  return {
    prompt: options.prompt.trim(),
    system:
      typeof options.system === "string" && options.system.trim().length > 0
        ? options.system.trim()
        : undefined,
    model: normalizeOpenRouterTextModel(options.model),
    user:
      typeof options.user === "string" && options.user.trim().length > 0
        ? options.user.trim()
        : undefined,
    temperature:
      typeof options.temperature === "number"
        ? Math.max(0, Math.min(2, options.temperature))
        : undefined,
    maxOutputTokens:
      typeof options.maxOutputTokens === "number" &&
      Number.isFinite(options.maxOutputTokens)
        ? Math.max(64, Math.min(4_096, Math.trunc(options.maxOutputTokens)))
        : DEFAULT_AI_MAX_OUTPUT_TOKENS,
    timeoutMs:
      typeof options.timeoutMs === "number" &&
      Number.isFinite(options.timeoutMs)
        ? Math.max(5_000, Math.min(120_000, Math.trunc(options.timeoutMs)))
        : DEFAULT_AI_TIMEOUT_MS,
    abortSignal: options.abortSignal,
    headers: buildTrackItUpAiHeaders(options.headers),
  };
}

async function resolveNormalizedOpenRouterTextGenerationOptions(
  options: OpenRouterTextGenerationOptions,
) {
  const preferredModel =
    typeof options.model === "string" && options.model.trim().length > 0
      ? options.model
      : await (async () => {
          const { loadOpenRouterTextModelPreference } =
            await import("./aiPreferencePersistence.ts");
          return loadOpenRouterTextModelPreference();
        })();

  return normalizeOpenRouterTextGenerationOptions({
    ...options,
    model: preferredModel,
  });
}

export function formatAiServiceError(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "The AI request failed before TrackItUp received a usable response.";
}

function supportsAbortSignalTimeout() {
  const abortSignalConstructor = (
    globalThis as typeof globalThis & {
      AbortSignal?: { timeout?: (delay: number) => AbortSignal };
    }
  ).AbortSignal;

  return typeof abortSignalConstructor?.timeout === "function";
}

export async function getAiTextServiceAvailability(): Promise<AiServiceAvailability> {
  const [isStorageAvailable, apiKey] = await Promise.all([
    isAiKeyStorageAvailable(),
    loadStoredOpenRouterApiKey(),
  ]);

  if (apiKey) {
    return {
      status: "ready",
      message: "AI text generation is ready on this device.",
    };
  }

  if (!isStorageAvailable) {
    return {
      status: "storage-unavailable",
      message:
        "Secure device storage is unavailable, so a BYOK OpenRouter key cannot be loaded here.",
    };
  }

  return {
    status: "missing-api-key",
    message:
      "Save an OpenRouter API key in account settings before using AI features.",
  };
}

async function resolveOpenRouterTextModel(
  options: ReturnType<typeof normalizeOpenRouterTextGenerationOptions>,
) {
  const apiKey = await loadStoredOpenRouterApiKey();
  if (!apiKey) return null;

  const openrouter = createOpenRouter({
    apiKey,
    compatibility: "strict",
    headers: options.headers,
  });

  return openrouter.chat(options.model, {
    user: options.user,
    usage: { include: true },
  });
}

export async function generateOpenRouterText(
  options: OpenRouterTextGenerationOptions,
): Promise<AiTextGenerationResult> {
  const normalizedOptions =
    await resolveNormalizedOpenRouterTextGenerationOptions(options);

  if (!normalizedOptions.prompt) {
    return {
      status: "invalid-prompt",
      message: "Enter a prompt before requesting AI output.",
      modelId: normalizedOptions.model,
    };
  }

  const availability = await getAiTextServiceAvailability();
  if (availability.status !== "ready") {
    return {
      status: availability.status,
      message: availability.message,
      modelId: normalizedOptions.model,
    };
  }

  const model = await resolveOpenRouterTextModel(normalizedOptions);
  if (!model) {
    return {
      status: "missing-api-key",
      message:
        "Save an OpenRouter API key in account settings before using AI features.",
      modelId: normalizedOptions.model,
    };
  }

  try {
    const timeoutOption = supportsAbortSignalTimeout()
      ? { timeout: { totalMs: normalizedOptions.timeoutMs } }
      : undefined;

    const result = await generateText({
      model,
      system: normalizedOptions.system,
      prompt: normalizedOptions.prompt,
      temperature: normalizedOptions.temperature,
      maxOutputTokens: normalizedOptions.maxOutputTokens,
      ...timeoutOption,
      abortSignal: normalizedOptions.abortSignal,
    });

    return {
      status: "success",
      text: result.text,
      modelId: normalizedOptions.model,
      finishReason: result.finishReason,
      usage: {
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        totalTokens: result.usage.totalTokens,
      },
    };
  } catch (error) {
    return {
      status: "error",
      message: formatAiServiceError(error),
      modelId: normalizedOptions.model,
    };
  }
}

export async function streamOpenRouterText(
  options: OpenRouterTextGenerationOptions,
) {
  const normalizedOptions =
    await resolveNormalizedOpenRouterTextGenerationOptions(options);

  if (!normalizedOptions.prompt) {
    return {
      status: "invalid-prompt" as const,
      message: "Enter a prompt before requesting AI output.",
      modelId: normalizedOptions.model,
    };
  }

  const availability = await getAiTextServiceAvailability();
  if (availability.status !== "ready") {
    return {
      status: availability.status,
      message: availability.message,
      modelId: normalizedOptions.model,
    };
  }

  const model = await resolveOpenRouterTextModel(normalizedOptions);
  if (!model) {
    return {
      status: "missing-api-key" as const,
      message:
        "Save an OpenRouter API key in account settings before using AI features.",
      modelId: normalizedOptions.model,
    };
  }

  const timeoutOption = supportsAbortSignalTimeout()
    ? { timeout: { totalMs: normalizedOptions.timeoutMs } }
    : undefined;

  return {
    status: "success" as const,
    modelId: normalizedOptions.model,
    stream: streamText({
      model,
      system: normalizedOptions.system,
      prompt: normalizedOptions.prompt,
      temperature: normalizedOptions.temperature,
      maxOutputTokens: normalizedOptions.maxOutputTokens,
      ...timeoutOption,
      abortSignal: normalizedOptions.abortSignal,
    }),
  };
}
