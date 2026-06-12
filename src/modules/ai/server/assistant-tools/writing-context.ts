import { tool } from "ai";

import { composeWritingContext } from "@/modules/workspace/domain";
import type { WritingContext } from "@/modules/workspace/domain/types";

import type { ToolBuildContext, WritingContextToolName } from "./_shared";
import {
  CONTENT_SUBTREE_NODE_LIMIT,
  WRITING_CONTEXT_AUX_LIMIT,
  failure,
  getWorkspaceForProject,
  jsonSchema,
  limitAuxNodes,
  limitContentNode,
  resolveActiveContentNodeId,
  withEnvelope,
} from "./_shared";
import type { AssistantToolSuccess } from "./_shared";

export function buildWritingContextTools({ projectId, context }: ToolBuildContext) {
  return {
    read_current_writing_context: tool({
      description:
        "读取当前正文节点的写作上下文，包括当前正文节点、其锚定时间点，以及该时间点下可见的辅助资料快照。",
      inputSchema: jsonSchema<{ contentNodeId?: string }>({
        type: "object",
        properties: {
          contentNodeId: {
            type: "string",
            description: "要读取写作上下文的正文节点 ID。省略时默认使用当前选中的正文节点。",
          },
        },
      }),
      execute: async ({ contentNodeId }) => {
        const workspace = getWorkspaceForProject(projectId);
        if (!workspace) {
          return failure(new Error("当前项目没有默认工作区。"));
        }

        return withEnvelope(() => {
          const targetContentNodeId =
            contentNodeId ?? resolveActiveContentNodeId(context, workspace.contentRootId);
          if (!targetContentNodeId) {
            throw new Error("当前没有可读取的正文节点。");
          }

          const writingContext = composeWritingContext(workspace.id, targetContentNodeId);
          const contentState = {
            remaining: CONTENT_SUBTREE_NODE_LIMIT,
            truncated: false,
          };
          const contentNode = limitContentNode(writingContext.contentNode, contentState);
          if (!contentNode) {
            throw new Error("当前正文节点没有可读取内容。");
          }
          const auxSnapshot = limitAuxNodes(writingContext.auxSnapshot, WRITING_CONTEXT_AUX_LIMIT);

          return {
            ok: true,
            truncated: contentState.truncated || auxSnapshot.truncated,
            data: {
              contentNode,
              timelinePointId: writingContext.timelinePointId,
              auxSnapshot: auxSnapshot.nodes,
            },
          } satisfies AssistantToolSuccess<WritingContext>;
        });
      },
    }),
  } satisfies Record<WritingContextToolName, unknown>;
}
