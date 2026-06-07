import { PanelPlaceholder } from "./PanelPlaceholder";
import { ContentNodeIcon } from "./icons";
import type { ContentTreeNodeVM } from "./types";

function ContentTreeNodeRow({
  node,
  depth,
  expandedIds,
  onToggle,
  onSelect,
  onCreateChild,
  onDelete,
  activeId,
  timelineLabelMap,
  isBusy,
}: {
  node: ContentTreeNodeVM;
  depth: number;
  expandedIds: Set<string>;
  onToggle: (_id: string) => void;
  onSelect: (_node: ContentTreeNodeVM) => void;
  onCreateChild: (_node: ContentTreeNodeVM) => void;
  onDelete: (_id: string) => void;
  activeId: string | null;
  timelineLabelMap: ReadonlyMap<string, string>;
  isBusy: boolean;
}) {
  const hasChildren = node.children.length > 0;
  const hasBody = node.body.trim().length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isActive = activeId === node.id;

  return (
    <div>
      <div
        className={`group flex w-full items-center gap-1 py-0.75 pr-2 text-[13px] ${
          isActive
            ? "bg-list-active-background text-foreground"
            : "text-foreground hover:bg-list-hover-background"
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            className={`w-4 shrink-0 text-base ${
              isExpanded
                ? "icon-[material-symbols--keyboard-arrow-down]"
                : "icon-[material-symbols--keyboard-arrow-right]"
            }`}
            onClick={() => onToggle(node.id)}
          />
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1"
          onClick={() => {
            onSelect(node);
            if (hasChildren && !isExpanded) {
              onToggle(node.id);
            }
          }}
        >
          <ContentNodeIcon hasBody={hasBody} hasChildren={hasChildren} />
          <span className="truncate">{node.title}</span>
        </button>
        <button
          type="button"
          onClick={() => onCreateChild(node)}
          disabled={isBusy}
          className="shrink-0 rounded p-0.5 text-foreground-muted opacity-0 transition hover:bg-button-hover-background hover:text-foreground group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30"
          title="添加子节点"
        >
          <span className="icon-[material-symbols--add] text-sm leading-none" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(node.id)}
          disabled={isBusy}
          className="shrink-0 rounded p-0.5 text-foreground-muted opacity-0 transition hover:bg-button-hover-background hover:text-foreground group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30"
          title="删除节点"
        >
          <span className="icon-[material-symbols--close] text-sm leading-none" />
        </button>
        <span className="shrink-0 text-[10px] text-accent-foreground opacity-70">
          {timelineLabelMap.get(node.anchorTimelinePointId) ?? node.anchorTimelinePointId}
        </span>
      </div>
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
              onCreateChild={onCreateChild}
              onDelete={onDelete}
              activeId={activeId}
              timelineLabelMap={timelineLabelMap}
              isBusy={isBusy}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ContentTreePanel({
  tree,
  expandedIds,
  onToggle,
  onSelect,
  onCreateChild,
  onDelete,
  activeId,
  timelineLabelMap,
  isBusy,
}: {
  tree: ContentTreeNodeVM[];
  expandedIds: Set<string>;
  onToggle: (_id: string) => void;
  onSelect: (_node: ContentTreeNodeVM) => void;
  onCreateChild: (_node: ContentTreeNodeVM) => void;
  onDelete: (_id: string) => void;
  activeId: string | null;
  timelineLabelMap: ReadonlyMap<string, string>;
  isBusy: boolean;
}) {
  if (tree.length === 0) {
    return (
      <PanelPlaceholder
        icon="icon-[material-symbols--edit-note]"
        label="还没有正文节点。点击上方 + 创建。"
      />
    );
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
          onCreateChild={onCreateChild}
          onDelete={onDelete}
          activeId={activeId}
          timelineLabelMap={timelineLabelMap}
          isBusy={isBusy}
        />
      ))}
    </div>
  );
}
