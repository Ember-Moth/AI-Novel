import { tool } from "ai";

import { listAuxDirAt, readAuxByPathAt } from "@/modules/workspace/domain";

import type { ToolBuildContext, AuxReadToolName } from "./_shared";
import {
  AUX_DIR_ENTRY_LIMIT,
  failure,
  getWorkspaceForProject,
  jsonSchema,
  limitAuxNodes,
  resolveCurrentTimelinePointId,
  resolveActiveAuxPath,
  sanitizeAuxNode,
  withEnvelope,
} from "./_shared";

const REFERENCE_OVERLAY_READ_SEMANTICS =
  "参考资料按当前时间点形成叠加视图：原点放置全局初始设定，自定义时间点会继承更早时间点仍可见的目录、文件和链接。若需要改到别的时间点，请先调用 set_current_timeline。";

export function buildAuxReadTools({ projectId, runtimeContext }: ToolBuildContext) {
  return {
    list_files: tool({
      description: `${REFERENCE_OVERLAY_READ_SEMANTICS} 列出当前时间点可见的参考资料目录。用于先查看有哪些设定/素材文件；省略 path 时读取参考资料根目录 /。`,
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
          const resolvedTimelinePointId = resolveCurrentTimelinePointId(runtimeContext);
          const dirNodes = listAuxDirAt(workspace.id, resolvedTimelinePointId, {
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
    read_file: tool({
      description: `${REFERENCE_OVERLAY_READ_SEMANTICS} 读取当前时间点可见的参考资料节点。用于查看具体设定/素材内容；省略 path 时读取当前选中的参考资料路径。若要浏览目录，优先使用 list_files。`,
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
          const resolvedTimelinePointId = resolveCurrentTimelinePointId(runtimeContext);
          const resolvedPath = path ?? resolveActiveAuxPath(runtimeContext.snapshot);
          if (!resolvedPath) {
            throw new Error("当前没有可读取的辅助资料路径。");
          }

          const node = readAuxByPathAt(workspace.id, resolvedTimelinePointId, resolvedPath);
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
