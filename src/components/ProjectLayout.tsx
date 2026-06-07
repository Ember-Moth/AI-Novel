import { skipToken } from "@codehz/rpc";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { rpc } from "@/api/client";

const ORIGIN_TIMELINE_POINT_ID = "origin";
const AUTOSAVE_DELAY_MS = 600;

interface ContentTreeNodeVM {
  id: string;
  title: string;
  body: string;
  anchorTimelinePointId: string;
  children: ContentTreeNodeVM[];
}

interface TimelinePointVM {
  id: string;
  key: string;
  label: string;
  description: string;
  isImplicitOrigin: boolean;
}

interface AuxTreeNodeVM {
  id: string;
  nodeType: "dir" | "file" | "symlink";
  name: string;
  content: string;
  path: string;
  symlinkTargetPath: string | null;
  children: AuxTreeNodeVM[];
}

interface RawContentTreeNode {
  id: string;
  title: string | null;
  body: string | null;
  anchorTimelinePointId: string;
  children: RawContentTreeNode[];
}

interface RawTimelinePoint {
  id: string;
  key: string;
  label: string;
  description: string | null;
  isImplicitOrigin: boolean;
}

interface RawAuxTreeNode {
  id: string;
  nodeType: string;
  name: string | null;
  content: string | null;
  path: string;
  symlinkTargetPath: string | null;
  children: RawAuxTreeNode[];
}

function omitRecordKey<TValue>(record: Record<string, TValue>, key: string) {
  if (!(key in record)) {
    return record;
  }

  const next = { ...record };
  delete next[key];
  return next;
}

function normalizeContentNodes(nodes: RawContentTreeNode[]): ContentTreeNodeVM[] {
  return nodes.map((node) => ({
    id: node.id,
    title: node.title?.trim() || "未命名节点",
    body: node.body ?? "",
    anchorTimelinePointId: node.anchorTimelinePointId,
    children: normalizeContentNodes(node.children),
  }));
}

function normalizeTimelinePoints(points: RawTimelinePoint[]): TimelinePointVM[] {
  return points.map((point) => ({
    id: point.id,
    key: point.key,
    label: point.isImplicitOrigin ? "原点" : point.label,
    description: point.isImplicitOrigin ? "故事初始状态" : (point.description ?? ""),
    isImplicitOrigin: point.isImplicitOrigin,
  }));
}

function normalizeAuxNodes(nodes: RawAuxTreeNode[]): AuxTreeNodeVM[] {
  return nodes
    .filter(
      (node): node is RawAuxTreeNode & { nodeType: "dir" | "file" | "symlink" } =>
        node.nodeType === "dir" || node.nodeType === "file" || node.nodeType === "symlink",
    )
    .map((node) => ({
      id: node.id,
      nodeType: node.nodeType,
      name: node.name?.trim() || "(未命名)",
      content: node.content ?? "",
      path: node.path,
      symlinkTargetPath: node.symlinkTargetPath,
      children: normalizeAuxNodes(node.children),
    }));
}

function flattenContentNodes(nodes: ContentTreeNodeVM[]): ContentTreeNodeVM[] {
  return nodes.flatMap((node) => [node, ...flattenContentNodes(node.children)]);
}

function flattenAuxNodes(nodes: AuxTreeNodeVM[]): AuxTreeNodeVM[] {
  return nodes.flatMap((node) => [node, ...flattenAuxNodes(node.children)]);
}

function buildContentParentMap(nodes: ContentTreeNodeVM[], parentId: string | null = null) {
  const map = new Map<string, string | null>();

  for (const node of nodes) {
    map.set(node.id, parentId);
    for (const [childId, childParentId] of buildContentParentMap(node.children, node.id)) {
      map.set(childId, childParentId);
    }
  }

  return map;
}

function collectAncestorIds(parentMap: Map<string, string | null>, nodeId: string) {
  const ancestors: string[] = [];
  let currentId = parentMap.get(nodeId) ?? null;

  while (currentId) {
    ancestors.push(currentId);
    currentId = parentMap.get(currentId) ?? null;
  }

  return ancestors;
}

function findPreferredContentNode(nodes: ContentTreeNodeVM[]): ContentTreeNodeVM | null {
  for (const node of nodes) {
    const childPreferred = findPreferredContentNode(node.children);
    if (childPreferred) {
      return childPreferred;
    }
    if (node.body.trim()) {
      return node;
    }
  }

  return nodes[0] ?? null;
}

function ContentNodeIcon({ hasBody, hasChildren }: { hasBody: boolean; hasChildren: boolean }) {
  const icon =
    !hasBody && !hasChildren
      ? "icon-[material-symbols--circle] text-icon-empty"
      : hasBody && !hasChildren
        ? "icon-[material-symbols--description] text-icon-leaf"
        : !hasBody && hasChildren
          ? "icon-[material-symbols--account-tree] text-icon-folder"
          : "icon-[material-symbols--overview] text-icon-mixed";

  return <span className={`${icon} shrink-0 text-base`} />;
}

function AuxNodeIcon({ nodeType }: { nodeType: string }) {
  const iconMap: Record<string, string> = {
    dir: "icon-[material-symbols--folder] text-icon-folder",
    "dir-open": "icon-[material-symbols--folder-open] text-icon-folder",
    file: "icon-[material-symbols--description] text-foreground-muted",
    symlink: "icon-[material-symbols--link] text-accent-foreground",
  };

  return (
    <span
      className={`${iconMap[nodeType] ?? "icon-[material-symbols--description] text-foreground-muted"} shrink-0 text-base`}
    />
  );
}

function SidebarSection({
  title,
  actions,
  defaultExpanded = true,
  children,
}: {
  title: string;
  actions?: ReactNode;
  defaultExpanded?: boolean;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="flex shrink-0 flex-col">
      <div
        className="flex shrink-0 cursor-pointer items-center gap-1 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-foreground-muted hover:text-foreground"
        onClick={() => setExpanded((value) => !value)}
        role="button"
        tabIndex={0}
      >
        <span
          className={`w-4 shrink-0 text-base ${expanded ? "icon-[material-symbols--keyboard-arrow-down]" : "icon-[material-symbols--keyboard-arrow-right]"}`}
        />
        <span className="truncate">{title}</span>
        {actions ? (
          <span
            className="ml-auto flex items-center gap-1"
            onClick={(event) => event.stopPropagation()}
          >
            {actions}
          </span>
        ) : null}
      </div>
      {expanded ? <div className="overflow-auto">{children}</div> : null}
    </div>
  );
}

function PanelPlaceholder({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-3 text-sm text-foreground-muted">
      <span className={`${icon} shrink-0 text-base`} />
      <span>{label}</span>
    </div>
  );
}

function ContentTreeNodeRow({
  node,
  depth,
  expandedIds,
  onToggle,
  onSelect,
  activeId,
  timelineLabelMap,
}: {
  node: ContentTreeNodeVM;
  depth: number;
  expandedIds: Set<string>;
  onToggle: (_id: string) => void;
  onSelect: (_node: ContentTreeNodeVM) => void;
  activeId: string | null;
  timelineLabelMap: ReadonlyMap<string, string>;
}) {
  const hasChildren = node.children.length > 0;
  const hasBody = node.body.trim().length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isActive = activeId === node.id;

  return (
    <div>
      <button
        type="button"
        className={`flex w-full items-center gap-1 py-0.75 pr-2 text-[13px] ${
          isActive
            ? "bg-list-active-background text-foreground"
            : "text-foreground hover:bg-list-hover-background"
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => {
          onSelect(node);
          if (hasChildren && !isExpanded) {
            onToggle(node.id);
          }
        }}
      >
        {hasChildren ? (
          <span
            className={`w-4 shrink-0 cursor-pointer text-base ${
              isExpanded
                ? "icon-[material-symbols--keyboard-arrow-down]"
                : "icon-[material-symbols--keyboard-arrow-right]"
            }`}
            onClick={(event) => {
              event.stopPropagation();
              onToggle(node.id);
            }}
          />
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <ContentNodeIcon hasBody={hasBody} hasChildren={hasChildren} />
        <span className="truncate">{node.title}</span>
        <span className="ml-auto shrink-0 text-[10px] text-accent-foreground opacity-70">
          {timelineLabelMap.get(node.anchorTimelinePointId) ?? node.anchorTimelinePointId}
        </span>
      </button>
      {hasChildren && isExpanded ? (
        <div>
          {node.children.map((child) => (
            <ContentTreeNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onSelect={onSelect}
              activeId={activeId}
              timelineLabelMap={timelineLabelMap}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ContentTreePanel({
  tree,
  expandedIds,
  onToggle,
  onSelect,
  activeId,
  timelineLabelMap,
}: {
  tree: ContentTreeNodeVM[];
  expandedIds: Set<string>;
  onToggle: (_id: string) => void;
  onSelect: (_node: ContentTreeNodeVM) => void;
  activeId: string | null;
  timelineLabelMap: ReadonlyMap<string, string>;
}) {
  if (tree.length === 0) {
    return <PanelPlaceholder icon="icon-[material-symbols--edit-note]" label="还没有正文节点。" />;
  }

  return (
    <div className="pb-2">
      {tree.map((node) => (
        <ContentTreeNodeRow
          key={node.id}
          node={node}
          depth={0}
          expandedIds={expandedIds}
          onToggle={onToggle}
          onSelect={onSelect}
          activeId={activeId}
          timelineLabelMap={timelineLabelMap}
        />
      ))}
    </div>
  );
}

function AuxTreeNodeRow({
  node,
  depth,
  expandedIds,
  onToggle,
  activeId,
  onSelect,
}: {
  node: AuxTreeNodeVM;
  depth: number;
  expandedIds: Set<string>;
  onToggle: (_id: string) => void;
  onSelect: (_node: AuxTreeNodeVM) => void;
  activeId: string | null;
}) {
  const isDir = node.nodeType === "dir";
  const isExpanded = expandedIds.has(node.id);
  const isActive = activeId === node.id;

  if (isDir) {
    return (
      <div>
        <button
          type="button"
          className={`flex w-full items-center gap-1 py-0.75 pr-2 text-[13px] ${
            isActive
              ? "bg-list-active-background text-foreground"
              : "text-foreground hover:bg-list-hover-background"
          }`}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
          onClick={() => {
            onSelect(node);
            onToggle(node.id);
          }}
        >
          <span
            className={`w-4 shrink-0 text-base ${
              isExpanded
                ? "icon-[material-symbols--keyboard-arrow-down]"
                : "icon-[material-symbols--keyboard-arrow-right]"
            }`}
          />
          <AuxNodeIcon nodeType={isExpanded ? "dir-open" : "dir"} />
          <span className="truncate">{node.name}</span>
        </button>
        {isExpanded ? (
          <div>
            {node.children.map((child) => (
              <AuxTreeNodeRow
                key={child.id}
                node={child}
                depth={depth + 1}
                expandedIds={expandedIds}
                onToggle={onToggle}
                activeId={activeId}
                onSelect={onSelect}
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`flex w-full items-center gap-1 py-0.75 pr-2 text-[13px] ${
        isActive
          ? "bg-list-active-background text-foreground"
          : "text-foreground hover:bg-list-hover-background"
      }`}
      style={{ paddingLeft: `${8 + depth * 16 + 16}px` }}
      onClick={() => onSelect(node)}
      title={node.path}
    >
      <span className="w-4 shrink-0" />
      <AuxNodeIcon nodeType={node.nodeType} />
      <span className="truncate">{node.name}</span>
      {node.nodeType === "symlink" && node.symlinkTargetPath ? (
        <span className="ml-1 truncate text-[11px] text-accent-foreground">
          → {node.symlinkTargetPath}
        </span>
      ) : null}
    </button>
  );
}

function AuxTreePanel({
  tree,
  expandedIds,
  onToggle,
  activeId,
  onSelect,
}: {
  tree: AuxTreeNodeVM[];
  expandedIds: Set<string>;
  onToggle: (_id: string) => void;
  activeId: string | null;
  onSelect: (_node: AuxTreeNodeVM) => void;
}) {
  if (tree.length === 0) {
    return (
      <PanelPlaceholder
        icon="icon-[material-symbols--folder-off]"
        label="该时间点下暂无辅助信息。"
      />
    );
  }

  return (
    <div className="pb-2">
      {tree.map((node) => (
        <AuxTreeNodeRow
          key={node.id}
          node={node}
          depth={0}
          expandedIds={expandedIds}
          onToggle={onToggle}
          activeId={activeId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function TimelinePanel({
  points,
  activeId,
  isBusy,
  onSelect,
  onReorder,
  onDelete,
}: {
  points: TimelinePointVM[];
  activeId: string | null;
  isBusy: boolean;
  onSelect: (_id: string) => void;
  onReorder: (_fromIndex: number, _toIndex: number) => void;
  onDelete: (_id: string) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  return (
    <div className="pb-2">
      {points.map((point, index) => {
        const isActive = point.id === activeId;
        const isDragging = dragIndex === index;
        const isDragOver = dragOverIndex === index;

        return (
          <div
            key={point.id}
            className={`flex cursor-pointer items-center gap-1 py-0.75 pr-1 text-[13px] ${
              isDragging ? "opacity-40" : ""
            } ${isDragOver ? "border-t border-t-drag-border" : ""} ${
              isActive
                ? "bg-list-active-background text-foreground"
                : "text-foreground hover:bg-list-hover-background"
            } ${point.isImplicitOrigin ? "opacity-90" : ""}`}
            style={{ paddingLeft: "8px" }}
            draggable={!point.isImplicitOrigin && !isBusy}
            onDragStart={(event) => {
              if (point.isImplicitOrigin || isBusy) {
                event.preventDefault();
                return;
              }

              setDragIndex(index);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", String(index));
            }}
            onDragOver={(event) => {
              if (dragIndex === null || isBusy || dragIndex === index) {
                return;
              }

              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setDragOverIndex(index);
            }}
            onDragLeave={() => setDragOverIndex(null)}
            onDrop={(event) => {
              event.preventDefault();
              if (dragIndex !== null && dragIndex !== index) {
                onReorder(dragIndex, index);
              }
              setDragIndex(null);
              setDragOverIndex(null);
            }}
            onDragEnd={() => {
              setDragIndex(null);
              setDragOverIndex(null);
            }}
            onClick={() => onSelect(point.id)}
          >
            <span className="icon-[material-symbols--radio-button-checked] shrink-0 text-sm text-foreground-muted" />
            <span className="truncate">{point.label}</span>
            {point.description ? (
              <span className="truncate text-[11px] text-foreground-muted">
                {point.description}
              </span>
            ) : null}
            {!point.isImplicitOrigin ? (
              <button
                type="button"
                className="ml-auto rounded p-px text-foreground-muted opacity-0 hover:bg-button-hover-background hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(point.id);
                }}
                disabled={isBusy}
                title="删除时间点"
              >
                <span className="icon-[material-symbols--close] text-sm leading-none" />
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function EditorArea({
  node,
  body,
  timelineLabel,
  saveState,
  onBodyChange,
}: {
  node: ContentTreeNodeVM | null;
  body: string;
  timelineLabel: string;
  saveState: { isSaving: boolean; isDirty: boolean; error: string | null };
  onBodyChange: (_value: string) => void;
}) {
  if (!node) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-foreground-muted">
        选择一个正文节点开始编辑
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-title-bar-background px-4 py-2">
        <ContentNodeIcon
          hasBody={node.body.trim().length > 0}
          hasChildren={node.children.length > 0}
        />
        <span className="text-[14px] text-foreground">{node.title}</span>
        {saveState.error ? (
          <span className="ml-auto text-[11px] text-red-300">{saveState.error}</span>
        ) : saveState.isSaving ? (
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-accent-foreground">
            <span className="icon-[material-symbols--sync] animate-spin text-sm" />
            保存中...
          </span>
        ) : saveState.isDirty ? (
          <span className="ml-auto text-[11px] text-foreground-muted">待保存</span>
        ) : (
          <span className="ml-auto text-[11px] text-foreground-muted">已同步</span>
        )}
        <span className="shrink-0 text-[11px] text-accent-foreground">
          时间锚点: {timelineLabel}
        </span>
      </div>
      <textarea
        className="flex-1 resize-none border-none bg-editor-background p-4 font-mono text-[14px] leading-7 text-editor-foreground outline-none"
        value={body}
        onChange={(event) => onBodyChange(event.target.value)}
        placeholder="开始写作..."
      />
    </div>
  );
}

function FullPageMessage({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-dvh items-center justify-center bg-editor-background px-6 text-foreground">
      <div className="flex max-w-md flex-col items-center gap-3 rounded-lg border border-border bg-sidebar-background px-6 py-8 text-center">
        <span className={`${icon} text-3xl text-foreground-muted`} />
        <h1 className="text-base font-semibold">{title}</h1>
        <p className="text-sm text-foreground-muted">{description}</p>
      </div>
    </div>
  );
}

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
