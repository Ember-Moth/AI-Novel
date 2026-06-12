import { molecule, useMolecule } from "bunshi/react";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

import type { CommitRow } from "../projectTypes";
import { resolveNext, type Updater } from "./storeUtils";

type ProjectWorkbenchStateData = {
  detailName: string;
  detailDescription: string;
  detailError: string | null;
  newBranchName: string;
  newBranchError: string | null;
  forkBranchName: string;
  forkBranchError: string | null;
  forkCommit: CommitRow | null;
  commitMessage: string;
  commitError: string | null;
  discardError: string | null;
};

type ProjectWorkbenchStateActions = {
  setDetailName: (updater: Updater<string>) => void;
  setDetailDescription: (updater: Updater<string>) => void;
  setDetailError: (updater: Updater<string | null>) => void;
  setNewBranchName: (updater: Updater<string>) => void;
  setNewBranchError: (updater: Updater<string | null>) => void;
  setForkBranchName: (updater: Updater<string>) => void;
  setForkBranchError: (updater: Updater<string | null>) => void;
  setForkCommit: (updater: Updater<CommitRow | null>) => void;
  setCommitMessage: (updater: Updater<string>) => void;
  setCommitError: (updater: Updater<string | null>) => void;
  setDiscardError: (updater: Updater<string | null>) => void;
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
      newBranchName: "",
      newBranchError: null,
      forkBranchName: "",
      forkBranchError: null,
      forkCommit: null,
      commitMessage: "",
      commitError: null,
      discardError: null,
      setDetailName: field("detailName"),
      setDetailDescription: field("detailDescription"),
      setDetailError: field("detailError"),
      setNewBranchName: field("newBranchName"),
      setNewBranchError: field("newBranchError"),
      setForkBranchName: field("forkBranchName"),
      setForkBranchError: field("forkBranchError"),
      setForkCommit: field("forkCommit"),
      setCommitMessage: field("commitMessage"),
      setCommitError: field("commitError"),
      setDiscardError: field("discardError"),
      resetCreateBranchDialog: () =>
        set({
          newBranchName: "",
          newBranchError: null,
        }),
      resetForkBranchDialog: () =>
        set({
          forkBranchName: "",
          forkBranchError: null,
          forkCommit: null,
        }),
      resetCommitDraft: () =>
        set({
          commitMessage: "",
          commitError: null,
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

export const ProjectWorkbenchStateMolecule = molecule(() => createProjectWorkbenchStore());

export function useProjectWorkbenchStoreApi(): ProjectWorkbenchStore {
  return useMolecule(ProjectWorkbenchStateMolecule);
}

export function useProjectWorkbenchState<T>(selector: (state: ProjectWorkbenchState) => T): T {
  return useStore(useMolecule(ProjectWorkbenchStateMolecule), selector);
}
