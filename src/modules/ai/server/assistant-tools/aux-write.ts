import { tool } from "ai";

import {
  deleteAuxNodeAt,
  linkAt,
  mkdirAt,
  moveAuxNodeAt,
  readAuxByPathAt,
  retargetAuxSymlinkAt,
  writeFileAt,
} from "@/modules/workspace/domain";

import type { ToolBuildContext, AuxWriteToolName } from "./_shared";
import {
  failure,
  getWorkspaceForProject,
  jsonSchema,
  resolveAuxNodeByPathOrThrow,
  resolveParentDirId,
  resolveTimelinePointId,
  splitAuxPath,
  withEnvelope,
} from "./_shared";
import { invariant } from "@/shared/lib/domain";

export function buildAuxWriteTools({ projectId, context }: ToolBuildContext) {
  return {
    mkdir_aux_dir: tool({
      description: "在当前时间点下创建一个辅助资料目录。只会创建目标路径的最后一级目录。",
      inputSchema: jsonSchema<{ path: string }>({
        type: "object",
        required: ["path"],
        properties: {
          path: {
            type: "string",
            description: "要创建的辅助资料目录绝对路径，例如 /设定/角色。",
          },
        },
      }),
      execute: async ({ path }) => {
        const workspace = getWorkspaceForProject(projectId);
        if (!workspace) {
          return failure(new Error("当前项目没有默认工作区。"));
        }

        return withEnvelope(() => {
          const timelinePointId = resolveTimelinePointId(context);
          const { normalizedPath, parentPath, name } = splitAuxPath(path, "创建辅助资料目录");
          const existing = readAuxByPathAt(workspace.id, timelinePointId, normalizedPath);
          invariant(existing == null, "创建辅助资料目录失败：目标路径已存在。");

          const parentDirId = resolveParentDirId({
            workspaceId: workspace.id,
            timelinePointId,
            auxRootId: workspace.auxRootId,
            parentPath,
            actionLabel: "创建辅助资料目录",
          });
          const node = mkdirAt({
            workspaceId: workspace.id,
            timelinePointId,
            parentDirId,
            name,
          });

          return {
            ok: true,
            truncated: false,
            data: {
              action: "created",
              path: normalizedPath,
              nodeId: node.id,
            },
          };
        });
      },
    }),
    write_aux_file: tool({
      description:
        "在当前时间点下创建或覆盖一个辅助资料文件。若文件已存在则整文件覆盖；若不存在则创建。",
      inputSchema: jsonSchema<{ path: string; content: string }>({
        type: "object",
        required: ["path", "content"],
        properties: {
          path: {
            type: "string",
            description: "要写入的辅助资料文件绝对路径，例如 /设定/角色/主角.md。",
          },
          content: {
            type: "string",
            description: "要写入文件的完整内容。",
          },
        },
      }),
      execute: async ({ path, content }) => {
        const workspace = getWorkspaceForProject(projectId);
        if (!workspace) {
          return failure(new Error("当前项目没有默认工作区。"));
        }

        return withEnvelope(() => {
          const timelinePointId = resolveTimelinePointId(context);
          const { normalizedPath, parentPath, name } = splitAuxPath(path, "写入辅助资料文件");
          const existing = readAuxByPathAt(workspace.id, timelinePointId, normalizedPath);

          if (existing) {
            invariant(existing.nodeType === "file", "写入辅助资料文件失败：目标路径不是文件。");
            const node = writeFileAt({
              workspaceId: workspace.id,
              timelinePointId,
              nodeId: existing.id,
              content,
            });
            return {
              ok: true,
              truncated: false,
              data: {
                action: "updated",
                path: normalizedPath,
                nodeId: node.id,
              },
            };
          }

          const parentDirId = resolveParentDirId({
            workspaceId: workspace.id,
            timelinePointId,
            auxRootId: workspace.auxRootId,
            parentPath,
            actionLabel: "写入辅助资料文件",
          });
          const node = writeFileAt({
            workspaceId: workspace.id,
            timelinePointId,
            parentDirId,
            name,
            content,
          });

          return {
            ok: true,
            truncated: false,
            data: {
              action: "created",
              path: normalizedPath,
              nodeId: node.id,
            },
          };
        });
      },
    }),
    move_aux_node: tool({
      description:
        "在当前时间点下移动或重命名一个辅助资料节点。支持文件、目录或符号链接，但不支持辅助资料根目录。",
      inputSchema: jsonSchema<{ path: string; newPath: string }>({
        type: "object",
        required: ["path", "newPath"],
        properties: {
          path: {
            type: "string",
            description: "要移动的辅助资料绝对路径，例如 /设定/角色.md。",
          },
          newPath: {
            type: "string",
            description: "移动后的目标绝对路径，例如 /资料库/人物/主角.md。",
          },
        },
      }),
      execute: async ({ path, newPath }) => {
        const workspace = getWorkspaceForProject(projectId);
        if (!workspace) {
          return failure(new Error("当前项目没有默认工作区。"));
        }

        return withEnvelope(() => {
          const timelinePointId = resolveTimelinePointId(context);
          const { normalizedPath } = splitAuxPath(path, "移动辅助资料");
          const {
            normalizedPath: normalizedNewPath,
            parentPath: newParentPath,
            name: newName,
          } = splitAuxPath(newPath, "移动辅助资料");
          invariant(
            normalizedPath !== normalizedNewPath,
            "移动辅助资料失败：目标路径不能与原路径相同。",
          );

          const existing = resolveAuxNodeByPathOrThrow({
            workspaceId: workspace.id,
            timelinePointId,
            path: normalizedPath,
            actionLabel: "移动辅助资料",
          });
          const conflicting = readAuxByPathAt(workspace.id, timelinePointId, normalizedNewPath);
          invariant(conflicting == null, "移动辅助资料失败：目标路径已存在。");

          const newParentDirId = resolveParentDirId({
            workspaceId: workspace.id,
            timelinePointId,
            auxRootId: workspace.auxRootId,
            parentPath: newParentPath,
            actionLabel: "移动辅助资料",
          });
          const node = moveAuxNodeAt({
            workspaceId: workspace.id,
            timelinePointId,
            nodeId: existing.id,
            newParentDirId,
            newName,
          });

          return {
            ok: true,
            truncated: false,
            data: {
              action: "moved",
              path: normalizedNewPath,
              previousPath: normalizedPath,
              nodeId: node.id,
            },
          };
        });
      },
    }),
    delete_aux_node: tool({
      description:
        "删除当前时间点下的一个辅助资料节点。若是目录会连同所有子项一起删除。此操作不可逆。",
      inputSchema: jsonSchema<{ path: string }>({
        type: "object",
        required: ["path"],
        properties: {
          path: {
            type: "string",
            description: "要删除的辅助资料绝对路径，例如 /设定/旧角色.md。",
          },
        },
      }),
      execute: async ({ path }) => {
        const workspace = getWorkspaceForProject(projectId);
        if (!workspace) {
          return failure(new Error("当前项目没有默认工作区。"));
        }

        return withEnvelope(() => {
          const timelinePointId = resolveTimelinePointId(context);
          const { normalizedPath } = splitAuxPath(path, "删除辅助资料");
          const node = resolveAuxNodeByPathOrThrow({
            workspaceId: workspace.id,
            timelinePointId,
            path: normalizedPath,
            actionLabel: "删除辅助资料",
          });

          deleteAuxNodeAt({
            workspaceId: workspace.id,
            timelinePointId,
            nodeId: node.id,
          });

          return {
            ok: true,
            truncated: false,
            data: {
              action: "deleted" as const,
              path: normalizedPath,
              nodeId: node.id,
            },
          };
        });
      },
    }),
    create_aux_symlink: tool({
      description:
        "在当前时间点下创建一个辅助资料符号链接。链接本身写入到指定路径，目标路径必须在当前时间点可见。",
      inputSchema: jsonSchema<{ path: string; targetPath: string }>({
        type: "object",
        required: ["path", "targetPath"],
        properties: {
          path: {
            type: "string",
            description: "要创建的符号链接绝对路径，例如 /索引/角色.md。",
          },
          targetPath: {
            type: "string",
            description: "符号链接目标绝对路径，例如 /设定/角色/主角.md。",
          },
        },
      }),
      execute: async ({ path, targetPath }) => {
        const workspace = getWorkspaceForProject(projectId);
        if (!workspace) {
          return failure(new Error("当前项目没有默认工作区。"));
        }

        return withEnvelope(() => {
          const timelinePointId = resolveTimelinePointId(context);
          const { normalizedPath, parentPath, name } = splitAuxPath(path, "创建辅助资料符号链接");
          const { normalizedPath: normalizedTargetPath } = splitAuxPath(
            targetPath,
            "创建辅助资料符号链接",
          );
          const existing = readAuxByPathAt(workspace.id, timelinePointId, normalizedPath);
          invariant(existing == null, "创建辅助资料符号链接失败：目标路径已存在。");

          const targetNode = resolveAuxNodeByPathOrThrow({
            workspaceId: workspace.id,
            timelinePointId,
            path: normalizedTargetPath,
            actionLabel: "创建辅助资料符号链接",
          });
          const parentDirId = resolveParentDirId({
            workspaceId: workspace.id,
            timelinePointId,
            auxRootId: workspace.auxRootId,
            parentPath,
            actionLabel: "创建辅助资料符号链接",
          });
          const node = linkAt({
            workspaceId: workspace.id,
            timelinePointId,
            parentDirId,
            name,
            targetNodeId: targetNode.id,
          });

          return {
            ok: true,
            truncated: false,
            data: {
              action: "created",
              path: normalizedPath,
              targetPath: normalizedTargetPath,
              nodeId: node.id,
            },
          };
        });
      },
    }),
    retarget_aux_symlink: tool({
      description: "修改辅助资料符号链接的目标路径。链接本身不变，只是指向新的目标。",
      inputSchema: jsonSchema<{ path: string; newTargetPath: string }>({
        type: "object",
        required: ["path", "newTargetPath"],
        properties: {
          path: {
            type: "string",
            description: "要重定向的符号链接绝对路径，例如 /索引/角色.md。",
          },
          newTargetPath: {
            type: "string",
            description: "新的目标绝对路径，例如 /设定/角色/主角.md。",
          },
        },
      }),
      execute: async ({ path, newTargetPath }) => {
        const workspace = getWorkspaceForProject(projectId);
        if (!workspace) {
          return failure(new Error("当前项目没有默认工作区。"));
        }

        return withEnvelope(() => {
          const timelinePointId = resolveTimelinePointId(context);
          const { normalizedPath } = splitAuxPath(path, "重定向辅助资料符号链接");
          const { normalizedPath: normalizedNewTargetPath } = splitAuxPath(
            newTargetPath,
            "重定向辅助资料符号链接",
          );

          const symlinkNode = resolveAuxNodeByPathOrThrow({
            workspaceId: workspace.id,
            timelinePointId,
            path: normalizedPath,
            actionLabel: "重定向辅助资料符号链接",
          });
          invariant(
            symlinkNode.nodeType === "symlink",
            "重定向辅助资料符号链接失败：指定路径不是符号链接。",
          );

          const targetNode = resolveAuxNodeByPathOrThrow({
            workspaceId: workspace.id,
            timelinePointId,
            path: normalizedNewTargetPath,
            actionLabel: "重定向辅助资料符号链接",
          });

          const node = retargetAuxSymlinkAt({
            workspaceId: workspace.id,
            timelinePointId,
            symlinkNodeId: symlinkNode.id,
            targetNodeId: targetNode.id,
          });

          return {
            ok: true,
            truncated: false,
            data: {
              action: "retargeted" as const,
              path: normalizedPath,
              newTargetPath: normalizedNewTargetPath,
              nodeId: node.id,
            },
          };
        });
      },
    }),
  } satisfies Record<AuxWriteToolName, unknown>;
}
