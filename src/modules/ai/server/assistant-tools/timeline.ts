import { tool } from "ai";

import { listTimelinePoints } from "@/modules/workspace/domain";

import type { ToolBuildContext, TimelineToolName } from "./_shared";
import {
  failure,
  getWorkspaceForProject,
  jsonSchema,
  limitTimelinePoints,
  withEnvelope,
} from "./_shared";

export function buildTimelineTools({ projectId }: ToolBuildContext) {
  return {
    list_timeline_points: tool({
      description: "读取当前项目默认工作区的时间线列表。",
      inputSchema: jsonSchema<Record<string, never>>({
        type: "object",
        additionalProperties: false,
      }),
      execute: async () => {
        const workspace = getWorkspaceForProject(projectId);
        if (!workspace) {
          return failure(new Error("当前项目没有默认工作区。"));
        }

        return withEnvelope(() => {
          const limited = limitTimelinePoints(listTimelinePoints(workspace.id));
          return {
            ok: true,
            truncated: limited.truncated,
            data: {
              points: limited.points,
            },
          };
        });
      },
    }),
  } satisfies Record<TimelineToolName, unknown>;
}
