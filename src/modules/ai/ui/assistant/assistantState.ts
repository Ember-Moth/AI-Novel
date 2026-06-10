import type {
  AiAssistantMessageMetadata,
  AiProjectGenerationAttemptView,
  AiProjectHeadView,
  AiProjectMessageView,
  ProjectAssistantContextSnapshot,
  ProjectAssistantToolTraceEntry,
} from "@/modules/ai/domain/types";

export type AssistantState = {
  head: AiProjectHeadView | null;
  messages: AiProjectMessageView[];
  attempts: AiProjectGenerationAttemptView[];
};

export type AssistantMutationContext = {
  previousState?: AssistantState;
};

export type PendingAssistantAction =
  | {
      kind: "send";
      text: string;
    }
  | {
      kind: "retry";
      triggerMessageId: string;
    };

export type EditingHeadState = {
  headId: string;
  name: string;
};

export const EMPTY_ASSISTANT_STATE: AssistantState = {
  head: null,
  messages: [],
  attempts: [],
};

export const EMPTY_HEADS: AiProjectHeadView[] = [];

function appendUniqueMessage(messages: AiProjectMessageView[], message: AiProjectMessageView) {
  if (messages.some((current) => current.id === message.id)) {
    return messages;
  }

  return [...messages, message];
}

function upsertAttempt(
  attempts: AiProjectGenerationAttemptView[],
  attempt: AiProjectGenerationAttemptView,
) {
  const filtered = attempts.filter((current) => current.id !== attempt.id);
  return [...filtered, attempt].sort((left, right) => left.createdAt - right.createdAt);
}

export function getMessageText(content: unknown) {
  if (!content || typeof content !== "object") {
    return "";
  }

  const text = Reflect.get(content as Record<string, unknown>, "text");
  return typeof text === "string" ? text : "";
}

export function getAssistantMessageMetadata(metadata: unknown): AiAssistantMessageMetadata | null {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const rawToolTrace = Reflect.get(metadata as Record<string, unknown>, "toolTrace");
  const toolTrace = Array.isArray(rawToolTrace)
    ? rawToolTrace.flatMap((entry): ProjectAssistantToolTraceEntry[] => {
        if (!entry || typeof entry !== "object") {
          return [];
        }

        const toolName = Reflect.get(entry as Record<string, unknown>, "toolName");
        const summary = Reflect.get(entry as Record<string, unknown>, "summary");
        const status = Reflect.get(entry as Record<string, unknown>, "status");
        if (
          typeof toolName !== "string" ||
          typeof summary !== "string" ||
          (status !== "success" && status !== "error")
        ) {
          return [];
        }

        return [
          {
            toolName,
            summary,
            status,
          },
        ];
      })
    : [];
  const finishReason = Reflect.get(metadata as Record<string, unknown>, "finishReason");

  return {
    finishReason: typeof finishReason === "string" ? finishReason : undefined,
    toolTrace,
  };
}

export function getAssistantToolTrace(metadata: unknown) {
  return getAssistantMessageMetadata(metadata)?.toolTrace ?? [];
}

export function listAssistantContextDetails(context: ProjectAssistantContextSnapshot) {
  return [
    {
      label: "正文",
      value: context.activeContentTitle ?? "未选中",
    },
    {
      label: "辅助",
      value: context.activeAuxPath ?? "未选中",
    },
    {
      label: "时间",
      value: context.activeTimelineLabel ?? "未选中",
    },
  ];
}

export function selectRetryableAttempt(
  state: AssistantState | null | undefined,
): AiProjectGenerationAttemptView | null {
  const latest = state?.attempts.at(-1) ?? null;
  if (!latest || latest.status !== "error" || !latest.triggerMessageId) {
    return null;
  }

  return latest;
}

export function selectPendingAttempt(
  state: AssistantState | null | undefined,
): AiProjectGenerationAttemptView | null {
  const latest = state?.attempts.at(-1) ?? null;
  if (!latest || latest.status !== "pending" || !latest.triggerMessageId) {
    return null;
  }

  return latest;
}

export function canSendAssistantMessage({
  draft,
  headId,
  selectedConnectionId,
  selectedModelId,
  selectionHydrated,
  isBusy,
  hasPendingAttempt,
}: {
  draft: string;
  headId: string | null;
  selectedConnectionId: string;
  selectedModelId: string;
  selectionHydrated: boolean;
  isBusy: boolean;
  hasPendingAttempt: boolean;
}) {
  return (
    selectionHydrated &&
    headId != null &&
    selectedConnectionId.length > 0 &&
    selectedModelId.length > 0 &&
    draft.trim().length > 0 &&
    !isBusy &&
    !hasPendingAttempt
  );
}

export function applySendResultToState(
  state: AssistantState | null | undefined,
  result: {
    head: AiProjectHeadView;
    userMessage: AiProjectMessageView;
    assistantMessage: AiProjectMessageView;
    attempt: AiProjectGenerationAttemptView;
  },
): AssistantState {
  const base = state?.head?.id === result.head.id ? state : EMPTY_ASSISTANT_STATE;

  return {
    head: result.head,
    messages: appendUniqueMessage(
      appendUniqueMessage(base.messages, result.userMessage),
      result.assistantMessage,
    ),
    attempts: upsertAttempt(base.attempts, result.attempt),
  };
}

export function applyRetryResultToState(
  state: AssistantState | null | undefined,
  result: {
    head: AiProjectHeadView;
    assistantMessage: AiProjectMessageView;
    attempt: AiProjectGenerationAttemptView;
  },
): AssistantState {
  const base = state?.head?.id === result.head.id ? state : EMPTY_ASSISTANT_STATE;

  return {
    head: result.head,
    messages: appendUniqueMessage(base.messages, result.assistantMessage),
    attempts: upsertAttempt(base.attempts, result.attempt),
  };
}

export function getAttemptErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") {
    return "AI 回复失败。";
  }

  const message = Reflect.get(error as Record<string, unknown>, "message");
  return typeof message === "string" && message.trim().length > 0 ? message : "AI 回复失败。";
}
