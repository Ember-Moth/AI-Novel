import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { AuxTreeNodeVM } from "@/modules/workspace/ui/editor/model/types";

import { AuxTreePanel } from "./AuxTreePanel";

function createAuxNode(overrides: Partial<AuxTreeNodeVM> & Pick<AuxTreeNodeVM, "id" | "name">) {
  const { id, name, ...rest } = overrides;
  return {
    id,
    nodeType: "file",
    name,
    content: "",
    path: `/${name}`,
    symlinkTargetPath: null,
    hasTimelineChange: false,
    isDeleted: false,
    children: [],
    ...rest,
  } satisfies AuxTreeNodeVM;
}

test("AuxTreePanel renders create-symlink actions for non-deleted entries only", () => {
  const html = renderToStaticMarkup(
    <AuxTreePanel
      tree={[
        createAuxNode({ id: "dir_1", name: "设定", nodeType: "dir" }),
        createAuxNode({ id: "file_1", name: "notes.md" }),
        createAuxNode({
          id: "symlink_1",
          name: "角色入口",
          nodeType: "symlink",
          symlinkTargetPath: "/设定/角色.md",
        }),
        createAuxNode({ id: "deleted_1", name: "旧资料", isDeleted: true }),
      ]}
      expandedIds={new Set()}
      onToggle={() => {}}
      activeId={null}
      onSelect={() => {}}
      onRename={async () => true}
      onCreateChildDir={() => {}}
      onCreateChildFile={() => {}}
      onCreateSymlink={() => {}}
      onDelete={() => {}}
      onRestore={() => {}}
      isBusy={false}
      isPending={false}
      showTimelineChanges={false}
    />,
  );

  expect(html).toContain('data-action-anchor="aux:create-symlink:dir_1"');
  expect(html).toContain('data-action-anchor="aux:create-symlink:file_1"');
  expect(html).toContain('data-action-anchor="aux:create-symlink:symlink_1"');
  expect(html).not.toContain('data-action-anchor="aux:create-symlink:deleted_1"');
});
