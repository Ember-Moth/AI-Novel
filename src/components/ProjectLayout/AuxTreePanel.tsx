import { PanelPlaceholder } from "./PanelPlaceholder";
import { AuxNodeIcon } from "./icons";
import type { AuxTreeNodeVM } from "./types";

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

export function AuxTreePanel({
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
