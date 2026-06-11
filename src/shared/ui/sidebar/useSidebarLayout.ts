import { useMolecule } from "bunshi/react";
import { useCallback, useRef } from "react";
import { useStore } from "zustand";

import { collapse, expand, reflow, resizeAt, seedHeights } from "./layoutMath";
import { SidebarLayoutMolecule } from "./layoutMolecule";

export function useSidebarLayout(panelCount: number) {
  const store = useMolecule(SidebarLayoutMolecule);

  const heights = useStore(store, (state) => state.heights);
  const collapsed = useStore(store, (state) => state.collapsed);
  const initialized = useStore(store, (state) => state.initialized);

  // 拖动开始时的高度快照，move 期间基于它计算，避免漂移。
  const dragStartRef = useRef<number[] | null>(null);

  const onMeasure = useCallback(
    (px: number) => {
      const rounded = Math.round(px);
      if (rounded <= 0) {
        return;
      }

      const { initialized: wasInitialized } = store.getState();
      if (!wasInitialized) {
        const current = store.getState().collapsed;
        const collapsedSeed =
          current.length === panelCount ? current : new Array(panelCount).fill(false);
        const seeded = seedHeights(rounded, collapsedSeed);
        store.setState({
          collapsed: collapsedSeed,
          heights: seeded,
          remembered: seeded.slice(),
          containerHeight: rounded,
          initialized: true,
        });
        return;
      }

      const {
        containerHeight: oldTotal,
        heights: currentHeights,
        collapsed: currentCollapsed,
      } = store.getState();
      if (oldTotal === rounded) {
        return;
      }
      const reflowed = reflow(currentHeights, currentCollapsed, oldTotal, rounded);
      store.setState({
        heights: reflowed,
        containerHeight: rounded,
      });
    },
    [store, panelCount],
  );

  const resizeStart = useCallback(() => {
    dragStartRef.current = store.getState().heights.slice();
  }, [store]);

  const resize = useCallback(
    (handleIndex: number, deltaPx: number) => {
      const start = dragStartRef.current;
      if (!start) {
        return;
      }
      store.setState((state) => ({
        heights: resizeAt(start, state.collapsed, handleIndex, deltaPx),
      }));
    },
    [store],
  );

  const resizeEnd = useCallback(() => {
    dragStartRef.current = null;
  }, []);

  const toggleCollapse = useCallback(
    (index: number) => {
      const { collapsed: currentCollapsed, heights: currentHeights, remembered } = store.getState();
      const result = currentCollapsed[index]
        ? expand(currentHeights, currentCollapsed, remembered, index)
        : collapse(currentHeights, currentCollapsed, remembered, index);
      store.setState({
        heights: result.heights,
        collapsed: result.collapsed,
        remembered: result.remembered,
      });
    },
    [store],
  );

  return {
    heights,
    collapsed,
    initialized,
    onMeasure,
    resizeStart,
    resize,
    resizeEnd,
    toggleCollapse,
  };
}
