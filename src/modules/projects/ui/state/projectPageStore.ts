import { molecule, useMolecule } from "bunshi/react";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

import type { CommitRow } from "../projectTypes";

export type Updater<T> = T | ((current: T) => T);

function resolveNext<T>(updater: Updater<T>, current: T): T {
  return typeof updater === "function" ? (updater as (current: T) => T)(current) : updater;
}

type ProjectPageStateData = {
  name: string;
  description: string;
  formError: string | null;
  deletingId: string | null;
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

type ProjectPageStateActions = {
  setName: (updater: Updater<string>) => void;
  setDescription: (updater: Updater<string>) => void;
  setFormError: (updater: Updater<string | null>) => void;
  setDeletingId: (updater: Updater<string | null>) => void;
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
  resetCreateProjectDialog: () => void;
  resetCreateBranchDialog: () => void;
  resetForkBranchDialog: () => void;
  resetCommitDraft: () => void;
  syncProjectDetail: (project: { name: string; description: string | null } | null) => void;
};

export type ProjectPageState = ProjectPageStateData & ProjectPageStateActions;
export type ProjectPageStore = ReturnType<typeof createProjectPageStore>;

export function createProjectPageStore() {
  return createStore<ProjectPageState>()((set) => {
    const field =
      <K extends keyof ProjectPageStateData>(key: K) =>
      (updater: Updater<ProjectPageStateData[K]>) =>
        set(
          (state) => ({ [key]: resolveNext(updater, state[key]) }) as Pick<ProjectPageStateData, K>,
        );

    return {
      name: "",
      description: "",
      formError: null,
      deletingId: null,
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
      setName: field("name"),
      setDescription: field("description"),
      setFormError: field("formError"),
      setDeletingId: field("deletingId"),
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
      resetCreateProjectDialog: () =>
        set({
          name: "",
          description: "",
          formError: null,
        }),
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

export const ProjectPageStateMolecule = molecule(() => createProjectPageStore());

export function useProjectPageStoreApi(): ProjectPageStore {
  return useMolecule(ProjectPageStateMolecule);
}

export function useProjectPageState<T>(selector: (state: ProjectPageState) => T): T {
  return useStore(useMolecule(ProjectPageStateMolecule), selector);
}
