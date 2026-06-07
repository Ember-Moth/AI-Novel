import { PanelPlaceholder } from "./PanelPlaceholder";
import { ContentNodeIcon } from "./icons";
import type { ContentTreeNodeVM } from "./types";

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

export function ContentTreePanel({
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
