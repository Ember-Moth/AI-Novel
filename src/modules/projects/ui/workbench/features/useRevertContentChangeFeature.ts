import { useCallback } from "react";

import { rpc } from "@/rpc/client";

import {
  useProjectWorkbenchProjectId,
  useProjectWorkbenchViewModel,
} from "../core/useProjectWorkbench";

export function useRevertContentChangeFeature() {
  const projectId = useProjectWorkbenchProjectId();
  const model = useProjectWorkbenchViewModel();
  const revertContentChange = rpc.useMutation("content.revert");
  const revertTimelineChange = rpc.useMutation("timeline.revert");
  const revertAuxChange = rpc.useMutation("aux.revert");

  const handleRevertContentChange = useCallback(
    async (nodeId: string, kind: "added" | "deleted" | "modified") => {
      if (!model.selectedBranch) {
        return;
      }

      const confirmMessages: Record<string, string> = {
        added: "确认撤回该新增节点？节点及其所有子节点将被永久删除。",
        deleted: "确认恢复该已删除节点？将从 HEAD 中恢复该节点及其完整子树。",
        modified: "确认恢复该节点的所有修改？节点的标题、正文、锚点、位置将恢复至 HEAD 状态。",
      };

      if (!confirm(confirmMessages[kind])) {
        return;
      }

      await revertContentChange.mutate({
        projectId,
        branchId: model.selectedBranch.name,
        nodeId,
        kind,
      });
    },
    [model.selectedBranch, projectId, revertContentChange],
  );

  const handleRevertTimelineChange = useCallback(
    async (pointId: string, kind: "added" | "deleted" | "modified") => {
      if (!model.selectedBranch) {
        return;
      }

      const confirmMessages: Record<string, string> = {
        added: "确认撤回该新增时间点？若它仍被章节或时间线辅助信息引用，将拒绝恢复。",
        deleted: "确认恢复该已删除时间点？将按 HEAD 中的原始顺序重新插入。",
        modified: "确认恢复该时间点的修改？名称、描述、顺序将恢复至 HEAD 状态。",
      };

      if (!confirm(confirmMessages[kind])) {
        return;
      }

      await revertTimelineChange.mutate({
        projectId,
        branchId: model.selectedBranch.name,
        pointId,
        kind,
      });
    },
    [model.selectedBranch, projectId, revertTimelineChange],
  );

  const handleRevertAuxChange = useCallback(
    async (filepath: string, kind: "added" | "deleted" | "modified") => {
      if (!model.selectedBranch) {
        return;
      }

      const confirmMessages: Record<string, string> = {
        added: "确认撤回该新增辅助信息？将从当前工作区删除该路径。",
        deleted: "确认恢复该已删除辅助信息？将从 HEAD 恢复该路径。",
        modified: "确认恢复该辅助信息的修改？当前内容将恢复至 HEAD 状态。",
      };

      if (!confirm(confirmMessages[kind])) {
        return;
      }

      await revertAuxChange.mutate({
        projectId,
        branchId: model.selectedBranch.name,
        filepath,
        kind,
      });
    },
    [model.selectedBranch, projectId, revertAuxChange],
  );

  return {
    handleRevertContentChange,
    handleRevertTimelineChange,
    handleRevertAuxChange,
    isReverting:
      revertContentChange.isPending || revertTimelineChange.isPending || revertAuxChange.isPending,
    revertError:
      revertContentChange.error?.message ??
      revertTimelineChange.error?.message ??
      revertAuxChange.error?.message ??
      null,
  };
}
