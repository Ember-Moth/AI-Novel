import { type FormEvent, useCallback } from "react";

import { rpc } from "@/rpc/client";

import type { CommitRow } from "../../shared/projectTypes";
import {
  useProjectWorkbenchNavigation,
  useProjectWorkbenchProjectId,
  useProjectWorkbenchViewModel,
} from "../core/useProjectWorkbench";
import {
  useProjectForkBranchDialogState,
  useProjectWorkbenchStoreApi,
} from "../state/projectWorkbenchStore";

export function useForkBranchDialogControls() {
  const workbenchStore = useProjectWorkbenchStoreApi();
  const { isDialogOpen } = useProjectForkBranchDialogState();

  const openDialog = useCallback(
    (commit: CommitRow) => {
      workbenchStore.setState({
        isForkBranchDialogOpen: true,
        forkCommit: commit,
        forkBranchName: "",
        forkBranchError: null,
      });
    },
    [workbenchStore],
  );

  const closeDialog = useCallback(() => {
    workbenchStore.getState().resetForkBranchDialog();
  }, [workbenchStore]);

  return {
    isOpen: isDialogOpen,
    openDialog,
    closeDialog,
  };
}

export function useForkBranchFeature() {
  const projectId = useProjectWorkbenchProjectId();
  const model = useProjectWorkbenchViewModel();
  const { navigateToBranch } = useProjectWorkbenchNavigation();
  const workbenchStore = useProjectWorkbenchStoreApi();
  const dialogControls = useForkBranchDialogControls();
  const createBranchWithWorkspace = rpc.useMutation("branches.createWithWorkspace");

  const submit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const { forkBranchName, forkCommit, setForkBranchError } = workbenchStore.getState();

      if (!model.project || !forkCommit) {
        return;
      }

      const trimmedName = forkBranchName.trim();
      if (!trimmedName) {
        setForkBranchError("分支名称不能为空。");
        return;
      }

      try {
        const workspace = await createBranchWithWorkspace.mutate({
          projectId,
          name: trimmedName,
          fromCommitId: forkCommit.id,
        });
        dialogControls.closeDialog();
        navigateToBranch(workspace.branchId);
      } catch (mutationError) {
        setForkBranchError(
          mutationError instanceof Error ? mutationError.message : "Fork 分支失败，请稍后重试。",
        );
      }
    },
    [
      createBranchWithWorkspace,
      dialogControls,
      model.project,
      navigateToBranch,
      projectId,
      workbenchStore,
    ],
  );

  return {
    ...dialogControls,
    submit,
    errorMessage: createBranchWithWorkspace.error?.message ?? null,
    isPending: createBranchWithWorkspace.isPending,
  };
}
