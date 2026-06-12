import {
  appendRunEvent,
  appendUserNode,
  createReplacementNode,
  createRun,
  getRunTrace,
  getThreadView,
  hasPendingRun,
  PROJECT_ASSISTANT_AGENT_PROFILE,
} from "@/modules/ai/domain/logs";
import type {
  AgentThreadView,
  ProjectAssistantContextSnapshot,
  ProjectAssistantToolName,
} from "@/modules/ai/domain/types";
import type { AiAssistantModelSelection } from "@/modules/config/domain/ai-assistant-model-selection";
import { invariant } from "@/shared/lib/domain";

import type {
  ProjectAssistantContinueResult,
  ProjectAssistantEditResult,
  ProjectAssistantRetryResult,
  ProjectAssistantSendResult,
} from "./service";
import {
  buildProjectAssistantSystemPrompt,
  buildUserTextMessage,
  createToolRuntimeContext,
  normalizeAssistantContextSnapshot,
  normalizeUserText,
  resolveAssistantRequest,
  resolveProjectAssistantActiveTools,
  resolveProjectAssistantModelSelection,
  resolveProjectAssistantModelSelectionFromSnapshot,
  runNeedsContinuation,
} from "./runtime";
import type { PreparedProjectAssistantRun } from "./types-internal";

export function assertNoPendingRunForThread(thread: AgentThreadView) {
  invariant(!hasPendingRun(thread.id), "当前会话正在生成回复，请稍后再试。");
}

export function buildSendRun({
  projectId,
  threadId,
  text,
  context,
  activeTools,
  readStoredSelection,
}: {
  projectId: string;
  threadId: string;
  text: string;
  context?: ProjectAssistantContextSnapshot | null;
  activeTools?: readonly ProjectAssistantToolName[] | null;
  readStoredSelection: () => AiAssistantModelSelection | null;
}): PreparedProjectAssistantRun<ProjectAssistantSendResult> {
  const selection = resolveProjectAssistantModelSelection(readStoredSelection);
  const normalizedContext = normalizeAssistantContextSnapshot(context);
  const resolvedActiveTools = resolveProjectAssistantActiveTools({
    selection,
    activeTools,
  });
  const threadView = getThreadView(threadId);
  const thread = threadView.thread;
  invariant(thread, "未找到当前会话。");
  invariant(thread.projectId === projectId, "AI 会话不属于当前项目。");
  invariant(thread.archivedAt == null, "不能向已归档会话发送消息。");
  assertNoPendingRunForThread(thread);

  const userNode = appendUserNode({
    threadId: thread.id,
    parentNodeId: thread.activeTipNodeId,
    message: buildUserTextMessage(normalizeUserText(text)),
    sourceKind: "user_input",
  });
  const run = createRun({
    threadId: thread.id,
    triggerNodeId: userNode.id,
    baseTipNodeId: userNode.id,
    runMode: "send",
    agentProfile: PROJECT_ASSISTANT_AGENT_PROFILE,
    selectionSnapshot: selection.snapshot,
    contextSnapshot: normalizedContext,
    activeTools: resolvedActiveTools,
  });
  appendRunEvent({
    runId: run.id,
    eventKind: "run-started",
    nodeId: userNode.id,
    summaryText: "用户消息触发新 run",
  });

  const system = buildProjectAssistantSystemPrompt();
  const request = resolveAssistantRequest({
    threadId: thread.id,
    triggerNodeId: userNode.id,
    system,
    selection,
    context: normalizedContext,
  });

  return {
    projectId,
    thread,
    run,
    triggerNodeId: userNode.id,
    messages: request.messages,
    providerOptions: request.providerOptions,
    system,
    transportSystem: request.transportSystem,
    selection,
    context: normalizedContext,
    runtimeContext: createToolRuntimeContext(normalizedContext),
    activeTools: resolvedActiveTools,
    initialResult: {
      thread: getThreadView(thread.id).thread!,
      userNode,
      assistantNode: null,
      run,
      state: getThreadView(thread.id),
    },
    runStartedEvent: {
      type: "run-started",
      run,
      threadId: thread.id,
      triggerNodeId: userNode.id,
      userNode,
    },
    buildFinalResult: ({ run: completedRun, lastAssistantNode }) => ({
      thread: getThreadView(thread.id).thread!,
      userNode,
      assistantNode: lastAssistantNode,
      run: completedRun,
      state: getThreadView(thread.id),
    }),
  };
}

export function buildRetryRun({
  projectId,
  threadId,
  triggerNodeId,
  context,
  activeTools,
  readStoredSelection,
}: {
  projectId: string;
  threadId: string;
  triggerNodeId: string;
  context?: ProjectAssistantContextSnapshot | null;
  activeTools?: readonly ProjectAssistantToolName[] | null;
  readStoredSelection: () => AiAssistantModelSelection | null;
}): PreparedProjectAssistantRun<ProjectAssistantRetryResult> {
  const selection = resolveProjectAssistantModelSelection(readStoredSelection);
  const normalizedContext = normalizeAssistantContextSnapshot(context);
  const resolvedActiveTools = resolveProjectAssistantActiveTools({
    selection,
    activeTools,
  });
  const threadView = getThreadView(threadId);
  const thread = threadView.thread;
  invariant(thread, "未找到当前会话。");
  invariant(thread.projectId === projectId, "AI 会话不属于当前项目。");
  invariant(thread.archivedAt == null, "不能重试已归档会话。");
  assertNoPendingRunForThread(thread);

  const triggerNode = threadView.activePath.find((node) => node.id === triggerNodeId);
  invariant(triggerNode, "当前只支持重试 active path 上的节点。");
  invariant(triggerNode.role === "user", "当前版本只能重试用户消息的回复。");

  const run = createRun({
    threadId: thread.id,
    triggerNodeId,
    baseTipNodeId: triggerNodeId,
    runMode: "retry",
    agentProfile: PROJECT_ASSISTANT_AGENT_PROFILE,
    selectionSnapshot: selection.snapshot,
    contextSnapshot: normalizedContext,
    activeTools: resolvedActiveTools,
  });
  appendRunEvent({
    runId: run.id,
    eventKind: "run-started",
    nodeId: triggerNodeId,
    summaryText: "重试 assistant 候选",
  });

  const system = buildProjectAssistantSystemPrompt();
  const request = resolveAssistantRequest({
    threadId: thread.id,
    triggerNodeId,
    system,
    selection,
    context: normalizedContext,
  });

  return {
    projectId,
    thread,
    run,
    triggerNodeId,
    messages: request.messages,
    providerOptions: request.providerOptions,
    system,
    transportSystem: request.transportSystem,
    selection,
    context: normalizedContext,
    runtimeContext: createToolRuntimeContext(normalizedContext),
    activeTools: resolvedActiveTools,
    initialResult: {
      thread: getThreadView(thread.id).thread!,
      assistantNode: null,
      run,
      state: getThreadView(thread.id),
    },
    runStartedEvent: {
      type: "run-started",
      run,
      threadId: thread.id,
      triggerNodeId,
    },
    buildFinalResult: ({ run: completedRun, lastAssistantNode }) => ({
      thread: getThreadView(thread.id).thread!,
      assistantNode: lastAssistantNode,
      run: completedRun,
      state: getThreadView(thread.id),
    }),
  };
}

export function buildEditRun({
  projectId,
  threadId,
  nodeId,
  text,
  context,
  activeTools,
  readStoredSelection,
}: {
  projectId: string;
  threadId: string;
  nodeId: string;
  text: string;
  context?: ProjectAssistantContextSnapshot | null;
  activeTools?: readonly ProjectAssistantToolName[] | null;
  readStoredSelection: () => AiAssistantModelSelection | null;
}): PreparedProjectAssistantRun<ProjectAssistantEditResult> {
  const selection = resolveProjectAssistantModelSelection(readStoredSelection);
  const normalizedContext = normalizeAssistantContextSnapshot(context);
  const resolvedActiveTools = resolveProjectAssistantActiveTools({
    selection,
    activeTools,
  });
  const threadView = getThreadView(threadId);
  const thread = threadView.thread;
  invariant(thread, "未找到当前会话。");
  invariant(thread.projectId === projectId, "AI 会话不属于当前项目。");
  invariant(thread.archivedAt == null, "不能修改已归档会话。");
  assertNoPendingRunForThread(thread);

  const replacementNode = createReplacementNode({
    threadId: thread.id,
    nodeId,
    message: buildUserTextMessage(normalizeUserText(text)),
  });
  const run = createRun({
    threadId: thread.id,
    triggerNodeId: replacementNode.id,
    baseTipNodeId: replacementNode.id,
    runMode: "edit_regenerate",
    agentProfile: PROJECT_ASSISTANT_AGENT_PROFILE,
    selectionSnapshot: selection.snapshot,
    contextSnapshot: normalizedContext,
    activeTools: resolvedActiveTools,
  });
  appendRunEvent({
    runId: run.id,
    eventKind: "run-started",
    nodeId: replacementNode.id,
    summaryText: "编辑消息并重新生成",
  });

  const system = buildProjectAssistantSystemPrompt();
  const request = resolveAssistantRequest({
    threadId: thread.id,
    triggerNodeId: replacementNode.id,
    system,
    selection,
    context: normalizedContext,
  });

  return {
    projectId,
    thread,
    run,
    triggerNodeId: replacementNode.id,
    messages: request.messages,
    providerOptions: request.providerOptions,
    system,
    transportSystem: request.transportSystem,
    selection,
    context: normalizedContext,
    runtimeContext: createToolRuntimeContext(normalizedContext),
    activeTools: resolvedActiveTools,
    initialResult: {
      thread: getThreadView(thread.id).thread!,
      replacementNode,
      assistantNode: null,
      run,
      state: getThreadView(thread.id),
    },
    runStartedEvent: {
      type: "run-started",
      run,
      threadId: thread.id,
      triggerNodeId: replacementNode.id,
      replacementNode,
    },
    buildFinalResult: ({ run: completedRun, lastAssistantNode }) => ({
      thread: getThreadView(thread.id).thread!,
      replacementNode,
      assistantNode: lastAssistantNode,
      run: completedRun,
      state: getThreadView(thread.id),
    }),
  };
}

export function buildContinueRun({
  projectId,
  threadId,
  runId,
}: {
  projectId: string;
  threadId: string;
  runId: string;
}): PreparedProjectAssistantRun<ProjectAssistantContinueResult> {
  const threadView = getThreadView(threadId);
  const thread = threadView.thread;
  invariant(thread, "未找到当前会话。");
  invariant(thread.projectId === projectId, "AI 会话不属于当前项目。");
  invariant(thread.archivedAt == null, "不能继续已归档会话。");
  assertNoPendingRunForThread(thread);

  const parentTrace = getRunTrace(runId);
  const parentRun = parentTrace.run;
  invariant(parentRun.threadId === thread.id, "原 run 不属于当前会话。");
  invariant(runNeedsContinuation(parentTrace), "这个 run 当前不需要继续。");
  invariant(parentTrace.childRuns.length === 0, "这个 run 已经继续过。");

  const activePathRunIds = new Set(
    threadView.activePath.flatMap((node) => (node.createdByRunId ? [node.createdByRunId] : [])),
  );
  invariant(activePathRunIds.has(parentRun.id), "只能继续当前 active path 上的 run。");
  const activeTipNodeId = thread.activeTipNodeId;
  invariant(activeTipNodeId, "当前会话没有可继续的 active tip。");
  const activeTip = threadView.activePath.at(-1);
  invariant(activeTip?.id === activeTipNodeId, "当前 active tip 不在 active path 上。");
  invariant(activeTip.createdByRunId === parentRun.id, "只能从原 run 的最后节点继续。");

  const selection = resolveProjectAssistantModelSelectionFromSnapshot(parentRun.selectionSnapshot);
  const activeTools = parentRun.activeTools ?? [];
  invariant(
    activeTools.length === 0 || selection.resolvedModel.supportsToolUse,
    "原 run 使用了工具，但当前模型不支持工具调用，无法继续。",
  );
  const context = normalizeAssistantContextSnapshot(parentRun.contextSnapshot);
  const system = buildProjectAssistantSystemPrompt();
  const request = resolveAssistantRequest({
    threadId: thread.id,
    triggerNodeId: activeTipNodeId,
    system,
    selection,
    context,
  });
  const run = createRun({
    threadId: thread.id,
    parentRunId: parentRun.id,
    triggerNodeId: activeTipNodeId,
    baseTipNodeId: activeTipNodeId,
    runMode: "continue",
    agentProfile: PROJECT_ASSISTANT_AGENT_PROFILE,
    selectionSnapshot: selection.snapshot,
    contextSnapshot: context,
    activeTools,
  });
  appendRunEvent({
    runId: parentRun.id,
    eventKind: "child-run-started",
    nodeId: activeTipNodeId,
    relatedRunId: run.id,
    summaryText: "继续达到轮次上限的 run",
  });
  appendRunEvent({
    runId: run.id,
    eventKind: "run-started",
    nodeId: activeTipNodeId,
    relatedRunId: parentRun.id,
    summaryText: "继续达到轮次上限的 run",
  });

  return {
    projectId,
    thread,
    run,
    triggerNodeId: activeTipNodeId,
    messages: request.messages,
    providerOptions: request.providerOptions,
    system,
    transportSystem: request.transportSystem,
    selection,
    context,
    runtimeContext: createToolRuntimeContext(context),
    activeTools,
    initialResult: {
      thread: getThreadView(thread.id).thread!,
      assistantNode: null,
      run,
      parentRun,
      state: getThreadView(thread.id),
    },
    runStartedEvent: {
      type: "run-started",
      run,
      threadId: thread.id,
      triggerNodeId: activeTipNodeId,
    },
    buildFinalResult: ({ run: completedRun, lastAssistantNode }) => ({
      thread: getThreadView(thread.id).thread!,
      assistantNode: lastAssistantNode,
      run: completedRun,
      parentRun,
      state: getThreadView(thread.id),
    }),
  };
}
