import { molecule, useMolecule } from "bunshi/react";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

import type { CommitRow } from "../../shared/projectTypes";
import { resolveNext, type Updater } from "../../shared/state/storeUtils";
import { ProjectWorkbenchProjectScope } from "../core/projectWorkbenchScopes";

/**
 * 历史时间线的选中项。仿照 GitHub Desktop / Fork：顶部一个「未提交更改」伪节点，
 * 其余为具体 commit。选中项驱动右侧详情面板展示的内容。
 */
export type ProjectHistorySelection = { kind: "working" } | { kind: "commit"; commitId: string };

type ProjectWorkbenchStateData = {
  detailName: string;
  detailDescription: string;
  detailError: string | null;
  isCreateBranchDialogOpen: boolean;
  newBranchName: string;
  newBranchError: string | null;
  isForkBranchDialogOpen: boolean;
  forkBranchName: string;
  forkBranchError: string | null;
  forkCommit: CommitRow | null;
  commitMessage: string;
  commitError: string | null;
  discardError: string | null;
  historySelection: ProjectHistorySelection;
};

type ProjectWorkbenchStateActions = {
  setDetailName: (updater: Updater<string>) => void;
  setDetailDescription: (updater: Updater<string>) => void;
  setDetailError: (updater: Updater<string | null>) => void;
  setCreateBranchDialogOpen: (updater: Updater<boolean>) => void;
  setNewBranchName: (updater: Updater<string>) => void;
  setNewBranchError: (updater: Updater<string | null>) => void;
  setForkBranchDialogOpen: (updater: Updater<boolean>) => void;
  setForkBranchName: (updater: Updater<string>) => void;
  setForkBranchError: (updater: Updater<string | null>) => void;
  setForkCommit: (updater: Updater<CommitRow | null>) => void;
  setCommitMessage: (updater: Updater<string>) => void;
  setCommitError: (updater: Updater<string | null>) => void;
  setDiscardError: (updater: Updater<string | null>) => void;
  setHistorySelection: (updater: Updater<ProjectHistorySelection>) => void;
  resetCreateBranchDialog: () => void;
  resetForkBranchDialog: () => void;
  resetCommitDraft: () => void;
  syncProjectDetail: (project: { name: string; description: string | null } | null) => void;
};

export type ProjectWorkbenchState = ProjectWorkbenchStateData & ProjectWorkbenchStateActions;
export type ProjectWorkbenchStore = ReturnType<typeof createProjectWorkbenchStore>;

export function createProjectWorkbenchStore() {
  return createStore<ProjectWorkbenchState>()((set) => {
    const field =
      <K extends keyof ProjectWorkbenchStateData>(key: K) =>
      (updater: Updater<ProjectWorkbenchStateData[K]>) =>
        set(
          (state) =>
            ({ [key]: resolveNext(updater, state[key]) }) as Pick<ProjectWorkbenchStateData, K>,
        );

    return {
      detailName: "",
      detailDescription: "",
      detailError: null,
      isCreateBranchDialogOpen: false,
      newBranchName: "",
      newBranchError: null,
      isForkBranchDialogOpen: false,
      forkBranchName: "",
      forkBranchError: null,
      forkCommit: null,
      commitMessage: "",
      commitError: null,
      discardError: null,
      historySelection: { kind: "working" },
      setDetailName: field("detailName"),
      setDetailDescription: field("detailDescription"),
      setDetailError: field("detailError"),
      setCreateBranchDialogOpen: field("isCreateBranchDialogOpen"),
      setNewBranchName: field("newBranchName"),
      setNewBranchError: field("newBranchError"),
      setForkBranchDialogOpen: field("isForkBranchDialogOpen"),
      setForkBranchName: field("forkBranchName"),
      setForkBranchError: field("forkBranchError"),
      setForkCommit: field("forkCommit"),
      setCommitMessage: field("commitMessage"),
      setCommitError: field("commitError"),
      setDiscardError: field("discardError"),
      setHistorySelection: field("historySelection"),
      resetCreateBranchDialog: () =>
        set({
          isCreateBranchDialogOpen: false,
          newBranchName: "",
          newBranchError: null,
        }),
      resetForkBranchDialog: () =>
        set({
          isForkBranchDialogOpen: false,
          forkBranchName: "",
          forkBranchError: null,
          forkCommit: null,
        }),
      resetCommitDraft: () =>
        set({
          commitMessage: "",
          commitError: null,
          discardError: null,
          historySelection: { kind: "working" },
        }),
      syncProjectDetail: (project) =>
        set({
          detailName: project?.name ?? "",
          detailDescription: project?.description ?? "",
          detailError: null,
        }),
    };
  });
}

export const ProjectWorkbenchStateMolecule = molecule((_, getScope) => {
  getScope(ProjectWorkbenchProjectScope);
  return createProjectWorkbenchStore();
});

export function useProjectWorkbenchStoreApi(): ProjectWorkbenchStore {
  return useMolecule(ProjectWorkbenchStateMolecule);
}

export function useProjectWorkbenchState<T>(selector: (state: ProjectWorkbenchState) => T): T {
  return useStore(useMolecule(ProjectWorkbenchStateMolecule), selector);
}

export function useProjectMetadataDraft() {
  const detailName = useProjectWorkbenchState((state) => state.detailName);
  const detailDescription = useProjectWorkbenchState((state) => state.detailDescription);
  const detailError = useProjectWorkbenchState((state) => state.detailError);
  const setDetailName = useProjectWorkbenchState((state) => state.setDetailName);
  const setDetailDescription = useProjectWorkbenchState((state) => state.setDetailDescription);

  return {
    detailName,
    detailDescription,
    detailError,
    setDetailName,
    setDetailDescription,
  };
}

export function useProjectCommitDraft() {
  const commitMessage = useProjectWorkbenchState((state) => state.commitMessage);
  const commitError = useProjectWorkbenchState((state) => state.commitError);
  const discardError = useProjectWorkbenchState((state) => state.discardError);
  const setCommitMessage = useProjectWorkbenchState((state) => state.setCommitMessage);

  return {
    commitMessage,
    commitError,
    discardError,
    setCommitMessage,
  };
}

export function useProjectCreateBranchDraft() {
  const newBranchName = useProjectWorkbenchState((state) => state.newBranchName);
  const newBranchError = useProjectWorkbenchState((state) => state.newBranchError);
  const setNewBranchName = useProjectWorkbenchState((state) => state.setNewBranchName);

  return {
    newBranchName,
    newBranchError,
    setNewBranchName,
  };
}

export function useProjectCreateBranchDialogState() {
  const isDialogOpen = useProjectWorkbenchState((state) => state.isCreateBranchDialogOpen);
  const setDialogOpen = useProjectWorkbenchState((state) => state.setCreateBranchDialogOpen);

  return {
    isDialogOpen,
    setDialogOpen,
  };
}

export function useProjectForkBranchDraft() {
  const forkBranchName = useProjectWorkbenchState((state) => state.forkBranchName);
  const forkBranchError = useProjectWorkbenchState((state) => state.forkBranchError);
  const forkCommit = useProjectWorkbenchState((state) => state.forkCommit);
  const setForkBranchName = useProjectWorkbenchState((state) => state.setForkBranchName);

  return {
    forkBranchName,
    forkBranchError,
    forkCommit,
    setForkBranchName,
  };
}

export function useProjectForkBranchDialogState() {
  const isDialogOpen = useProjectWorkbenchState((state) => state.isForkBranchDialogOpen);
  const setDialogOpen = useProjectWorkbenchState((state) => state.setForkBranchDialogOpen);

  return {
    isDialogOpen,
    setDialogOpen,
  };
}

export function useProjectHistorySelection() {
  const selection = useProjectWorkbenchState((state) => state.historySelection);
  const setSelection = useProjectWorkbenchState((state) => state.setHistorySelection);

  return {
    selection,
    setSelection,
  };
}
