import { PROJECT_ASSISTANT_MAX_STEPS } from "@/modules/ai/domain/types";

import { deleteGlobalConfig, getGlobalConfig, setGlobalConfig } from "./global-config";

export const AI_ASSISTANT_MAX_STEPS_DEFAULT = PROJECT_ASSISTANT_MAX_STEPS;
export const AI_ASSISTANT_MAX_STEPS_MIN = 1;
export const AI_ASSISTANT_MAX_STEPS_MAX = 100;

const AI_ASSISTANT_MAX_STEPS_KEY = "ai.assistant.maxSteps";

function normalizeMaxSteps(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const normalized = Math.trunc(value);
  if (normalized < AI_ASSISTANT_MAX_STEPS_MIN || normalized > AI_ASSISTANT_MAX_STEPS_MAX) {
    return null;
  }

  return normalized;
}

export function getAiAssistantMaxSteps(): number {
  return (
    normalizeMaxSteps(getGlobalConfig<unknown>(AI_ASSISTANT_MAX_STEPS_KEY, null)) ??
    AI_ASSISTANT_MAX_STEPS_DEFAULT
  );
}

export function setAiAssistantMaxSteps(value: number | null | undefined): number {
  const normalized = normalizeMaxSteps(value);
  if (normalized == null) {
    deleteGlobalConfig(AI_ASSISTANT_MAX_STEPS_KEY);
    return AI_ASSISTANT_MAX_STEPS_DEFAULT;
  }

  setGlobalConfig(AI_ASSISTANT_MAX_STEPS_KEY, normalized);
  return normalized;
}
