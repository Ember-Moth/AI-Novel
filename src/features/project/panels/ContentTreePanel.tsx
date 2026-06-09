import { useState } from "react";

import { ContentNodeIcon } from "@/features/project/components/icons";
import { InlineEditableText } from "@/features/project/components/InlineEditableText";
import {
  ExpandToggle,
  RowActionButton,
  SidebarListRow,
  TreeNodePanel,
  type TreeRowContext,
} from "@/features/project/components/nodes";
import { PanelPlaceholder } from "@/features/project/components/PanelPlaceholder";
import { actionAnchorId } from "@/features/project/model/action-error";
import type { ContentTreeNodeVM } from "@/features/project/model/types";

function ContentTreeNodeRow({
  node,
  depth,
  hasChildren,
  isExpanded,
  isActive,
  onToggle,
  onSelect,
  onRename,
  onCreateChild,
  onDelete,
  timelineLabelMap,
  isBusy,
  canCreate,
}: {
  node: ContentTreeNodeVM;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
  isActive: boolean;
  onToggle: (_id: string) => void;
  onSelect: (_node: ContentTreeNodeVM) => void;
  onRename: (_nodeId: string, _title: string | null) => Promise<boolean>;
  onCreateChild: (_node: ContentTreeNodeVM, _anchorId: string) => void;
  onDelete: (_id: string, _anchorId: string) => void;
  timelineLabelMap: ReadonlyMap<string, string>;
  isBusy: boolean;
  canCreate: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const hasBody = node.body.trim().length > 0;
  const rowAnchorId = actionAnchorId("content", "row", node.id);
  const addChildAnchorId = actionAnchorId("content", "add-child", node.id);
  const deleteAnchorId = actionAnchorId("content", "delete", node.id);

  return (
    <SidebarListRow
      depth={depth}
      isActive={isActive}
      group
      anchorId={rowAnchorId}
      onClick={() => {
        onSelect(node);
        if (hasChildren && !isExpanded) {
          onToggle(node.id);
        }
      }}
      leading={
        <ExpandToggle
          hasChildren={hasChildren}
          expanded={isExpanded}
          onToggle={() => onToggle(node.id)}
        />
      }
      icon={<ContentNodeIcon hasBody={hasBody} hasChildren={hasChildren} />}
      label={
        <InlineEditableText
          value={node.title}
          disabled={isBusy}
          allowEmpty
          onEditStart={() => onSelect(node)}
          onEditingChange={setIsEditing}
          onCommit={async (next) => onRename(node.id, next || null)}
          placeholder="未命名节点"
          className="truncate"
        />
      }
      trailing={timelineLabelMap.get(node.anchorTimelinePointId) ?? node.anchorTimelinePointId}
      actions={
        <>
          <RowActionButton
            anchorId={addChildAnchorId}
            onClick={() => onCreateChild(node, addChildAnchorId)}
            disabled={isBusy || isEditing || !canCreate}
            title="添加子节点"
            icon="icon-[material-symbols--add]"
          />
          <RowActionButton
            anchorId={deleteAnchorId}
            onClick={() => onDelete(node.id, deleteAnchorId)}
            disabled={isBusy || isEditing}
            title="删除节点"
            icon="icon-[material-symbols--close]"
          />
        </>
      }
    />
  );
}

export function ContentTreePanel({
  tree,
  expandedIds,
  onToggle,
  onSelect,
  onRename,
  onCreateChild,
  onDelete,
  activeId,
  timelineLabelMap,
  isBusy,
  canCreate,
}: {
  tree: ContentTreeNodeVM[];
  expandedIds: Set<string>;
  onToggle: (_id: string) => void;
  onSelect: (_node: ContentTreeNodeVM) => void;
  onRename: (_nodeId: string, _title: string | null) => Promise<boolean>;
  onCreateChild: (_node: ContentTreeNodeVM, _anchorId: string) => void;
  onDelete: (_id: string, _anchorId: string) => void;
  activeId: string | null;
  timelineLabelMap: ReadonlyMap<string, string>;
  isBusy: boolean;
  canCreate: boolean;
}) {
  if (tree.length === 0) {
    return (
      <PanelPlaceholder
        icon="icon-[material-symbols--edit-note]"
        label="还没有正文节点。点击上方 + 创建。"
      />
    );
  }

  const renderRow = (ctx: TreeRowContext<ContentTreeNodeVM>) => (
    <ContentTreeNodeRow
      node={ctx.node}
      depth={ctx.depth}
      hasChildren={ctx.hasChildren}
      isExpanded={ctx.isExpanded}
      isActive={ctx.isActive}
      onToggle={onToggle}
      onSelect={onSelect}
      onRename={onRename}
      onCreateChild={onCreateChild}
      onDelete={onDelete}
      timelineLabelMap={timelineLabelMap}
      isBusy={isBusy}
      canCreate={canCreate}
    />
  );

  return (
    <div className="pb-2">
      <TreeNodePanel
        nodes={tree}
        expandedIds={expandedIds}
        activeId={activeId}
        getId={(node) => node.id}
        getChildren={(node) => node.children}
        renderRow={renderRow}
      />
    </div>
  );
}
