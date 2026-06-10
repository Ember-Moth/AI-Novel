import type {
  AgentCandidateGroupView,
  AgentRunView,
  AgentThreadNodeView,
  AgentThreadStateView,
  AgentThreadView,
  AgentToolSummaryEntry,
  ProjectAssistantContextSnapshot,
} from "@/modules/ai/domain/types";

export type AssistantState = AgentThreadStateView;

export type EditingThreadState = {
  threadId: string;
  title: string;
};

export type PendingAssistantAction =
  | {
      kind: "send";
      text: string;
    }
  | {
      kind: "retry";
      triggerNodeId: string;
    };

export const EMPTY_ASSISTANT_STATE: AssistantState = {
  thread: null,
  activePath: [],
  candidateGroups: [],
  latestRuns: [],
};

export const EMPTY_THREADS: AgentThreadView[] = [];

export function getMessageText(node: AgentThreadNodeView | null | undefined) {
  const content = (node?.message as { content?: unknown } | undefined)?.content;
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .flatMap((part) => {
      if (!part || typeof part !== "object") {
        return [];
      }
      return Reflect.get(part as Record<string, unknown>, "type") === "text"
        ? [Reflect.get(part as Record<string, unknown>, "text")]
        : [];
    })
    .filter((value): value is string => typeof value === "string")
    .join("\n");
}

function summarizeToolPayload(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }
  const toolName = Reflect.get(payload as Record<string, unknown>, "toolName");
  if (typeof toolName === "string" && toolName.trim().length > 0) {
    return fallback.replace("{tool}", toolName);
  }
  return fallback.replace("{tool}", "工具");
}

export function getAssistantToolTrace(node: AgentThreadNodeView | null | undefined) {
  return (node?.parts ?? []).flatMap<AgentToolSummaryEntry>((part) => {
    if (part.partKind === "tool-call") {
      return [
        {
          toolCallId:
            typeof (part.payload as Record<string, unknown>)?.toolCallId === "string"
              ? ((part.payload as Record<string, unknown>).toolCallId as string)
              : null,
          toolName:
            typeof (part.payload as Record<string, unknown>)?.toolName === "string"
              ? ((part.payload as Record<string, unknown>).toolName as string)
              : "tool",
          summary: summarizeToolPayload(part.payload, "调用 {tool}"),
          status: "success" as const,
          nodeId: node?.id ?? "",
          runId: node?.createdByRunId ?? null,
        },
      ];
    }
    if (part.partKind === "tool-result") {
      return [
        {
          toolCallId:
            typeof (part.payload as Record<string, unknown>)?.toolCallId === "string"
              ? ((part.payload as Record<string, unknown>).toolCallId as string)
              : null,
          toolName:
            typeof (part.payload as Record<string, unknown>)?.toolName === "string"
              ? ((part.payload as Record<string, unknown>).toolName as string)
              : "tool",
          summary: summarizeToolPayload(part.payload, "{tool} 返回结果"),
          status: "success" as const,
          nodeId: node?.id ?? "",
          runId: node?.createdByRunId ?? null,
        },
      ];
    }
    if (part.partKind === "tool-error") {
      return [
        {
          toolCallId:
            typeof (part.payload as Record<string, unknown>)?.toolCallId === "string"
              ? ((part.payload as Record<string, unknown>).toolCallId as string)
              : null,
          toolName:
            typeof (part.payload as Record<string, unknown>)?.toolName === "string"
              ? ((part.payload as Record<string, unknown>).toolName as string)
              : "tool",
          summary: summarizeToolPayload(part.payload, "{tool} 执行失败"),
          status: "error" as const,
          nodeId: node?.id ?? "",
          runId: node?.createdByRunId ?? null,
        },
      ];
    }
    return [];
  });
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

export function selectRetryableRun(state: AssistantState | null | undefined): AgentRunView | null {
  const latest = state?.latestRuns[0] ?? null;
  if (!latest || latest.status !== "failed" || !latest.triggerNodeId) {
    return null;
  }
  return latest;
}

export function selectPendingRun(state: AssistantState | null | undefined): AgentRunView | null {
  const latest = state?.latestRuns[0] ?? null;
  if (
    !latest ||
    (latest.status !== "running" && latest.status !== "queued") ||
    !latest.triggerNodeId
  ) {
    return null;
  }
  return latest;
}

export function canSendAssistantMessage({
  draft,
  threadId,
  selectedConnectionId,
  selectedModelId,
  selectionHydrated,
  isBusy,
  hasPendingRun,
}: {
  draft: string;
  threadId: string | null;
  selectedConnectionId: string;
  selectedModelId: string;
  selectionHydrated: boolean;
  isBusy: boolean;
  hasPendingRun: boolean;
}) {
  return (
    selectionHydrated &&
    threadId != null &&
    selectedConnectionId.length > 0 &&
    selectedModelId.length > 0 &&
    draft.trim().length > 0 &&
    !isBusy &&
    !hasPendingRun
  );
}

export function getCandidateGroupForNode(
  candidateGroups: AgentCandidateGroupView[],
  node: AgentThreadNodeView,
) {
  return candidateGroups.find((group) => group.activeNodeId === node.id) ?? null;
}

export function getRunErrorMessage() {
  return "AI 回复失败。";
}
