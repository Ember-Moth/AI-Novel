import type { ActionError } from "@/modules/workspace/ui/editor/model/action-error";
import type {
  WorkspaceState,
  WorkspaceStore,
} from "@/modules/workspace/ui/editor/state/molecules/workspaceStore";

export function omitRecordKeys<TValue>(
  record: Record<string, TValue>,
  nodeIds: ReadonlySet<string>,
): Record<string, TValue> {
  let changed = false;
  const next = { ...record };

  for (const nodeId of nodeIds) {
    if (nodeId in next) {
      delete next[nodeId];
      changed = true;
    }
  }

  return changed ? next : record;
}

export function clearNodeLocalState(store: WorkspaceStore, nodeIds: ReadonlySet<string>) {
  const state = store.getState();
  state.setDrafts((previous) => omitRecordKeys(previous, nodeIds));
  state.setCommittedBodies((previous) => omitRecordKeys(previous, nodeIds));
  state.setPendingSaveCounts((previous) => omitRecordKeys(previous, nodeIds));
  state.setSaveErrors((previous) => omitRecordKeys(previous, nodeIds));
}

export function clearContentNodeLocalState(store: WorkspaceStore, nodeIds: ReadonlySet<string>) {
  clearNodeLocalState(store, nodeIds);

  store.getState().setExpandedContentIds((previous) => {
    let changed = false;
    const next = new Set(previous);

    for (const nodeId of nodeIds) {
      if (next.delete(nodeId)) {
        changed = true;
      }
    }

    return changed ? next : previous;
  });
}

export function incrementPendingSaveCount(state: WorkspaceState, nodeId: string) {
  state.setPendingSaveCounts((previous) => ({
    ...previous,
    [nodeId]: (previous[nodeId] ?? 0) + 1,
  }));
}

export function decrementPendingSaveCount(state: WorkspaceState, nodeId: string) {
  state.setPendingSaveCounts((previous) => {
    const nextCount = (previous[nodeId] ?? 1) - 1;
    if (nextCount <= 0) {
      const next = { ...previous };
      delete next[nodeId];
      return next;
    }

    return {
      ...previous,
      [nodeId]: nextCount,
    };
  });
}

export function clearSaveError(state: WorkspaceState, nodeId: string) {
  state.setSaveErrors((previous) => {
    if (!(nodeId in previous)) {
      return previous;
    }

    const next = { ...previous };
    delete next[nodeId];
    return next;
  });
}

export function setNodeSaveError(
  state: WorkspaceState,
  nodeId: string,
  error: unknown,
  fallbackMessage: string,
) {
  state.setSaveErrors((previous) => ({
    ...previous,
    [nodeId]: error instanceof Error ? error.message : fallbackMessage,
  }));
}

export function clearActiveContentSelection(state: WorkspaceState) {
  state.setShouldAutoSelectContent(false);
  state.setPendingContentNodeId(null);
  state.setActiveContentNodeId(null);
}

export function selectAuxPath(
  state: WorkspaceState,
  auxNodeMap: ReadonlyMap<string, unknown>,
  path: string | null,
) {
  clearActiveContentSelection(state);
  state.setPendingAuxPath(path && auxNodeMap.has(path) ? null : path);
  state.setActiveAuxPath(path);
}

export function selectContentNode(
  state: WorkspaceState,
  contentNodeMap: ReadonlyMap<string, unknown>,
  nodeId: string,
  anchorTimelinePointId: string,
) {
  state.setShouldAutoSelectContent(true);
  state.setPendingAuxPath(null);
  state.setActiveAuxPath(null);
  state.setPendingContentNodeId(contentNodeMap.has(nodeId) ? null : nodeId);
  state.setActiveContentNodeId(nodeId);
  state.setActiveTimelinePointId(anchorTimelinePointId);
}

export function setActionErrorMessage(
  setter: (updater: ActionError) => void,
  message: string,
  anchorId: string,
) {
  setter({ message, anchorId });
}
