import { generateText, stepCountIs } from "ai";
import { eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { listResolvedModelsForConnection } from "@/modules/ai/domain/catalog";
import {
  appendMessage,
  completeGenerationAttemptError,
  completeGenerationAttemptSuccess,
  getHeadOrThrowView,
  hasPendingGenerationAttempt,
  listHeadGenerationAttempts,
  recordGenerationAttempt,
  resolveActiveAssistantHead,
  resolveHeadMessages,
  setActiveAssistantHead,
} from "@/modules/ai/domain/logs";
import type {
  AiAssistantMessageMetadata,
  AiConnectionRow,
  AiProjectGenerationAttemptView,
  AiProjectHeadView,
  AiProjectMessageView,
  AiResolvedModelView,
  ProjectAssistantContextSnapshot,
  ProjectAssistantToolTraceEntry,
  AiSelectionSnapshotInput,
} from "@/modules/ai/domain/types";
import {
  getAiAssistantModelSelection,
  type AiAssistantModelSelection,
} from "@/modules/config/domain/ai-assistant-model-selection";
import { invariant } from "@/shared/lib/domain";

import { createAssistantReadOnlyTools } from "./assistant-tools";
import { createLanguageModelForConnection } from "./provider-factories";

export interface AiAssistantTextMessageContent {
  text: string;
}

export interface ProjectAssistantStateView {
  head: AiProjectHeadView | null;
  messages: AiProjectMessageView[];
  attempts: AiProjectGenerationAttemptView[];
}

export interface ProjectAssistantSendResult {
  head: AiProjectHeadView;
  userMessage: AiProjectMessageView;
  assistantMessage: AiProjectMessageView;
  attempt: AiProjectGenerationAttemptView;
}

export interface ProjectAssistantRetryResult {
  head: AiProjectHeadView;
  assistantMessage: AiProjectMessageView;
  attempt: AiProjectGenerationAttemptView;
}

export const PROJECT_ASSISTANT_SYSTEM_PROMPT_ID = "writing-assistant-v1";

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
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
}

interface GenerateAssistantTextResult {
  text: string;
  usage: unknown;
  finishReason: string | undefined;
  toolTrace: ProjectAssistantToolTraceEntry[];
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

  if (toolMode === "auto-read-only") {
    const tools = createAssistantReadOnlyTools({
      projectId,
      context,
    });

    return generateText({
      model,
      system,
      messages,
      tools,
      stopWhen: stepCountIs(5),
    }).then((result) => ({
      text: result.text,
      usage: result.totalUsage,
      finishReason: result.finishReason,
      toolTrace: collectToolTrace(result.steps),
    }));
  }

  return generateText({
    model,
    system,
    messages,
  }).then((result) => ({
    text: result.text,
    usage: result.totalUsage,
    finishReason: result.finishReason,
    toolTrace: [],
  }));
}

function getTextMessageContent(content: unknown): string {
  invariant(content != null && typeof content === "object", "AI 消息内容格式不支持。");
  const text = Reflect.get(content as Record<string, unknown>, "text");
  invariant(typeof text === "string", "AI 消息内容缺少文本字段。");
  return text;
}

function buildSummaryText(text: string) {
  const summary = text.trim().replace(/\s+/g, " ");
  return summary.length <= 80 ? summary : `${summary.slice(0, 80)}…`;
}

function normalizeUserText(text: string) {
  const normalized = text.trim();
  invariant(normalized.length > 0, "消息不能为空。");
  return normalized;
}

function normalizeAssistantText(text: string) {
  const normalized = text.trim();
  invariant(normalized.length > 0, "AI 没有返回可显示的文本。");
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

function buildToolTraceSummary({ toolName, output }: { toolName: string; output: unknown }) {
  const envelope =
    output && typeof output === "object" ? (output as Record<string, unknown>) : undefined;
  const ok = envelope?.ok === true;
  const data =
    envelope && typeof envelope.data === "object"
      ? (envelope.data as Record<string, unknown>)
      : undefined;
  const error = typeof envelope?.error === "string" ? envelope.error : null;

  if (!ok) {
    return {
      status: "error" as const,
      summary: error ? `${toolName} 失败：${error}` : `${toolName} 失败`,
    };
  }

  switch (toolName) {
    case "read_current_writing_context": {
      const contentNode =
        data?.contentNode && typeof data.contentNode === "object"
          ? (data.contentNode as Record<string, unknown>)
          : undefined;
      const title = typeof contentNode?.title === "string" ? contentNode.title : "当前正文";
      return {
        status: "success" as const,
        summary: `读取写作上下文：${title}`,
      };
    }
    case "read_content_subtree": {
      const rootNodeId = typeof data?.rootNodeId === "string" ? data.rootNodeId : null;
      return {
        status: "success" as const,
        summary: rootNodeId ? `读取正文子树：${rootNodeId}` : "读取正文结构",
      };
    }
    case "list_timeline_points": {
      const points = Array.isArray(data?.points) ? data.points : [];
      return {
        status: "success" as const,
        summary: `读取时间线：${points.length} 个时间点`,
      };
    }
    case "list_aux_dir": {
      const path = typeof data?.path === "string" ? data.path : "/";
      return {
        status: "success" as const,
        summary: `读取辅助目录：${path}`,
      };
    }
    case "read_aux_path": {
      const path = typeof data?.path === "string" ? data.path : "当前辅助资料";
      return {
        status: "success" as const,
        summary: `读取辅助资料：${path}`,
      };
    }
    default:
      return {
        status: "success" as const,
        summary: `调用工具：${toolName}`,
      };
  }
}

function collectToolTrace(
  steps: Array<{
    toolResults: Array<{
      toolName: string;
      output: unknown;
    }>;
  }>,
): ProjectAssistantToolTraceEntry[] {
  return steps.flatMap((step) =>
    step.toolResults.map((toolResult) => {
      const summary = buildToolTraceSummary({
        toolName: toolResult.toolName,
        output: toolResult.output,
      });
      return {
        toolName: toolResult.toolName,
        summary: summary.summary,
        status: summary.status,
      };
    }),
  );
}

function buildAssistantMessageMetadata({
  finishReason,
  toolTrace,
}: {
  finishReason: string | undefined;
  toolTrace: ProjectAssistantToolTraceEntry[];
}): AiAssistantMessageMetadata | undefined {
  const metadata: AiAssistantMessageMetadata = {};

  if (finishReason) {
    metadata.finishReason = finishReason;
  }
  if (toolTrace.length > 0) {
    metadata.toolTrace = toolTrace;
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
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

function getHeadState(head: AiProjectHeadView | null): ProjectAssistantStateView {
  if (!head) {
    return {
      head: null,
      messages: [],
      attempts: [],
    };
  }

  return {
    head,
    messages: resolveHeadMessages(head.id),
    attempts: listHeadGenerationAttempts(head.id),
  };
}

function toPromptMessages(messages: AiProjectMessageView[]) {
  return messages.map((message) => {
    invariant(message.role !== "tool", "当前版本不支持包含工具消息的对话。");
    return {
      role: message.role,
      content: getTextMessageContent(message.content),
    };
  });
}

function buildAttemptRequest({
  mode,
  headId,
  triggerMessageId,
  selection,
  toolMode,
  context,
}: {
  mode: "send" | "retry";
  headId: string;
  triggerMessageId: string;
  selection: AssistantModelSelection;
  toolMode: "none" | "auto-read-only";
  context: ProjectAssistantContextSnapshot | null;
}) {
  return {
    mode,
    triggerMessageId,
    headId,
    systemPromptId: PROJECT_ASSISTANT_SYSTEM_PROMPT_ID,
    toolMode,
    contextMode: context ? ("editor-selection" as const) : ("none" as const),
    contextSnapshot: context,
    modelSelection: {
      connectionId: selection.connection.id,
      resolvedModelId: selection.storedSelection.modelId,
      providerModelId: selection.resolvedModel.modelId,
      modelOrigin: selection.resolvedModel.origin,
    },
  };
}

function assertNoPendingAttempt(head: AiProjectHeadView) {
  invariant(!hasPendingGenerationAttempt(head.id), "当前会话正在生成回复，请稍后再试。");
}

export function createProjectAssistantService(
  dependencies: Partial<ProjectAssistantDependencies> = {},
) {
  const generateAssistantTextImpl =
    dependencies.generateAssistantText ?? defaultGenerateAssistantText;
  const readStoredSelection = dependencies.readStoredSelection ?? getAiAssistantModelSelection;

  return {
    getProjectAssistantState(projectId: string): ProjectAssistantStateView {
      return getHeadState(resolveActiveAssistantHead(projectId));
    },

    async sendProjectAssistantMessage({
      projectId,
      headId,
      text,
      context,
    }: {
      projectId: string;
      headId: string;
      text: string;
      context?: ProjectAssistantContextSnapshot | null;
    }): Promise<ProjectAssistantSendResult> {
      const selection = resolveProjectAssistantModelSelection(readStoredSelection);
      const normalizedContext = normalizeAssistantContextSnapshot(context);
      const toolMode = selection.resolvedModel.supportsToolUse ? "auto-read-only" : "none";
      const head = getHeadOrThrowView(headId);
      invariant(head.projectId === projectId, "AI 会话不属于当前项目。");
      invariant(!head.isArchived, "不能向已归档会话发送消息。");
      assertNoPendingAttempt(head);

      const normalizedText = normalizeUserText(text);
      const userMessage = appendMessage({
        projectId,
        headId: head.id,
        prevMessageId: head.currentMessageId,
        role: "user",
        content: { text: normalizedText },
        summaryText: buildSummaryText(normalizedText),
        aiSelection: selection.snapshot,
      });

      const attempt = recordGenerationAttempt({
        projectId,
        headId: head.id,
        triggerMessageId: userMessage.id,
        request: buildAttemptRequest({
          mode: "send",
          headId: head.id,
          triggerMessageId: userMessage.id,
          selection,
          toolMode,
          context: normalizedContext,
        }),
        aiSelection: selection.snapshot,
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
          messages: toPromptMessages(resolveHeadMessages(head.id)),
        });
        const assistantText = normalizeAssistantText(result.text);
        const assistantMessage = appendMessage({
          projectId,
          headId: head.id,
          prevMessageId: userMessage.id,
          role: "assistant",
          content: { text: assistantText },
          summaryText: buildSummaryText(assistantText),
          aiSelection: selection.snapshot,
          metadata: buildAssistantMessageMetadata({
            finishReason: result.finishReason,
            toolTrace: result.toolTrace,
          }),
        });
        const completedAttempt = completeGenerationAttemptSuccess({
          attemptId: attempt.id,
          assistantMessageId: assistantMessage.id,
          usage: result.usage,
        });
        const activeHead = setActiveAssistantHead(projectId, head.id);

        return {
          head: activeHead,
          userMessage,
          assistantMessage,
          attempt: completedAttempt,
        };
      } catch (error) {
        completeGenerationAttemptError({
          attemptId: attempt.id,
          error: normalizeError(error),
        });
        throw error;
      }
    },

    async retryProjectAssistantMessage({
      projectId,
      headId,
      triggerMessageId,
      context,
    }: {
      projectId: string;
      headId: string;
      triggerMessageId: string;
      context?: ProjectAssistantContextSnapshot | null;
    }): Promise<ProjectAssistantRetryResult> {
      const selection = resolveProjectAssistantModelSelection(readStoredSelection);
      const normalizedContext = normalizeAssistantContextSnapshot(context);
      const toolMode = selection.resolvedModel.supportsToolUse ? "auto-read-only" : "none";
      const head = getHeadOrThrowView(headId);
      invariant(head.projectId === projectId, "AI 会话不属于当前项目。");
      invariant(!head.isArchived, "不能重试已归档会话。");
      assertNoPendingAttempt(head);
      invariant(head.currentMessageId === triggerMessageId, "当前版本只能重试会话末尾的失败请求。");

      const messages = resolveHeadMessages(head.id);
      const triggerMessage = messages.at(-1);
      invariant(triggerMessage?.id === triggerMessageId, "未找到要重试的触发消息。");
      invariant(triggerMessage.role === "user", "当前版本只能重试用户消息的回复。");

      const attempt = recordGenerationAttempt({
        projectId,
        headId: head.id,
        triggerMessageId,
        request: buildAttemptRequest({
          mode: "retry",
          headId: head.id,
          triggerMessageId,
          selection,
          toolMode,
          context: normalizedContext,
        }),
        aiSelection: selection.snapshot,
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
          messages: toPromptMessages(messages),
        });
        const assistantText = normalizeAssistantText(result.text);
        const assistantMessage = appendMessage({
          projectId,
          headId: head.id,
          prevMessageId: triggerMessageId,
          role: "assistant",
          content: { text: assistantText },
          summaryText: buildSummaryText(assistantText),
          aiSelection: selection.snapshot,
          metadata: buildAssistantMessageMetadata({
            finishReason: result.finishReason,
            toolTrace: result.toolTrace,
          }),
        });
        const completedAttempt = completeGenerationAttemptSuccess({
          attemptId: attempt.id,
          assistantMessageId: assistantMessage.id,
          usage: result.usage,
        });
        const activeHead = setActiveAssistantHead(projectId, head.id);

        return {
          head: activeHead,
          assistantMessage,
          attempt: completedAttempt,
        };
      } catch (error) {
        completeGenerationAttemptError({
          attemptId: attempt.id,
          error: normalizeError(error),
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
