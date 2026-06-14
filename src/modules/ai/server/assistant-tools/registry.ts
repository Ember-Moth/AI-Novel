import type { ProjectAssistantToolName } from "@/modules/ai/domain/types";

import { buildInteractionTools } from "./ask-user";
import { buildAuxReadTools } from "./aux-read";
import { buildAuxWriteTools } from "./aux-write";
import { buildContentReadTools } from "./content-read";
import { buildContentWriteTools } from "./content-write";
import type { ToolBuildContext } from "./context";
import { buildTimelineTools } from "./timeline";

export function createAssistantTools({
  projectId,
  runtimeContext,
}: {
  projectId: string;
  runtimeContext: ToolBuildContext["runtimeContext"];
}) {
  const ctx: ToolBuildContext = { projectId, runtimeContext };

  return {
    ...buildInteractionTools(ctx),
    ...buildContentReadTools(ctx),
    ...buildContentWriteTools(ctx),
    ...buildTimelineTools(ctx),
    ...buildAuxReadTools(ctx),
    ...buildAuxWriteTools(ctx),
  } satisfies Record<ProjectAssistantToolName, unknown>;
}

export type AssistantToolSet = ReturnType<typeof createAssistantTools>;
