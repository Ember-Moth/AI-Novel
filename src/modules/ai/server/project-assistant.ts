import type { ModelMessage } from "ai";
import { generateText, stepCountIs } from "ai";
import { eq } from "drizzle-orm";

import { db, schema } from "@/db";
import {
  appendRunEvent,
  appendUserNode,
  archiveThread,
  buildThreadModelMessages,
  createArtifact,
  createReplacementNode,
  createRun,
  createRunStep,
  createThread,
  getNodeCandidates,
  getRunTrace,
  getThreadView,
  hasPendingRun,
  listChildRuns,
  listThreads,
  markRunFailed,
  markRunSucceeded,
  materializeResponseMessages,
  PROJECT_ASSISTANT_AGENT_PROFILE,
  renameThread,
  resolveActiveThread,
  selectActiveTip,
  setActiveThread,
} from "@/modules/ai/domain/logs";
import type {
  AgentRunTraceView,
  AgentRunView,
  AgentThreadNodeView,
  AgentThreadStateView,
  AgentThreadView,
  AiConnectionRow,
  AiResolvedModelView,
  AiSelectionSnapshotInput,
  ProjectAssistantContextSnapshot,
} from "@/modules/ai/domain/types";
import { listResolvedModelsForConnection } from "@/modules/ai/domain/catalog";
import {
  getAiAssistantModelSelection,
  type AiAssistantModelSelection,
} from "@/modules/config/domain/ai-assistant-model-selection";
import { invariant } from "@/shared/lib/domain";

import { createAssistantReadOnlyTools } from "./assistant-tools";
import { createLanguageModelForConnection } from "./provider-factories";

export interface ProjectAssistantStateView extends AgentThreadStateView {}

export interface ProjectAssistantSendResult {
  thread: AgentThreadView;
  userNode: AgentThreadNodeView;
  assistantNode: AgentThreadNodeView | null;
  run: AgentRunView;
  state: AgentThreadStateView;
}

export interface ProjectAssistantRetryResult {
  thread: AgentThreadView;
  assistantNode: AgentThreadNodeView | null;
  run: AgentRunView;
  state: AgentThreadStateView;
}

export interface ProjectAssistantEditResult {
  thread: AgentThreadView;
  replacementNode: AgentThreadNodeView;
  assistantNode: AgentThreadNodeView | null;
  run: AgentRunView;
  state: AgentThreadStateView;
}

export interface ProjectAssistantOverview {
  activeThreadId: string | null;
  threads: AgentThreadView[];
  state: AgentThreadStateView;
}

export const PROJECT_ASSISTANT_SYSTEM_PROMPT_ID = "writing-assistant-v2";

const PROJECT_ASSISTANT_SYSTEM_PROMPT = [
  "你是一个小说写作助手。",
  "回答要直接、具体、可执行，优先帮助作者推进写作。",
  "默认优先结合当前编辑上下文理解问题。",
  "如果当前信息不足，可以读取当前项目中的只读上下文工具。",
  "严禁编造未实际读取到的项目数据。",
  "最终只输出给作者看的纯文本答复，不要暴露结构化协议或 JSON。",
].join("\n");

interface AssistantModelSelection {
  storedSelection: AiAssistantModelSelection;
  connection: AiConnectionRow;
  resolvedModel: AiResolvedModelView;
  snapshot: AiSelectionSnapshotInput;
}

interface GenerateAssistantTextInput {
  projectId: string;
  connection: AiConnectionRow;
  modelId: string;
  system: string;
  toolMode: "none" | "auto-read-only";
  context: ProjectAssistantContextSnapshot | null;
  messages: ModelMessage[];
}

interface GeneratedAssistantStep {
  stepNumber: number;
  model: {
    provider: string;
    modelId: string;
  };
  finishReason: string | undefined;
  rawFinishReason: string | undefined;
  usage: unknown;
  request: {
    body?: unknown;
  };
  response: {
    body?: unknown;
    messages: ModelMessage[];
  };
  providerMetadata: unknown;
  toolCalls: Array<Record<string, unknown>>;
  toolResults: Array<Record<string, unknown>>;
}

interface GenerateAssistantTextResult {
  text: string;
  finishReason: string | undefined;
  usage: unknown;
  preparedMessagesByStep: ModelMessage[][];
  steps: GeneratedAssistantStep[];
}

interface ProjectAssistantDependencies {
  generateAssistantText: (
    _input: GenerateAssistantTextInput,
  ) => Promise<GenerateAssistantTextResult>;
  readStoredSelection: () => AiAssistantModelSelection | null;
}

function defaultGenerateAssistantText({
  projectId,
  connection,
  modelId,
  system,
  toolMode,
  context,
  messages,
}: GenerateAssistantTextInput): Promise<GenerateAssistantTextResult> {
  const model = createLanguageModelForConnection({ connection, modelId });
  const preparedMessagesByStep: ModelMessage[][] = [];
  const tools =
    toolMode === "auto-read-only"
      ? createAssistantReadOnlyTools({
          projectId,
          context,
        })
      : undefined;

  return generateText({
    model,
    system,
    messages,
    tools,
    stopWhen: stepCountIs(5),
    prepareStep: ({ messages: stepMessages, stepNumber }) => {
      preparedMessagesByStep[stepNumber] = stepMessages;
      return undefined;
    },
  }).then((result) => ({
    text: result.text,
    finishReason: result.finishReason,
    usage: result.totalUsage,
    preparedMessagesByStep,
    steps: result.steps.map((step) => ({
      stepNumber: step.stepNumber,
      model: step.model,
      finishReason: step.finishReason,
      rawFinishReason: step.rawFinishReason,
      usage: step.usage,
      request: step.request,
      response: {
        body: step.response.body,
        messages: step.response.messages as ModelMessage[],
      },
      providerMetadata: step.providerMetadata,
      toolCalls: step.toolCalls as Array<Record<string, unknown>>,
      toolResults: step.toolResults as Array<Record<string, unknown>>,
    })),
  }));
}

function normalizeUserText(text: string) {
  const normalized = text.trim();
  invariant(normalized.length > 0, "消息不能为空。");
  return normalized;
}

function normalizeOptionalString(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeAssistantContextSnapshot(
  context: ProjectAssistantContextSnapshot | null | undefined,
): ProjectAssistantContextSnapshot | null {
  if (!context) {
    return null;
  }

  return {
    workspaceId: normalizeOptionalString(context.workspaceId),
    activeContentNodeId: normalizeOptionalString(context.activeContentNodeId),
    activeContentTitle: normalizeOptionalString(context.activeContentTitle),
    activeAuxNodeId: normalizeOptionalString(context.activeAuxNodeId),
    activeAuxPath: normalizeOptionalString(context.activeAuxPath),
    activeTimelinePointId: normalizeOptionalString(context.activeTimelinePointId),
    activeTimelineLabel: normalizeOptionalString(context.activeTimelineLabel),
  };
}

function buildContextSection(context: ProjectAssistantContextSnapshot | null) {
  if (!context) {
    return "当前编辑上下文：未提供明确的选中信息。";
  }

  return [
    "当前编辑上下文：",
    `- 工作区 ID：${context.workspaceId ?? "未提供"}`,
    `- 当前正文节点：${context.activeContentTitle ?? "未选中"}${context.activeContentNodeId ? ` (${context.activeContentNodeId})` : ""}`,
    `- 当前辅助资料：${context.activeAuxPath ?? "未选中"}${context.activeAuxNodeId ? ` (${context.activeAuxNodeId})` : ""}`,
    `- 当前时间点：${context.activeTimelineLabel ?? "未选中"}${context.activeTimelinePointId ? ` (${context.activeTimelinePointId})` : ""}`,
  ].join("\n");
}

function buildProjectAssistantSystemPrompt({
  toolMode,
  context,
}: {
  toolMode: "none" | "auto-read-only";
  context: ProjectAssistantContextSnapshot | null;
}) {
  const modeInstruction =
    toolMode === "auto-read-only"
      ? "本轮允许使用只读工具读取正文、时间线和辅助资料。先使用当前编辑上下文；只有在信息不足时再调用工具。"
      : "本轮不提供工具调用能力，只能基于当前编辑上下文与已有消息回答。";

  return [PROJECT_ASSISTANT_SYSTEM_PROMPT, modeInstruction, buildContextSection(context)].join(
    "\n\n",
  );
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return {
    message: "AI 回复生成失败。",
    detail: error,
  };
}

function resolveProjectAssistantModelSelection(
  readStoredSelection: () => AiAssistantModelSelection | null,
): AssistantModelSelection {
  const storedSelection = readStoredSelection();
  invariant(storedSelection, "请先在 AI 助手里选择连接和模型。");

  const connection = db.query.aiConnections
    .findFirst({ where: eq(schema.aiConnections.id, storedSelection.connectionId) })
    .sync();
  invariant(connection, "未找到已选择的 AI 连接。");
  invariant(connection.isEnabled, "已选择的 AI 连接已被停用。");

  const resolvedModel = listResolvedModelsForConnection({
    connectionId: connection.id,
  }).find((model) => model.id === storedSelection.modelId);
  invariant(resolvedModel, "未找到已选择的 AI 模型。");
  invariant(resolvedModel.isEnabled, "已选择的 AI 模型已被停用。");

  return {
    storedSelection,
    connection,
    resolvedModel,
    snapshot: {
      connectionId: connection.id,
      catalogModelId: resolvedModel.catalogModelId,
      customModelId: resolvedModel.customModelId,
      connectionName: connection.name,
      sdkPackage: connection.sdkPackage,
      baseUrl: connection.baseUrl,
      modelOrigin: resolvedModel.origin,
      modelId: resolvedModel.modelId,
      modelDisplayName: resolvedModel.displayName,
      modelFamily: resolvedModel.family,
      capabilities: {
        supportsVision: resolvedModel.supportsVision,
        supportsToolUse: resolvedModel.supportsToolUse,
        supportsReasoning: resolvedModel.supportsReasoning,
        supportsTemperature: resolvedModel.supportsTemperature,
      },
      pricing: {
        inputPricePer1m: resolvedModel.inputPricePer1m,
        outputPricePer1m: resolvedModel.outputPricePer1m,
      },
    },
  };
}

function buildUserTextMessage(text: string): ModelMessage {
  return {
    role: "user",
    content: [{ type: "text", text }],
  };
}

function extractAssistantText(node: AgentThreadNodeView | null) {
  if (!node) {
    return null;
  }
  const content = (node.message as { content?: unknown }).content;
  if (typeof content === "string") {
    return content.trim();
  }
  if (!Array.isArray(content)) {
    return null;
  }
  const text = content
    .flatMap((part) => {
      if (!part || typeof part !== "object") {
        return [];
      }
      return Reflect.get(part as Record<string, unknown>, "type") === "text"
        ? [Reflect.get(part as Record<string, unknown>, "text")]
        : [];
    })
    .find((value): value is string => typeof value === "string" && value.trim().length > 0);
  return text?.trim() ?? null;
}

function summarizeToolCall(toolCall: Record<string, unknown>) {
  const toolName = Reflect.get(toolCall, "toolName");
  return typeof toolName === "string" ? `调用工具：${toolName}` : "调用工具";
}

function summarizeToolResult(toolResult: Record<string, unknown>) {
  const toolName = Reflect.get(toolResult, "toolName");
  const toolCallId = Reflect.get(toolResult, "toolCallId");
  const output = Reflect.get(toolResult, "output");
  const isError =
    output &&
    typeof output === "object" &&
    Reflect.get(output as Record<string, unknown>, "ok") === false;
  const prefix = typeof toolName === "string" ? toolName : "工具";
  const suffix = isError ? "失败" : "完成";
  const detail = typeof toolCallId === "string" ? ` (${toolCallId})` : "";
  return `${prefix}${detail}${suffix}`;
}

function areModelMessagesEquivalent(left: ModelMessage, right: ModelMessage) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function diffStepResponseMessages(
  previousMessages: ModelMessage[],
  currentMessages: ModelMessage[],
) {
  let sharedPrefixLength = 0;
  const maxPrefixLength = Math.min(previousMessages.length, currentMessages.length);

  while (
    sharedPrefixLength < maxPrefixLength &&
    areModelMessagesEquivalent(
      previousMessages[sharedPrefixLength]!,
      currentMessages[sharedPrefixLength]!,
    )
  ) {
    sharedPrefixLength += 1;
  }

  if (sharedPrefixLength === previousMessages.length) {
    return {
      deltaMessages: currentMessages.slice(sharedPrefixLength),
      nextMessages: currentMessages,
    };
  }

  // Some providers/tools may already expose per-step deltas instead of cumulative
  // response messages. In that case, preserve the raw step payload as-is and append
  // only the current step's messages into the thread graph.
  return {
    deltaMessages: currentMessages,
    nextMessages: previousMessages.concat(currentMessages),
  };
}

async function persistRunExecution({
  run,
  thread,
  system,
  result,
}: {
  run: AgentRunView;
  thread: AgentThreadView;
  system: string;
  result: GenerateAssistantTextResult;
}) {
  let currentParentId = run.baseTipNodeId;
  let lastAssistantNode: AgentThreadNodeView | null = null;
  let materializedResponseMessages: ModelMessage[] = [];

  for (const step of result.steps) {
    const preparedMessagesArtifact = createArtifact({
      runId: run.id,
      artifactKind: "prepared-model-messages",
      visibility: "internal",
      content: result.preparedMessagesByStep[step.stepNumber] ?? [],
      summaryText: `step ${step.stepNumber} 输入消息`,
    });
    const responseMessagesArtifact = createArtifact({
      runId: run.id,
      artifactKind: "response-messages",
      visibility: "internal",
      content: step.response.messages,
      summaryText: `step ${step.stepNumber} 响应消息`,
    });
    const requestBodyArtifact = createArtifact({
      runId: run.id,
      artifactKind: "request-body",
      visibility: "internal",
      content: step.request.body ?? null,
      summaryText: `step ${step.stepNumber} provider request`,
    });
    const responseBodyArtifact = createArtifact({
      runId: run.id,
      artifactKind: "response-body",
      visibility: "internal",
      content: step.response.body ?? null,
      summaryText: `step ${step.stepNumber} provider response`,
    });
    const providerMetadataArtifact = createArtifact({
      runId: run.id,
      artifactKind: "provider-metadata",
      visibility: "internal",
      content: step.providerMetadata ?? null,
      summaryText: `step ${step.stepNumber} provider metadata`,
    });

    const stepRecord = createRunStep({
      runId: run.id,
      stepIndex: step.stepNumber,
      provider: step.model.provider,
      modelId: step.model.modelId,
      finishReason: step.finishReason ?? null,
      rawFinishReason: step.rawFinishReason ?? null,
      system,
      preparedMessagesArtifactId: preparedMessagesArtifact.id,
      responseMessagesArtifactId: responseMessagesArtifact.id,
      requestBodyArtifactId: requestBodyArtifact.id,
      responseBodyArtifactId: responseBodyArtifact.id,
      providerMetadataArtifactId: providerMetadataArtifact.id,
      usage: step.usage ?? null,
    });

    appendRunEvent({
      runId: run.id,
      stepId: stepRecord.id,
      eventKind: "step-started",
      summaryText: `step ${step.stepNumber} started`,
    });
    appendRunEvent({
      runId: run.id,
      stepId: stepRecord.id,
      eventKind: "provider-requested",
      summaryText: `step ${step.stepNumber} provider request`,
      payloadArtifactId: requestBodyArtifact.id,
    });
    appendRunEvent({
      runId: run.id,
      stepId: stepRecord.id,
      eventKind: "provider-responded",
      summaryText: `step ${step.stepNumber} provider response`,
      payloadArtifactId: responseBodyArtifact.id,
    });

    step.toolCalls.forEach((toolCall) => {
      const payloadArtifact = createArtifact({
        runId: run.id,
        stepId: stepRecord.id,
        artifactKind: "tool-input",
        visibility: "internal",
        content: toolCall,
        summaryText: summarizeToolCall(toolCall),
      });
      appendRunEvent({
        runId: run.id,
        stepId: stepRecord.id,
        eventKind: "tool-call-started",
        relatedToolCallId:
          typeof Reflect.get(toolCall, "toolCallId") === "string"
            ? (Reflect.get(toolCall, "toolCallId") as string)
            : null,
        summaryText: summarizeToolCall(toolCall),
        payloadArtifactId: payloadArtifact.id,
      });
    });

    step.toolResults.forEach((toolResult) => {
      const payloadArtifact = createArtifact({
        runId: run.id,
        stepId: stepRecord.id,
        artifactKind: "tool-output",
        visibility: "internal",
        content: toolResult,
        summaryText: summarizeToolResult(toolResult),
      });
      const output = Reflect.get(toolResult, "output");
      const eventKind =
        output &&
        typeof output === "object" &&
        Reflect.get(output as Record<string, unknown>, "ok") === false
          ? "tool-call-failed"
          : "tool-call-finished";
      appendRunEvent({
        runId: run.id,
        stepId: stepRecord.id,
        eventKind,
        relatedToolCallId:
          typeof Reflect.get(toolResult, "toolCallId") === "string"
            ? (Reflect.get(toolResult, "toolCallId") as string)
            : null,
        summaryText: summarizeToolResult(toolResult),
        payloadArtifactId: payloadArtifact.id,
      });
    });

    const { deltaMessages, nextMessages } = diffStepResponseMessages(
      materializedResponseMessages,
      step.response.messages,
    );
    materializedResponseMessages = nextMessages;

    if (deltaMessages.length > 0) {
      const materialized = materializeResponseMessages({
        threadId: thread.id,
        parentNodeId: currentParentId,
        runId: run.id,
        stepId: stepRecord.id,
        messages: deltaMessages,
      });
      materialized.nodes.forEach((node) => {
        appendRunEvent({
          runId: run.id,
          stepId: stepRecord.id,
          eventKind: "node-materialized",
          nodeId: node.id,
          summaryText: node.summaryText ?? `${node.role} node`,
        });
        if (node.role === "assistant" && extractAssistantText(node)) {
          lastAssistantNode = node;
        }
      });
      currentParentId = materialized.tipNodeId;
    }
  }

  if (currentParentId) {
    selectActiveTip(thread.id, currentParentId);
    appendRunEvent({
      runId: run.id,
      eventKind: "active-tip-moved",
      nodeId: currentParentId,
      summaryText: "切换到新的 active tip",
    });
  }

  const completedRun = markRunSucceeded(run.id);
  appendRunEvent({
    runId: run.id,
    eventKind: "run-succeeded",
    summaryText: completedRun.completedAt ? "run succeeded" : "run completed",
  });

  return {
    run: completedRun,
    tipNodeId: currentParentId,
    lastAssistantNode,
  };
}

function assertNoPendingRunForThread(thread: AgentThreadView) {
  invariant(!hasPendingRun(thread.id), "当前会话正在生成回复，请稍后再试。");
}

export function createProjectAssistantService(
  dependencies: Partial<ProjectAssistantDependencies> = {},
) {
  const generateAssistantTextImpl =
    dependencies.generateAssistantText ?? defaultGenerateAssistantText;
  const readStoredSelection = dependencies.readStoredSelection ?? getAiAssistantModelSelection;

  return {
    getProjectAssistantState(projectId: string): ProjectAssistantOverview {
      const threads = listThreads(projectId, {
        agentProfile: PROJECT_ASSISTANT_AGENT_PROFILE,
      });
      const activeThread = resolveActiveThread(projectId, PROJECT_ASSISTANT_AGENT_PROFILE);
      return {
        activeThreadId: activeThread?.id ?? null,
        threads,
        state: activeThread
          ? getThreadView(activeThread.id)
          : { thread: null, activePath: [], candidateGroups: [], latestRuns: [] },
      };
    },

    createProjectAssistantThread(projectId: string) {
      return createThread({
        projectId,
        agentProfile: PROJECT_ASSISTANT_AGENT_PROFILE,
      });
    },

    setProjectAssistantActiveThread(projectId: string, threadId: string) {
      return setActiveThread(projectId, threadId);
    },

    renameProjectAssistantThread(threadId: string, title: string) {
      return renameThread(threadId, title);
    },

    archiveProjectAssistantThread(threadId: string, archived: boolean) {
      return archiveThread(threadId, archived);
    },

    getThreadView(threadId: string) {
      return getThreadView(threadId);
    },

    getRunTrace(runId: string): AgentRunTraceView {
      return getRunTrace(runId);
    },

    getNodeCandidates(parentNodeId: string) {
      return getNodeCandidates(parentNodeId);
    },

    getChildRuns(runId: string) {
      return listChildRuns(runId);
    },

    selectThreadTip(threadId: string, tipNodeId: string) {
      return selectActiveTip(threadId, tipNodeId);
    },

    async sendProjectAssistantMessage({
      projectId,
      threadId,
      text,
      context,
    }: {
      projectId: string;
      threadId: string;
      text: string;
      context?: ProjectAssistantContextSnapshot | null;
    }): Promise<ProjectAssistantSendResult> {
      const selection = resolveProjectAssistantModelSelection(readStoredSelection);
      const normalizedContext = normalizeAssistantContextSnapshot(context);
      const toolMode = selection.resolvedModel.supportsToolUse ? "auto-read-only" : "none";
      const threadView = getThreadView(threadId);
      const thread = threadView.thread;
      invariant(thread, "未找到当前会话。");
      invariant(thread.projectId === projectId, "AI 会话不属于当前项目。");
      invariant(thread.archivedAt == null, "不能向已归档会话发送消息。");
      assertNoPendingRunForThread(thread);

      const normalizedText = normalizeUserText(text);
      const userNode = appendUserNode({
        threadId: thread.id,
        parentNodeId: thread.activeTipNodeId,
        message: buildUserTextMessage(normalizedText),
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
      });
      appendRunEvent({
        runId: run.id,
        eventKind: "run-started",
        nodeId: userNode.id,
        summaryText: "用户消息触发新 run",
      });

      try {
        const result = await generateAssistantTextImpl({
          projectId,
          connection: selection.connection,
          modelId: selection.resolvedModel.modelId,
          system: buildProjectAssistantSystemPrompt({
            toolMode,
            context: normalizedContext,
          }),
          toolMode,
          context: normalizedContext,
          messages: buildThreadModelMessages(thread.id, userNode.id),
        });

        const persisted = await persistRunExecution({
          run,
          thread,
          system: buildProjectAssistantSystemPrompt({
            toolMode,
            context: normalizedContext,
          }),
          result,
        });

        return {
          thread: getThreadView(thread.id).thread!,
          userNode,
          assistantNode: persisted.lastAssistantNode,
          run: persisted.run,
          state: getThreadView(thread.id),
        };
      } catch (error) {
        const errorArtifact = createArtifact({
          runId: run.id,
          artifactKind: "error",
          visibility: "internal",
          content: normalizeError(error),
          summaryText: error instanceof Error ? error.message : "run failed",
        });
        const failedRun = markRunFailed(run.id, errorArtifact.id);
        appendRunEvent({
          runId: failedRun.id,
          eventKind: "run-failed",
          nodeId: userNode.id,
          summaryText: error instanceof Error ? error.message : "run failed",
          payloadArtifactId: errorArtifact.id,
        });
        throw error;
      }
    },

    async retryProjectAssistantMessage({
      projectId,
      threadId,
      triggerNodeId,
      context,
    }: {
      projectId: string;
      threadId: string;
      triggerNodeId: string;
      context?: ProjectAssistantContextSnapshot | null;
    }): Promise<ProjectAssistantRetryResult> {
      const selection = resolveProjectAssistantModelSelection(readStoredSelection);
      const normalizedContext = normalizeAssistantContextSnapshot(context);
      const toolMode = selection.resolvedModel.supportsToolUse ? "auto-read-only" : "none";
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
      });
      appendRunEvent({
        runId: run.id,
        eventKind: "run-started",
        nodeId: triggerNodeId,
        summaryText: "重试 assistant 候选",
      });

      try {
        const result = await generateAssistantTextImpl({
          projectId,
          connection: selection.connection,
          modelId: selection.resolvedModel.modelId,
          system: buildProjectAssistantSystemPrompt({
            toolMode,
            context: normalizedContext,
          }),
          toolMode,
          context: normalizedContext,
          messages: buildThreadModelMessages(thread.id, triggerNodeId),
        });

        const persisted = await persistRunExecution({
          run,
          thread,
          system: buildProjectAssistantSystemPrompt({
            toolMode,
            context: normalizedContext,
          }),
          result,
        });

        return {
          thread: getThreadView(thread.id).thread!,
          assistantNode: persisted.lastAssistantNode,
          run: persisted.run,
          state: getThreadView(thread.id),
        };
      } catch (error) {
        const errorArtifact = createArtifact({
          runId: run.id,
          artifactKind: "error",
          visibility: "internal",
          content: normalizeError(error),
          summaryText: error instanceof Error ? error.message : "retry failed",
        });
        const failedRun = markRunFailed(run.id, errorArtifact.id);
        appendRunEvent({
          runId: failedRun.id,
          eventKind: "run-failed",
          nodeId: triggerNodeId,
          summaryText: error instanceof Error ? error.message : "retry failed",
          payloadArtifactId: errorArtifact.id,
        });
        throw error;
      }
    },

    async editProjectAssistantMessage({
      projectId,
      threadId,
      nodeId,
      text,
      context,
    }: {
      projectId: string;
      threadId: string;
      nodeId: string;
      text: string;
      context?: ProjectAssistantContextSnapshot | null;
    }): Promise<ProjectAssistantEditResult> {
      const selection = resolveProjectAssistantModelSelection(readStoredSelection);
      const normalizedContext = normalizeAssistantContextSnapshot(context);
      const toolMode = selection.resolvedModel.supportsToolUse ? "auto-read-only" : "none";
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
      });
      appendRunEvent({
        runId: run.id,
        eventKind: "run-started",
        nodeId: replacementNode.id,
        summaryText: "编辑消息并重新生成",
      });

      try {
        const result = await generateAssistantTextImpl({
          projectId,
          connection: selection.connection,
          modelId: selection.resolvedModel.modelId,
          system: buildProjectAssistantSystemPrompt({
            toolMode,
            context: normalizedContext,
          }),
          toolMode,
          context: normalizedContext,
          messages: buildThreadModelMessages(thread.id, replacementNode.id),
        });
        const persisted = await persistRunExecution({
          run,
          thread,
          system: buildProjectAssistantSystemPrompt({
            toolMode,
            context: normalizedContext,
          }),
          result,
        });

        return {
          thread: getThreadView(thread.id).thread!,
          replacementNode,
          assistantNode: persisted.lastAssistantNode,
          run: persisted.run,
          state: getThreadView(thread.id),
        };
      } catch (error) {
        const errorArtifact = createArtifact({
          runId: run.id,
          artifactKind: "error",
          visibility: "internal",
          content: normalizeError(error),
          summaryText: error instanceof Error ? error.message : "edit regenerate failed",
        });
        const failedRun = markRunFailed(run.id, errorArtifact.id);
        appendRunEvent({
          runId: failedRun.id,
          eventKind: "run-failed",
          nodeId: replacementNode.id,
          summaryText: error instanceof Error ? error.message : "edit regenerate failed",
          payloadArtifactId: errorArtifact.id,
        });
        throw error;
      }
    },
  };
}

export type ProjectAssistantService = ReturnType<typeof createProjectAssistantService>;

let activeProjectAssistantService: ProjectAssistantService = createProjectAssistantService();

export function getProjectAssistantService() {
  return activeProjectAssistantService;
}

export function setProjectAssistantServiceForTests(service: ProjectAssistantService) {
  activeProjectAssistantService = service;
}
