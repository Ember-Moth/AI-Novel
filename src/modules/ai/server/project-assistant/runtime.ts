import type { ModelMessage } from "ai";

import type {
  AssistantInputRefSnapshot,
  ProjectAssistantContextSnapshot,
  ProjectAssistantToolName,
} from "@/modules/ai/domain/types";
import {
  PROJECT_ASSISTANT_READ_ONLY_TOOL_NAMES,
  PROJECT_ASSISTANT_TOOL_NAMES,
} from "@/modules/ai/domain/types";
import { invariant } from "@/shared/lib/domain";

import type { ToolRuntimeContext } from "../assistant-tools/context";

export const PROJECT_ASSISTANT_SYSTEM_PROMPT_ID = "writing-assistant-v3";

const PROJECT_ASSISTANT_SYSTEM_PROMPT = [
  "你是一个小说写作助手。",
  "时间锚点（timeline points）是上下文切分机制：每个锚点代表故事中世界状态发生重大变化的关键时刻。一个锚点可跨越多个章节/场景——无需每章都创建锚点。切换锚点会改变辅助资料读写的可见范围。",
  "回答要直接、具体、可执行，优先帮助作者推进写作。",
  "仅在当前请求实际启用了工具且确有必要时才调用工具。",
  "如果需要了解当前编辑位置、当前正文、辅助资料或当前时间锚点，请调用当前项目中的上下文或读取工具获取，不要自行假设。",
  "写入工具只在用户明确要求修改项目内容时使用。",
  "调用正文树写入工具前先确认层级：parentId/newParentId 是容纳新节点或移动节点的父节点；afterSiblingId 是同一父节点下的前一个兄弟节点。顶层可传 null、省略该字段，或传空字符串。二者不能互相代替。",
  "严禁编造未实际读取到的项目数据。",
  "最终只输出给作者看的纯文本答复，不要暴露结构化协议或 JSON。",
].join("\n");

export function createToolRuntimeContext(
  snapshot: ProjectAssistantContextSnapshot | null,
): ToolRuntimeContext {
  let currentSnapshot = snapshot;
  return {
    get snapshot() {
      return currentSnapshot;
    },
    updateSnapshot(updater) {
      currentSnapshot = updater(currentSnapshot);
    },
  };
}

function normalizeOptionalString(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeProjectAssistantActiveTools(
  activeTools: readonly ProjectAssistantToolName[] | null | undefined,
) {
  if (activeTools == null) {
    return null;
  }

  const knownToolNames = new Set<string>(PROJECT_ASSISTANT_TOOL_NAMES);
  const seen = new Set<ProjectAssistantToolName>();
  const normalized: ProjectAssistantToolName[] = [];

  for (const value of activeTools) {
    invariant(
      typeof value === "string" && knownToolNames.has(value),
      `未知工具：${String(value)}。`,
    );
    const toolName = value as ProjectAssistantToolName;
    if (seen.has(toolName)) {
      continue;
    }
    seen.add(toolName);
    normalized.push(toolName);
  }

  return normalized;
}

export function normalizeAssistantContextSnapshot(
  context: ProjectAssistantContextSnapshot | null | undefined,
): ProjectAssistantContextSnapshot | null {
  if (!context) {
    return null;
  }

  return {
    workspaceId: normalizeOptionalString(context.workspaceId),
    activeContentNodeId: normalizeOptionalString(context.activeContentNodeId),
    activeContentTitle: normalizeOptionalString(context.activeContentTitle),
    activeAuxPath: normalizeOptionalString(context.activeAuxPath),
    activeTimelinePointId: normalizeOptionalString(context.activeTimelinePointId),
    activeTimelineLabel: normalizeOptionalString(context.activeTimelineLabel),
  };
}

export function buildProjectAssistantSystemPrompt() {
  return PROJECT_ASSISTANT_SYSTEM_PROMPT;
}

export function buildProjectAssistantContextMessage(
  context: ProjectAssistantContextSnapshot | null,
): ModelMessage | null {
  if (!context) {
    return null;
  }

  const fileReference =
    context.activeContentNodeId != null
      ? `正文节点 id=${context.activeContentNodeId}`
      : context.activeAuxPath != null
        ? `辅助路径=${context.activeAuxPath}`
        : null;
  const timelineReference =
    context.activeTimelinePointId != null
      ? `时间锚点 id=${context.activeTimelinePointId}${
          context.activeTimelineLabel != null ? `，label=${context.activeTimelineLabel}` : ""
        }`
      : null;
  const details = [fileReference, timelineReference].filter(
    (value): value is string => value != null,
  );

  if (details.length === 0) {
    return null;
  }

  return buildUserTextMessage(`当前编辑器：${details.join("；")}`);
}

export function buildProjectAssistantRefsMessage(
  refs: readonly AssistantInputRefSnapshot[] | null | undefined,
): ModelMessage | null {
  if (refs == null || refs.length === 0) {
    return null;
  }

  const blocks = refs.map((ref) => {
    invariant(ref.kind === "global-prompt", "当前只支持注入全局 Prompt 引用。");
    return [
      `<global_prompt id="${ref.snapshot.id}" name="${ref.snapshot.name}">`,
      ref.snapshot.content,
      "</global_prompt>",
    ].join("\n");
  });

  return buildUserTextMessage(`用户通过 @ 引用了以下全局 Prompt：\n\n${blocks.join("\n\n")}`);
}

export function resolveProjectAssistantActiveTools({
  selection,
  activeTools,
}: {
  selection: {
    resolvedModel: { supportsToolUse: boolean };
  };
  activeTools?: readonly ProjectAssistantToolName[] | null;
}) {
  const normalizedActiveTools =
    normalizeProjectAssistantActiveTools(activeTools) ??
    (selection.resolvedModel.supportsToolUse ? [...PROJECT_ASSISTANT_READ_ONLY_TOOL_NAMES] : []);
  if (normalizedActiveTools.length > 0) {
    invariant(
      selection.resolvedModel.supportsToolUse,
      "当前模型不支持工具调用，无法启用请求级工具。",
    );
  }
  return normalizedActiveTools;
}

export function normalizeError(error: unknown) {
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

export function buildUserTextMessage(text: string): ModelMessage {
  return {
    role: "user",
    content: [{ type: "text", text }],
  };
}
