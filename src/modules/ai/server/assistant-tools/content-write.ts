import { tool } from "ai";

import {
  createContentNode,
  deleteContentNode,
  moveContentNode,
  updateContentNode,
} from "@/modules/workspace/domain";

import type { ToolBuildContext, ContentWriteToolName } from "./_shared";
import { failure, getWorkspaceForProject, jsonSchema, withEnvelope } from "./_shared";

export function buildContentWriteTools({ projectId }: ToolBuildContext) {
  return {
    create_content_node: tool({
      description:
        "在正文树中创建一个新的章节节点。若省略 afterSiblingId 则插入为父节点的第一个子节点。",
      inputSchema: jsonSchema<{
        parentId: string;
        afterSiblingId?: string;
        title?: string;
        body?: string;
      }>({
        type: "object",
        required: ["parentId"],
        properties: {
          parentId: {
            type: "string",
            description: "父正文节点 ID，新节点将作为其子节点。",
          },
          afterSiblingId: {
            type: "string",
            description: "插入到该兄弟节点之后。省略时新节点将成为父节点的第一个子节点。",
          },
          title: {
            type: "string",
            description: "章节标题。",
          },
          body: {
            type: "string",
            description: "章节正文内容。",
          },
        },
      }),
      execute: async ({ parentId, afterSiblingId, title, body }) => {
        const workspace = getWorkspaceForProject(projectId);
        if (!workspace) {
          return failure(new Error("当前项目没有默认工作区。"));
        }

        return withEnvelope(() => {
          const node = createContentNode({
            workspaceId: workspace.id,
            parentId,
            afterSiblingId: afterSiblingId ?? undefined,
            title: title ?? undefined,
            body: body ?? undefined,
          });

          return {
            ok: true,
            truncated: false,
            data: {
              action: "created" as const,
              nodeId: node.id,
              parentId: node.parentId,
            },
          };
        });
      },
    }),
    update_content_node: tool({
      description: "更新正文节点的标题、正文、类型或锚定时间点。省略的字段不做修改。",
      inputSchema: jsonSchema<{
        nodeId: string;
        title?: string;
        body?: string;
        anchorPointId?: string;
      }>({
        type: "object",
        required: ["nodeId"],
        properties: {
          nodeId: {
            type: "string",
            description: "要更新的正文节点 ID。",
          },
          title: {
            type: "string",
            description: "新的章节标题，传 null 可清除。",
          },
          body: {
            type: "string",
            description: "新的正文内容，传 null 可清除。",
          },
          anchorPointId: {
            type: "string",
            description: "新的锚定时间点 ID。",
          },
        },
      }),
      execute: async ({ nodeId, title, body, anchorPointId }) => {
        const workspace = getWorkspaceForProject(projectId);
        if (!workspace) {
          return failure(new Error("当前项目没有默认工作区。"));
        }

        return withEnvelope(() => {
          const node = updateContentNode({
            workspaceId: workspace.id,
            nodeId,
            title: title === undefined ? undefined : (title ?? null),
            body: body === undefined ? undefined : (body ?? null),
            anchorPointId: anchorPointId ?? undefined,
          });

          return {
            ok: true,
            truncated: false,
            data: {
              action: "updated" as const,
              nodeId: node.id,
            },
          };
        });
      },
    }),
    move_content_node: tool({
      description:
        "移动或重排序正文节点。将节点移动到新的父节点下，可选地插入到指定兄弟节点之后。若省略 afterSiblingId 则插入为新父节点的第一个子节点。",
      inputSchema: jsonSchema<{
        nodeId: string;
        newParentId: string;
        afterSiblingId?: string;
      }>({
        type: "object",
        required: ["nodeId", "newParentId"],
        properties: {
          nodeId: {
            type: "string",
            description: "要移动的正文节点 ID。",
          },
          newParentId: {
            type: "string",
            description: "新父正文节点 ID。",
          },
          afterSiblingId: {
            type: "string",
            description: "移动后插入到该兄弟节点之后。省略时新节点将成为新父节点的第一个子节点。",
          },
        },
      }),
      execute: async ({ nodeId, newParentId, afterSiblingId }) => {
        const workspace = getWorkspaceForProject(projectId);
        if (!workspace) {
          return failure(new Error("当前项目没有默认工作区。"));
        }

        return withEnvelope(() => {
          const node = moveContentNode({
            workspaceId: workspace.id,
            nodeId,
            newParentId,
            afterSiblingId: afterSiblingId ?? undefined,
          });

          return {
            ok: true,
            truncated: false,
            data: {
              action: "moved" as const,
              nodeId: node.id,
              newParentId: node.parentId,
            },
          };
        });
      },
    }),
    delete_content_node: tool({
      description: "删除正文节点。注意：删除非叶节点会连同所有子节点一起删除，此操作不可逆。",
      inputSchema: jsonSchema<{ nodeId: string }>({
        type: "object",
        required: ["nodeId"],
        properties: {
          nodeId: {
            type: "string",
            description: "要删除的正文节点 ID。",
          },
        },
      }),
      execute: async ({ nodeId }) => {
        const workspace = getWorkspaceForProject(projectId);
        if (!workspace) {
          return failure(new Error("当前项目没有默认工作区。"));
        }

        return withEnvelope(() => {
          deleteContentNode({
            workspaceId: workspace.id,
            nodeId,
          });

          return {
            ok: true,
            truncated: false,
            data: {
              action: "deleted" as const,
              nodeId,
            },
          };
        });
      },
    }),
  } satisfies Record<ContentWriteToolName, unknown>;
}
