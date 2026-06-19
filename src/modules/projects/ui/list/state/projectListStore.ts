import { molecule, useMolecule } from "bunshi/react";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

import { resolveNext, type Updater } from "../../shared/state/storeUtils";

type ProjectListStateData = {
  createProjectName: string;
  createProjectDescription: string;
  createProjectError: string | null;
  deletingProjectId: string | null;
};

type ProjectListStateActions = {
  setCreateProjectName: (updater: Updater<string>) => void;
  setCreateProjectDescription: (updater: Updater<string>) => void;
  setCreateProjectError: (updater: Updater<string | null>) => void;
  setDeletingProjectId: (updater: Updater<string | null>) => void;
  resetCreateProjectDialog: () => void;
};

export type ProjectListState = ProjectListStateData & ProjectListStateActions;
export type ProjectListStore = ReturnType<typeof createProjectListStore>;

export function createProjectListStore() {
  return createStore<ProjectListState>()((set) => {
    const field =
      <K extends keyof ProjectListStateData>(key: K) =>
      (updater: Updater<ProjectListStateData[K]>) =>
        set(
          (state) => ({ [key]: resolveNext(updater, state[key]) }) as Pick<ProjectListStateData, K>,
        );

    return {
      createProjectName: "",
      createProjectDescription: "",
      createProjectError: null,
      deletingProjectId: null,
      setCreateProjectName: field("createProjectName"),
      setCreateProjectDescription: field("createProjectDescription"),
      setCreateProjectError: field("createProjectError"),
      setDeletingProjectId: field("deletingProjectId"),
      resetCreateProjectDialog: () =>
        set({
          createProjectName: "",
          createProjectDescription: "",
          createProjectError: null,
        }),
    };
  });
}

export const ProjectListStateMolecule = molecule(() => createProjectListStore());

export function useProjectListStoreApi(): ProjectListStore {
  return useMolecule(ProjectListStateMolecule);
}

export function useProjectListState<T>(selector: (state: ProjectListState) => T): T {
  return useStore(useMolecule(ProjectListStateMolecule), selector);
}
