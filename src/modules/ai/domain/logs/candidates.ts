import { getAiAssistantMaxSteps } from "@/modules/config/domain/ai-assistant-options";

import type { AiIndexPayload } from "../ai-index-store";
import type {
  AgentCandidateGroupView,
  AgentRunSummaryView,
  AgentThreadNodeView,
  AgentThreadRole,
} from "../types";
import { mapRunRow } from "./mappers";
import { sortByCreatedAt } from "./shared";
import { getNodeRowsByThread } from "./storage";

export function resolveCandidateLeafTip(
  index: AiIndexPayload,
  threadId: string,
  candidateNodeId: string,
) {
  let currentId = candidateNodeId;
  while (true) {
    const children = getNodeRowsByThread(index, threadId, currentId);
    if (children.length !== 1) {
      return currentId;
    }
    currentId = children[0]!.id;
  }
}

export function buildCandidateGroups(
  index: AiIndexPayload,
  threadId: string,
  activePath: AgentThreadNodeView[],
) {
  const activeNodeByParent = new Map<string | null, string>();
  activePath.forEach((node) => {
    activeNodeByParent.set(node.parentNodeId, node.id);
  });

  const groups: AgentCandidateGroupView[] = [];
  for (const [parentNodeId, activeNodeId] of activeNodeByParent.entries()) {
    const candidates = getNodeRowsByThread(index, threadId, parentNodeId);
    if (candidates.length <= 1) {
      continue;
    }
    groups.push({
      parentNodeId,
      activeNodeId,
      nodes: candidates.map((row) => ({
        id: row.id,
        tipNodeId: resolveCandidateLeafTip(index, row.threadId, row.id),
        role: row.role as AgentThreadRole,
        summaryText: row.summaryText,
        createdAt: row.createdAt,
        createdByRunId: row.createdByRunId,
      })),
    });
  }
  return groups;
}

export function buildRunSummaries(
  index: AiIndexPayload,
  threadId: string,
  activePath: AgentThreadNodeView[],
) {
  const activeNodeIds = new Set(activePath.map((node) => node.id));
  const activeIndexByNodeId = new Map(activePath.map((node, entryIndex) => [node.id, entryIndex]));
  const includedRunIds = new Set(
    activePath.flatMap((node) => (node.createdByRunId ? [node.createdByRunId] : [])),
  );
  const assistantDisplayNodeByRunId = new Map<string, string>();

  activePath.forEach((node) => {
    if (node.role === "assistant" && node.createdByRunId) {
      assistantDisplayNodeByRunId.set(node.createdByRunId, node.id);
    }
  });

  const runRows = sortByCreatedAt(index.runs.filter((row) => row.threadId === threadId));
  const relevantRunRows = runRows.filter((row) => {
    if (includedRunIds.has(row.id)) {
      return true;
    }
    return (
      (row.status === "failed" &&
        row.triggerNodeId != null &&
        activeNodeIds.has(row.triggerNodeId)) ||
      row.status === "waiting_for_input"
    );
  });
  const relevantRuns = relevantRunRows.map(mapRunRow);

  if (relevantRuns.length === 0) {
    return [] as AgentRunSummaryView[];
  }

  const continuedByRunId = new Map<string, string>();
  relevantRuns.forEach((row) => {
    if (row.parentRunId && row.runMode === "continue") {
      continuedByRunId.set(row.parentRunId, row.id);
    }
  });

  return relevantRuns
    .flatMap((row) => {
      const maxSteps = getAiAssistantMaxSteps();
      const displayNodeId =
        assistantDisplayNodeByRunId.get(row.id) ??
        (row.triggerNodeId && activeNodeIds.has(row.triggerNodeId) ? row.triggerNodeId : null);
      if (!displayNodeId) {
        return [];
      }

      const cachedRun = relevantRunRows.find((entry) => entry.id === row.id)!;
      const continuationReason =
        row.status === "succeeded" &&
        row.activeTools != null &&
        cachedRun.stepCount >= maxSteps &&
        cachedRun.lastFinishReason === "tool-calls"
          ? "step-limit"
          : null;

      return [
        {
          runId: row.id,
          triggerNodeId: row.triggerNodeId,
          displayNodeId,
          status: row.status,
          stepCount: cachedRun.stepCount,
          totalTokens: cachedRun.totalTokens,
          durationMs:
            typeof row.completedAt === "number"
              ? Math.max(0, row.completedAt - row.startedAt)
              : null,
          errorMessage:
            row.status === "failed" ? (cachedRun.errorSummary ?? "AI 回复失败。") : null,
          needsContinuation: continuationReason != null && !continuedByRunId.has(row.id),
          continuationReason,
          continuedByRunId: continuedByRunId.get(row.id) ?? null,
        } satisfies AgentRunSummaryView,
      ];
    })
    .sort((left, right) => {
      const leftIndex = activeIndexByNodeId.get(left.displayNodeId) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = activeIndexByNodeId.get(right.displayNodeId) ?? Number.MAX_SAFE_INTEGER;
      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }
      const leftRun = relevantRuns.find((row) => row.id === left.runId)!;
      const rightRun = relevantRuns.find((row) => row.id === right.runId)!;
      return leftRun.createdAt - rightRun.createdAt;
    });
}
