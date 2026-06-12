import { tool } from "ai";

import { listAuxDirAt, readAuxByPathAt } from "@/modules/workspace/domain";

import type { ToolBuildContext, AuxReadToolName } from "./_shared";
import {
  AUX_DIR_ENTRY_LIMIT,
  failure,
  getWorkspaceForProject,
  jsonSchema,
  limitAuxNodes,
  resolveActiveAuxPath,
  resolveTimelinePointId,
  sanitizeAuxNode,
  withEnvelope,
} from "./_shared";

export function buildAuxReadTools({ projectId, context }: ToolBuildContext) {
  return {
    list_aux_dir: tool({
      description:
        "读取当前时间点下某个辅助资料目录的目录项摘要。省略路径时默认读取辅助资料根目录。",
      inputSchema: jsonSchema<{ path?: string }>({
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "辅助资料目录路径。省略时读取辅助资料根目录。",
          },
        },
      }),
      execute: async ({ path }) => {
        const workspace = getWorkspaceForProject(projectId);
        if (!workspace) {
          return failure(new Error("当前项目没有默认工作区。"));
        }

        return withEnvelope(() => {
          const dirNodes = listAuxDirAt(workspace.id, resolveTimelinePointId(context), {
            dirId: path ? undefined : (workspace.auxRootId ?? undefined),
            path: path ?? undefined,
          });
          const limited = limitAuxNodes(dirNodes, AUX_DIR_ENTRY_LIMIT);

          return {
            ok: true,
            truncated: limited.truncated,
            data: {
              path: path ?? "/",
              entries: limited.nodes.map((node) => ({
                id: node.id,
                nodeType: node.nodeType,
                name: node.name,
                path: node.path,
                parentAuxNodeId: node.parentAuxNodeId,
                timelinePointId: node.timelinePointId,
              })),
            },
          };
        });
      },
    }),
    read_aux_path: tool({
      description: "读取当前时间点下某个辅助资料路径对应的节点。",
      inputSchema: jsonSchema<{ path?: string }>({
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "辅助资料路径。省略时默认使用当前选中的辅助资料路径。",
          },
        },
      }),
      execute: async ({ path }) => {
        const workspace = getWorkspaceForProject(projectId);
        if (!workspace) {
          return failure(new Error("当前项目没有默认工作区。"));
        }

        return withEnvelope(() => {
          const resolvedPath = path ?? resolveActiveAuxPath(context);
          if (!resolvedPath) {
            throw new Error("当前没有可读取的辅助资料路径。");
          }

          const node = readAuxByPathAt(workspace.id, resolveTimelinePointId(context), resolvedPath);
          if (!node) {
            throw new Error("辅助资料不存在或在当前时间点不可见。");
          }

          const sanitized = sanitizeAuxNode(node);

          return {
            ok: true,
            truncated: sanitized.truncated,
            data: {
              path: resolvedPath,
              node: sanitized.node,
            },
          };
        });
      },
    }),
  } satisfies Record<AuxReadToolName, unknown>;
}
