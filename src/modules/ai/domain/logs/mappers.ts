import type { ModelMessage } from "ai";

import { invariant } from "@/shared/lib/domain";

import { buildModelMessageFromParts } from "./message-parts";
import { parseStoredArray, parseStoredJson } from "./shared";
import type {
  AgentArtifactKind,
  AgentArtifactRow,
  AgentArtifactView,
  AgentMessagePartRow,
  AgentPartState,
  AgentProjectStateRow,
  AgentProjectStateView,
  AgentRunEventKind,
  AgentRunEventRow,
  AgentRunEventView,
  AgentRunInputRefRow,
  AgentRunMode,
  AgentRunRow,
  AgentRunStatus,
  AgentRunStepRow,
  AgentRunStepView,
  AgentRunView,
  AssistantInputRefSnapshot,
  AgentThreadNodePartKind,
  AgentThreadNodePartView,
  AgentThreadNodeRow,
  AgentThreadNodeSourceKind,
  AgentThreadNodeView,
  AgentThreadRole,
  AgentThreadRow,
  AgentThreadView,
  AgentVisibility,
  ProjectAssistantContextSnapshot,
  ProjectAssistantToolName,
} from "../types";

function assertThreadRole(role: string): asserts role is AgentThreadRole {
  invariant(
    role === "system" || role === "user" || role === "assistant" || role === "tool",
    "不支持的线程节点角色。",
  );
}

function assertRunMode(mode: string): asserts mode is AgentRunMode {
  invariant(
    mode === "send" ||
      mode === "retry" ||
      mode === "regenerate" ||
      mode === "edit_regenerate" ||
      mode === "continue" ||
      mode === "subagent",
    "不支持的 run 模式。",
  );
}

function assertRunStatus(status: string): asserts status is AgentRunStatus {
  invariant(
    status === "queued" ||
      status === "running" ||
      status === "waiting_for_input" ||
      status === "succeeded" ||
      status === "failed" ||
      status === "cancelled",
    "不支持的 run 状态。",
  );
}

function assertPartKind(kind: string): asserts kind is AgentThreadNodePartKind {
  invariant(
    kind === "text" ||
      kind === "data-assistant-ref" ||
      kind === "reasoning" ||
      kind === "tool-call" ||
      kind === "tool-result" ||
      kind === "tool-approval-request" ||
      kind === "tool-approval-response" ||
      kind === "tool-error" ||
      kind === "file" ||
      kind === "source-url" ||
      kind === "source-document" ||
      kind === "data" ||
      kind === "step-start",
    "不支持的节点 part 类型。",
  );
}

function assertVisibility(visibility: string): asserts visibility is AgentVisibility {
  invariant(
    visibility === "public" || visibility === "hidden" || visibility === "internal",
    "不支持的可见性。",
  );
}

function assertPartState(state: string): asserts state is AgentPartState {
  invariant(state === "streaming" || state === "done", "不支持的 part 状态。");
}

function assertEventKind(kind: string): asserts kind is AgentRunEventKind {
  invariant(
    kind === "run-started" ||
      kind === "step-started" ||
      kind === "provider-requested" ||
      kind === "provider-responded" ||
      kind === "tool-call-started" ||
      kind === "tool-call-finished" ||
      kind === "tool-call-failed" ||
      kind === "user-input-requested" ||
      kind === "user-input-submitted" ||
      kind === "node-materialized" ||
      kind === "active-tip-moved" ||
      kind === "child-run-started" ||
      kind === "run-failed" ||
      kind === "run-succeeded",
    "不支持的 run 事件类型。",
  );
}

function assertArtifactKind(kind: string): asserts kind is AgentArtifactKind {
  invariant(
    kind === "prepared-model-messages" ||
      kind === "response-messages" ||
      kind === "request-body" ||
      kind === "response-body" ||
      kind === "provider-metadata" ||
      kind === "tool-input" ||
      kind === "tool-output" ||
      kind === "reasoning-raw" ||
      kind === "ui-projection" ||
      kind === "error",
    "不支持的 artifact 类型。",
  );
}

function assertSourceKind(kind: string): asserts kind is AgentThreadNodeSourceKind {
  invariant(
    kind === "user_input" ||
      kind === "model_response" ||
      kind === "tool_result" ||
      kind === "system_seed" ||
      kind === "edit_rewrite",
    "不支持的节点来源类型。",
  );
}

export function mapProjectStateRow(row: AgentProjectStateRow): AgentProjectStateView {
  return {
    id: row.id,
    projectId: row.projectId,
    agentProfile: row.agentProfile,
    activeThreadId: row.activeThreadId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapThreadRow(row: AgentThreadRow): AgentThreadView {
  return {
    id: row.id,
    projectId: row.projectId,
    agentProfile: row.agentProfile,
    title: row.title,
    activeTipNodeId: row.activeTipNodeId,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapNodePartRow(row: AgentMessagePartRow): AgentThreadNodePartView {
  assertPartKind(row.partKind);
  assertVisibility(row.visibility);
  assertPartState(row.state);
  return {
    id: row.id,
    nodeId: row.nodeId,
    partIndex: row.partIndex,
    partKind: row.partKind,
    visibility: row.visibility,
    state: row.state,
    providerOptions: parseStoredJson(row.providerOptionsJson),
    providerMetadata: parseStoredJson(row.providerMetadataJson),
    payload: JSON.parse(row.payloadJson),
    createdAt: row.createdAt,
  };
}

function listNodePartViews(node: AgentThreadNodeRow) {
  return parseStoredArray<AgentMessagePartRow>(node.partsJson)
    .sort((left, right) => left.partIndex - right.partIndex)
    .map(mapNodePartRow);
}

export function mapNodeRow(row: AgentThreadNodeRow): AgentThreadNodeView {
  assertThreadRole(row.role);
  assertSourceKind(row.sourceKind);
  const parts = listNodePartViews(row);
  return {
    id: row.id,
    threadId: row.threadId,
    parentNodeId: row.parentNodeId,
    role: row.role,
    createdByRunId: row.createdByRunId,
    sourceStepId: row.sourceStepId,
    sourceKind: row.sourceKind,
    summaryText: row.summaryText,
    message: buildModelMessageFromParts(row.role, parts),
    parts,
    createdAt: row.createdAt,
  };
}

export function getNodeModelMessage(node: AgentThreadNodeRow): ModelMessage {
  assertThreadRole(node.role);
  return buildModelMessageFromParts(node.role, listNodePartViews(node));
}

export function mapArtifactRow(row: AgentArtifactRow): AgentArtifactView {
  assertArtifactKind(row.artifactKind);
  assertVisibility(row.visibility);
  return {
    id: row.id,
    runId: row.runId,
    stepId: row.stepId,
    artifactKind: row.artifactKind,
    visibility: row.visibility,
    mimeType: row.mimeType,
    content: JSON.parse(row.contentJson),
    summaryText: row.summaryText,
    createdAt: row.createdAt,
  };
}

export function mapRunInputRefRow(row: AgentRunInputRefRow): AssistantInputRefSnapshot {
  invariant(row.kind === "global-prompt", "不支持的 run input ref 类型。");
  invariant(row.mode === "snapshot-ref", "不支持的 run input ref 模式。");
  const display = JSON.parse(row.displayJson) as { refId?: unknown };
  const refId = typeof display.refId === "string" ? display.refId : row.id;
  return {
    refId,
    kind: row.kind,
    mode: row.mode,
    label: row.label,
    source: JSON.parse(row.sourceJson) as AssistantInputRefSnapshot["source"],
    snapshot: JSON.parse(row.snapshotJson) as AssistantInputRefSnapshot["snapshot"],
  };
}

export function mapRunRow(row: AgentRunRow): AgentRunView {
  assertRunMode(row.runMode);
  assertRunStatus(row.status);
  return {
    id: row.id,
    threadId: row.threadId,
    parentRunId: row.parentRunId,
    parentEventId: row.parentEventId,
    triggerNodeId: row.triggerNodeId,
    baseTipNodeId: row.baseTipNodeId,
    runMode: row.runMode,
    status: row.status,
    agentProfile: row.agentProfile,
    selectionSnapshot: parseStoredJson<unknown>(row.selectionSnapshotJson) ?? {},
    contextSnapshot: parseStoredJson<ProjectAssistantContextSnapshot>(row.contextSnapshotJson),
    inputRefsSnapshot: row.inputRefsSnapshotJson
      ? parseStoredArray<AssistantInputRefSnapshot>(row.inputRefsSnapshotJson)
      : null,
    activeTools: row.activeToolsJson
      ? parseStoredArray<ProjectAssistantToolName>(row.activeToolsJson)
      : null,
    errorArtifactId: row.errorArtifactId,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapRunStepRow(row: AgentRunStepRow): AgentRunStepView {
  return {
    id: row.id,
    runId: row.runId,
    stepIndex: row.stepIndex,
    provider: row.provider,
    modelId: row.modelId,
    finishReason: row.finishReason,
    rawFinishReason: row.rawFinishReason,
    system: parseStoredJson(row.systemJson),
    preparedMessagesArtifactId: row.preparedMessagesArtifactId,
    responseMessagesArtifactId: row.responseMessagesArtifactId,
    requestBodyArtifactId: row.requestBodyArtifactId,
    responseBodyArtifactId: row.responseBodyArtifactId,
    providerMetadataArtifactId: row.providerMetadataArtifactId,
    usage: parseStoredJson(row.usageJson),
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
  };
}

export function mapRunEventRow(row: AgentRunEventRow): AgentRunEventView {
  assertEventKind(row.eventKind);
  return {
    id: row.id,
    runId: row.runId,
    stepId: row.stepId,
    seq: row.seq,
    eventKind: row.eventKind,
    nodeId: row.nodeId,
    relatedToolCallId: row.relatedToolCallId,
    relatedRunId: row.relatedRunId,
    summaryText: row.summaryText,
    payloadArtifactId: row.payloadArtifactId,
    createdAt: row.createdAt,
  };
}
