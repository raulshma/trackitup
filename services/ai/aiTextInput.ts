import type { DictationCaptureResult } from "../device/dictation.ts";

export const DEFAULT_AI_TRANSCRIPT_PREVIEW_MAX_LENGTH = 160;

function compactText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function compactAiTranscriptPreview(
  transcript: string,
  maxLength = DEFAULT_AI_TRANSCRIPT_PREVIEW_MAX_LENGTH,
): string | null {
  const preview = compactText(transcript, maxLength);
  return preview || null;
}

export function getAiTranscriptSourceLabel(
  mode?: DictationCaptureResult["mode"] | null,
) {
  if (mode === "speech-recognition") {
    return "Live transcript";
  }

  if (mode === "device-keyboard") {
    return "Keyboard dictation";
  }

  return null;
}

export function getAiPromptCharacterCountLabel(value: string) {
  const count = value.trim().length;
  return count === 0 ? "Prompt empty" : `${count} char${count === 1 ? "" : "s"}`;
}

export function canSubmitAiPrompt(value: string, isBusy = false) {
  return !isBusy && value.trim().length > 0;
}