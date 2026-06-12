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
    list_reference_dir: tool({
      description:
        "列出当前时间点可见的参考资料目录。用于先查看有哪些设定/素材文件；省略 path 时读取参考资料根目录。",
      inputSchema: jsonSchema<{ path?: string }>({
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "参考资料目录绝对路径。省略时读取根目录 /。",
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
    read_reference_path: tool({
      description:
        "读取当前时间点可见的参考资料节点。用于查看具体设定/素材内容；省略 path 时读取当前选中的参考资料路径。",
      inputSchema: jsonSchema<{ path?: string }>({
        type: "object",
        properties: {
          path: {
            type: "string",
            description:
              "参考资料绝对路径。省略时使用当前选中的参考资料路径；没有选中路径时会失败。",
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
