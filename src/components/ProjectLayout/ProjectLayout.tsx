import { skipToken } from "@codehz/rpc";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { rpc } from "@/api/client";

import { AuxTreePanel } from "./AuxTreePanel";
import { ContentTreePanel } from "./ContentTreePanel";
import { EditorArea } from "./EditorArea";
import { FullPageMessage } from "./FullPageMessage";
import { PanelPlaceholder } from "./PanelPlaceholder";
import { SidebarSection } from "./SidebarSection";
import { TimelinePanel } from "./TimelinePanel";
import type { ContentTreeNodeVM } from "./types";
import {
  buildContentParentMap,
  collectAncestorIds,
  findPreferredContentNode,
  flattenAuxNodes,
  flattenContentNodes,
  normalizeAuxNodes,
  normalizeContentNodes,
  normalizeTimelinePoints,
  omitRecordKey,
} from "./utils";

const ORIGIN_TIMELINE_POINT_ID = "origin";
const AUTOSAVE_DELAY_MS = 600;

export function ProjectLayout({ id: projectId }: { id: string }) {
  const [expandedContentIds, setExpandedContentIds] = useState<Set<string>>(() => new Set());
  const [activeContentNodeId, setActiveContentNodeId] = useState<string | null>(null);
  const [expandedAuxIds, setExpandedAuxIds] = useState<Set<string>>(() => new Set());
  const [activeAuxNodeId, setActiveAuxNodeId] = useState<string | null>(null);
  const [activeTimelinePointId, setActiveTimelinePointId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [committedBodies, setCommittedBodies] = useState<Record<string, string>>({});
  const [pendingSaveCounts, setPendingSaveCounts] = useState<Record<string, number>>({});
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});
  const [timelineError, setTimelineError] = useState<string | null>(null);

  const workspaceQuery = rpc.useQuery("workspaces.default", { projectId });
  const workspaceId = workspaceQuery.data?.id;

  const timelineQuery = rpc.useQuery("timeline.list", workspaceId ? { workspaceId } : skipToken);
  const contentQuery = rpc.useQuery(
    "content.exportSubtree",
    workspaceId ? { workspaceId } : skipToken,
  );
  const auxQuery = rpc.useQuery(
    "aux.snapshotTree",
    workspaceId && activeTimelinePointId
      ? { workspaceId, pointId: activeTimelinePointId }
      : skipToken,
  );

  const updateContent = rpc.useMutation("content.update");
  const createTimeline = rpc.useMutation("timeline.create");
  const moveTimeline = rpc.useMutation("timeline.move");
  const deleteTimeline = rpc.useMutation("timeline.delete");

  const workspaceIdRef = useRef<string | null>(workspaceId ?? null);
  const draftsRef = useRef(drafts);
  const committedBodiesRef = useRef(committedBodies);
  const updateContentRef = useRef(updateContent);

  useEffect(() => {
    workspaceIdRef.current = workspaceId ?? null;
  }, [workspaceId]);

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  useEffect(() => {
    committedBodiesRef.current = committedBodies;
  }, [committedBodies]);

  useEffect(() => {
    updateContentRef.current = updateContent;
  }, [updateContent]);

  const contentTree = useMemo(
    () => normalizeContentNodes(contentQuery.data?.nodes ?? []),
    [contentQuery.data],
  );
  const timelinePoints = useMemo(
    () => normalizeTimelinePoints(timelineQuery.data ?? []),
    [timelineQuery.data],
  );
  const auxTree = useMemo(() => normalizeAuxNodes(auxQuery.data?.nodes ?? []), [auxQuery.data]);

  const flatContentNodes = useMemo(() => flattenContentNodes(contentTree), [contentTree]);
  const contentNodeMap = useMemo(
    () => new Map(flatContentNodes.map((node) => [node.id, node])),
    [flatContentNodes],
  );
  const contentParentMap = useMemo(() => buildContentParentMap(contentTree), [contentTree]);
  const timelineLabelMap = useMemo(
    () => new Map(timelinePoints.map((point) => [point.id, point.label])),
    [timelinePoints],
  );
  const timelinePointIdSet = useMemo(
    () => new Set(timelinePoints.map((point) => point.id)),
    [timelinePoints],
  );
  const auxNodeIdSet = useMemo(
    () => new Set(flattenAuxNodes(auxTree).map((node) => node.id)),
    [auxTree],
  );

  const activeContentNode = activeContentNodeId
    ? (contentNodeMap.get(activeContentNodeId) ?? null)
    : null;
  const editorBody = activeContentNode
    ? (drafts[activeContentNode.id] ?? activeContentNode.body)
    : "";
  const activeTimelineLabel =
    (activeContentNode && timelineLabelMap.get(activeContentNode.anchorTimelinePointId)) ||
    (activeTimelinePointId ? timelineLabelMap.get(activeTimelinePointId) : undefined) ||
    "原点";
  const activeSaveBaseline = activeContentNode
    ? (committedBodies[activeContentNode.id] ?? activeContentNode.body)
    : "";
  const activeSaveState = {
    isSaving: activeContentNode ? (pendingSaveCounts[activeContentNode.id] ?? 0) > 0 : false,
    isDirty: activeContentNode ? editorBody !== activeSaveBaseline : false,
    error: activeContentNode ? (saveErrors[activeContentNode.id] ?? null) : null,
  };

  useEffect(() => {
    if (flatContentNodes.length === 0) {
      setActiveContentNodeId(null);
      return;
    }

    if (activeContentNodeId && contentNodeMap.has(activeContentNodeId)) {
      return;
    }

    const preferredNode = findPreferredContentNode(contentTree) ?? flatContentNodes[0] ?? null;
    if (preferredNode) {
      setActiveContentNodeId(preferredNode.id);
    }
  }, [activeContentNodeId, contentNodeMap, contentTree, flatContentNodes]);

  useEffect(() => {
    if (!activeContentNodeId) {
      return;
    }

    setExpandedContentIds((previous) => {
      const next = new Set(previous);
      let changed = false;

      for (const ancestorId of collectAncestorIds(contentParentMap, activeContentNodeId)) {
        if (!next.has(ancestorId)) {
          next.add(ancestorId);
          changed = true;
        }
      }

      return changed ? next : previous;
    });
  }, [activeContentNodeId, contentParentMap]);

  useEffect(() => {
    if (timelinePoints.length === 0) {
      setActiveTimelinePointId(null);
      return;
    }

    setActiveTimelinePointId((previous) => {
      if (previous && timelinePointIdSet.has(previous)) {
        return previous;
      }

      const preferredId = activeContentNode?.anchorTimelinePointId;
      if (preferredId && timelinePointIdSet.has(preferredId)) {
        return preferredId;
      }

      return timelinePoints[0]?.id ?? null;
    });
  }, [activeContentNode, timelinePointIdSet, timelinePoints]);

  useEffect(() => {
    if (auxTree.length === 0) {
      setActiveAuxNodeId(null);
      return;
    }

    if (activeAuxNodeId && auxNodeIdSet.has(activeAuxNodeId)) {
      return;
    }

    setActiveAuxNodeId(null);
  }, [activeAuxNodeId, auxNodeIdSet, auxTree]);

  useEffect(() => {
    if (auxTree.length === 0) {
      return;
    }

    const hasVisibleExpandedNode = [...expandedAuxIds].some((id) => auxNodeIdSet.has(id));
    if (hasVisibleExpandedNode) {
      return;
    }

    const nextExpandedIds = auxTree
      .filter((node) => node.nodeType === "dir")
      .slice(0, 2)
      .map((node) => node.id);
    if (nextExpandedIds.length > 0) {
      setExpandedAuxIds(new Set(nextExpandedIds));
    }
  }, [auxNodeIdSet, auxTree, expandedAuxIds]);

  useEffect(() => {
    setCommittedBodies((previous) => {
      let changed = false;
      const next = { ...previous };

      for (const [nodeId, committedBody] of Object.entries(previous)) {
        const node = contentNodeMap.get(nodeId);
        if (node?.body === committedBody) {
          delete next[nodeId];
          changed = true;
        }
      }

      return changed ? next : previous;
    });
  }, [contentNodeMap]);

  const flushBodySave = useCallback(async (nodeId: string, body: string) => {
    const currentWorkspaceId = workspaceIdRef.current;
    if (!currentWorkspaceId) {
      return;
    }

    setPendingSaveCounts((previous) => ({
      ...previous,
      [nodeId]: (previous[nodeId] ?? 0) + 1,
    }));
    setSaveErrors((previous) => omitRecordKey(previous, nodeId));

    try {
      await updateContentRef.current.mutate({
        workspaceId: currentWorkspaceId,
        nodeId,
        body,
      });
      setCommittedBodies((previous) => ({
        ...previous,
        [nodeId]: body,
      }));
    } catch (error) {
      setSaveErrors((previous) => ({
        ...previous,
        [nodeId]: error instanceof Error ? error.message : "保存失败，请稍后重试。",
      }));
    } finally {
      setPendingSaveCounts((previous) => {
        const nextCount = (previous[nodeId] ?? 1) - 1;
        if (nextCount <= 0) {
          return omitRecordKey(previous, nodeId);
        }

        return {
          ...previous,
          [nodeId]: nextCount,
        };
      });
    }
  }, []);

  useEffect(() => {
    if (!workspaceId || !activeContentNode) {
      return;
    }

    const draft = drafts[activeContentNode.id];
    if (draft === undefined) {
      return;
    }

    const baseline = committedBodies[activeContentNode.id] ?? activeContentNode.body;
    if (draft === baseline) {
      return;
    }

    const timeout = setTimeout(() => {
      void flushBodySave(activeContentNode.id, draft);
    }, AUTOSAVE_DELAY_MS);

    return () => clearTimeout(timeout);
  }, [activeContentNode, committedBodies, drafts, flushBodySave, workspaceId]);

  const toggleContentExpanded = (nodeId: string) => {
    setExpandedContentIds((previous) => {
      const next = new Set(previous);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const toggleAuxExpanded = (nodeId: string) => {
    setExpandedAuxIds((previous) => {
      const next = new Set(previous);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleContentSelect = (node: ContentTreeNodeVM) => {
    if (activeContentNode && activeContentNode.id !== node.id) {
      const currentBody = draftsRef.current[activeContentNode.id] ?? activeContentNode.body;
      const currentBaseline =
        committedBodiesRef.current[activeContentNode.id] ?? activeContentNode.body;
      if (currentBody !== currentBaseline) {
        void flushBodySave(activeContentNode.id, currentBody);
      }
    }

    setActiveContentNodeId(node.id);
    setActiveTimelinePointId(node.anchorTimelinePointId);
  };

  const handleBodyChange = (nextBody: string) => {
    if (!activeContentNode) {
      return;
    }

    setDrafts((previous) => ({
      ...previous,
      [activeContentNode.id]: nextBody,
    }));
    setSaveErrors((previous) => omitRecordKey(previous, activeContentNode.id));
  };

  const handleTimelineAdd = async () => {
    if (!workspaceId || !activeTimelinePointId) {
      return;
    }

    const newIndex = timelinePoints.filter((point) => !point.isImplicitOrigin).length + 1;
    setTimelineError(null);

    try {
      const point = await createTimeline.mutate({
        workspaceId,
        afterPointId: activeTimelinePointId,
        key: `timeline_${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`,
        label: `新时间点 ${newIndex}`,
        description: "",
      });
      setActiveTimelinePointId(point.id);
    } catch (error) {
      setTimelineError(error instanceof Error ? error.message : "创建时间点失败，请稍后重试。");
    }
  };

  const handleTimelineReorder = async (fromIndex: number, toIndex: number) => {
    if (!workspaceId) {
      return;
    }

    const movedPoint = timelinePoints[fromIndex];
    if (!movedPoint || movedPoint.isImplicitOrigin) {
      return;
    }

    const reorderedPoints = [...timelinePoints];
    reorderedPoints.splice(fromIndex, 1);
    reorderedPoints.splice(toIndex, 0, movedPoint);

    const orderedMovablePoints = reorderedPoints.filter((point) => !point.isImplicitOrigin);
    const newIndex = orderedMovablePoints.findIndex((point) => point.id === movedPoint.id);
    const afterPointId =
      newIndex <= 0
        ? ORIGIN_TIMELINE_POINT_ID
        : (orderedMovablePoints[newIndex - 1]?.id ?? ORIGIN_TIMELINE_POINT_ID);

    setTimelineError(null);

    try {
      await moveTimeline.mutate({
        workspaceId,
        pointId: movedPoint.id,
        afterPointId,
      });
    } catch (error) {
      setTimelineError(error instanceof Error ? error.message : "调整时间轴顺序失败，请稍后重试。");
    }
  };

  const handleTimelineDelete = async (pointId: string) => {
    if (!workspaceId || pointId === ORIGIN_TIMELINE_POINT_ID) {
      return;
    }

    setTimelineError(null);

    try {
      await deleteTimeline.mutate({
        workspaceId,
        pointId,
      });
      if (activeTimelinePointId === pointId) {
        setActiveTimelinePointId(ORIGIN_TIMELINE_POINT_ID);
      }
    } catch (error) {
      setTimelineError(error instanceof Error ? error.message : "删除时间点失败，请稍后重试。");
    }
  };

  const timelineBusy =
    createTimeline.isPending || moveTimeline.isPending || deleteTimeline.isPending;
  const pageError =
    workspaceQuery.error?.message ??
    contentQuery.error?.message ??
    timelineQuery.error?.message ??
    auxQuery.error?.message ??
    null;

  if (workspaceQuery.isLoading) {
    return (
      <FullPageMessage
        icon="icon-[material-symbols--sync]"
        title="正在加载项目"
        description="正在解析默认工作区并准备编辑数据。"
      />
    );
  }

  if (workspaceQuery.error) {
    return (
      <FullPageMessage
        icon="icon-[material-symbols--warning]"
        title="项目加载失败"
        description={workspaceQuery.error.message}
      />
    );
  }

  if (!workspaceId) {
    return (
      <FullPageMessage
        icon="icon-[material-symbols--folder-off]"
        title="未找到默认工作区"
        description="这个项目暂时没有可用的默认工作区，因此无法进入编辑页。"
      />
    );
  }

  return (
    <div className="flex h-dvh w-full select-none overflow-hidden bg-editor-background text-foreground">
      <div className="flex w-12 shrink-0 flex-col items-center gap-1 bg-activity-bar-background pt-2">
        <div className="flex w-full items-center justify-center border-l-2 border-l-activity-bar-active-foreground py-1">
          <span className="icon-[material-symbols--description] text-2xl text-activity-bar-active-foreground" />
        </div>
        <div className="flex w-full items-center justify-center py-1">
          <span className="icon-[material-symbols--search] text-2xl text-activity-bar-foreground" />
        </div>
        <div className="flex w-full items-center justify-center py-1">
          <span className="icon-[material-symbols--account-tree] text-2xl text-activity-bar-foreground" />
        </div>
        <div className="mt-auto flex w-full items-center justify-center py-2">
          <span className="icon-[material-symbols--settings] text-2xl text-activity-bar-foreground" />
        </div>
      </div>

      <div className="flex w-72 shrink-0 flex-col overflow-hidden border-r border-border bg-sidebar-background">
        {pageError ? (
          <div className="m-2 flex items-start gap-2 rounded-md border border-border bg-editor-background px-3 py-2 text-sm text-accent-foreground">
            <span className="icon-[material-symbols--warning] mt-0.5 shrink-0 text-base" />
            <span>{pageError}</span>
          </div>
        ) : null}

        <SidebarSection title="正文">
          {contentQuery.isLoading && contentTree.length === 0 ? (
            <PanelPlaceholder icon="icon-[material-symbols--sync]" label="正在加载正文..." />
          ) : (
            <ContentTreePanel
              tree={contentTree}
              expandedIds={expandedContentIds}
              onToggle={toggleContentExpanded}
              onSelect={handleContentSelect}
              activeId={activeContentNodeId}
              timelineLabelMap={timelineLabelMap}
            />
          )}
        </SidebarSection>

        <div className="border-t border-border" />
        <SidebarSection title="辅助信息">
          {auxQuery.isLoading && auxTree.length === 0 ? (
            <PanelPlaceholder
              icon="icon-[material-symbols--sync]"
              label="正在根据当前时间点加载辅助信息..."
            />
          ) : (
            <AuxTreePanel
              tree={auxTree}
              expandedIds={expandedAuxIds}
              onToggle={toggleAuxExpanded}
              activeId={activeAuxNodeId}
              onSelect={(node) => setActiveAuxNodeId(node.id)}
            />
          )}
        </SidebarSection>

        <div className="border-t border-border" />
        <SidebarSection
          title="时间轴"
          actions={
            <button
              type="button"
              onClick={handleTimelineAdd}
              disabled={timelineBusy || !activeTimelinePointId}
              className="icon-[material-symbols--add] text-base hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              title="添加时间点"
            />
          }
        >
          {timelineError ? (
            <div className="mx-2 mb-2 flex items-start gap-2 rounded-md border border-border bg-editor-background px-3 py-2 text-xs text-accent-foreground">
              <span className="icon-[material-symbols--warning] mt-0.5 shrink-0 text-sm" />
              <span>{timelineError}</span>
            </div>
          ) : null}
          {timelineQuery.isLoading && timelinePoints.length === 0 ? (
            <PanelPlaceholder icon="icon-[material-symbols--sync]" label="正在加载时间轴..." />
          ) : (
            <TimelinePanel
              points={timelinePoints}
              activeId={activeTimelinePointId}
              isBusy={timelineBusy}
              onSelect={setActiveTimelinePointId}
              onReorder={handleTimelineReorder}
              onDelete={handleTimelineDelete}
            />
          )}
        </SidebarSection>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <EditorArea
          node={activeContentNode}
          body={editorBody}
          timelineLabel={activeTimelineLabel}
          saveState={activeSaveState}
          onBodyChange={handleBodyChange}
        />
      </div>
    </div>
  );
}
