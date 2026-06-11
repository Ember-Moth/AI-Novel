import { createScope, molecule } from "bunshi/react";
import { createStore } from "zustand/vanilla";

type SidebarLayoutState = {
  heights: number[];
  collapsed: boolean[];
  remembered: number[];
  containerHeight: number;
  initialized: boolean;
};

type SidebarLayoutActions = {
  setHeights: (_updater: number[] | ((_current: number[]) => number[])) => void;
  setCollapsed: (_updater: boolean[] | ((_current: boolean[]) => boolean[])) => void;
  setRemembered: (_updater: number[] | ((_current: number[]) => number[])) => void;
  setContainerHeight: (_value: number) => void;
  setInitialized: (_value: boolean) => void;
};

export type SidebarLayoutStore = ReturnType<typeof createSidebarLayoutStore>;

function resolveNext<T>(updater: T | ((_current: T) => T), current: T) {
  return typeof updater === "function" ? (updater as (_current: T) => T)(current) : updater;
}

function createSidebarLayoutStore() {
  return createStore<SidebarLayoutState & SidebarLayoutActions>()((set) => ({
    heights: [],
    collapsed: [],
    remembered: [],
    containerHeight: 0,
    initialized: false,
    setHeights: (updater) =>
      set((state) => ({
        heights: resolveNext(updater, state.heights),
      })),
    setCollapsed: (updater) =>
      set((state) => ({
        collapsed: resolveNext(updater, state.collapsed),
      })),
    setRemembered: (updater) =>
      set((state) => ({
        remembered: resolveNext(updater, state.remembered),
      })),
    setContainerHeight: (value) => set({ containerHeight: value }),
    setInitialized: (value) => set({ initialized: value }),
  }));
}

/** 侧边栏布局状态的作用域键。不同页面/项目用不同的键值，各自持有独立的一份布局状态。 */
export const SidebarLayoutScope = createScope<string>("default");

export const SidebarLayoutMolecule = molecule((_, getScope) => {
  getScope(SidebarLayoutScope);

  return createSidebarLayoutStore();
});
