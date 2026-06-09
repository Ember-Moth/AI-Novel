import { deleteGlobalConfig, getGlobalConfig, setGlobalConfig } from "./global-config";

export interface AiAssistantModelSelection {
  connectionId: string;
  modelId: string;
}

const AI_ASSISTANT_MODEL_SELECTION_KEY = "ai.assistant.modelSelection";

function normalizeId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function getAiAssistantModelSelection(): AiAssistantModelSelection | null {
  const storedValue = getGlobalConfig<unknown>(AI_ASSISTANT_MODEL_SELECTION_KEY, null);

  if (!storedValue || typeof storedValue !== "object") {
    return null;
  }

  const connectionId = normalizeId(
    Reflect.get(storedValue as Record<string, unknown>, "connectionId"),
  );
  const modelId = normalizeId(Reflect.get(storedValue as Record<string, unknown>, "modelId"));

  if (!connectionId || !modelId) {
    return null;
  }

  return { connectionId, modelId };
}

export function setAiAssistantModelSelection(
  selection: AiAssistantModelSelection | null | undefined,
): AiAssistantModelSelection | null {
  const connectionId = normalizeId(selection?.connectionId);
  const modelId = normalizeId(selection?.modelId);

  if (!connectionId || !modelId) {
    deleteGlobalConfig(AI_ASSISTANT_MODEL_SELECTION_KEY);
    return null;
  }

  const normalizedSelection = {
    connectionId,
    modelId,
  };
  setGlobalConfig(AI_ASSISTANT_MODEL_SELECTION_KEY, normalizedSelection);
  return normalizedSelection;
}
