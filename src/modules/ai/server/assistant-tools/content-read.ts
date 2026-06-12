import { tool } from "ai";

import { exportContentSubtree } from "@/modules/workspace/domain";

import type { ToolBuildContext, ContentReadToolName } from "./_shared";
import {
  failure,
  getWorkspaceForProject,
  jsonSchema,
  limitContentSubtree,
  withEnvelope,
} from "./_shared";

export function buildContentReadTools({ projectId }: ToolBuildContext) {
  return {
    read_content_subtree: tool({
      description: "读取正文树中的一个节点及其子树，适合分析章节结构、层级和相邻正文内容。",
      inputSchema: jsonSchema<{ rootNodeId?: string }>({
        type: "object",
        properties: {
          rootNodeId: {
            type: "string",
            description: "要读取的正文根节点 ID。省略时默认读取整个正文树根。",
          },
        },
      }),
      execute: async ({ rootNodeId }) => {
        const workspace = getWorkspaceForProject(projectId);
        if (!workspace) {
          return failure(new Error("当前项目没有默认工作区。"));
        }

        return withEnvelope(() =>
          limitContentSubtree(exportContentSubtree(workspace.id, rootNodeId ?? undefined)),
        );
      },
    }),
  } satisfies Record<ContentReadToolName, unknown>;
}
