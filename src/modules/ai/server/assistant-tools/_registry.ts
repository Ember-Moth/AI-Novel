import type {
  ProjectAssistantContextSnapshot,
  ProjectAssistantToolName,
} from "@/modules/ai/domain/types";

import { buildAuxReadTools } from "./aux-read";
import { buildAuxWriteTools } from "./aux-write";
import { buildContentReadTools } from "./content-read";
import { buildContentWriteTools } from "./content-write";
import type { ToolBuildContext } from "./_shared";
import { buildTimelineTools } from "./timeline";
import { buildWritingContextTools } from "./writing-context";

function buildAssistantToolRegistry({
  projectId,
  context,
}: {
  projectId: string;
  context: ProjectAssistantContextSnapshot | null;
}) {
  const ctx: ToolBuildContext = { projectId, context };

  return {
    ...buildWritingContextTools(ctx),
    ...buildContentReadTools(ctx),
    ...buildContentWriteTools(ctx),
    ...buildTimelineTools(ctx),
    ...buildAuxReadTools(ctx),
    ...buildAuxWriteTools(ctx),
  } satisfies Record<ProjectAssistantToolName, unknown>;
}

export function createAssistantTools({
  projectId,
  context,
  activeTools,
}: {
  projectId: string;
  context: ProjectAssistantContextSnapshot | null;
  activeTools: readonly ProjectAssistantToolName[];
}): Partial<Record<ProjectAssistantToolName, unknown>> {
  const registry = buildAssistantToolRegistry({ projectId, context });
  const tools: Partial<Record<ProjectAssistantToolName, unknown>> = {};

  for (const toolName of activeTools) {
    tools[toolName] = registry[toolName];
  }

  return tools;
}

export type AssistantToolSet = ReturnType<typeof createAssistantTools>;
