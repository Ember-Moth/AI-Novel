import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { AuxTreeNodeVM } from "@/modules/workspace/ui/editor/model/types";

import { EditorArea } from "./EditorArea";

function createAuxNode(overrides: Partial<AuxTreeNodeVM> = {}): AuxTreeNodeVM {
  return {
    id: "source_link",
    nodeType: "symlink",
    name: "角色入口",
    content: "",
    path: "/索引/角色入口",
    symlinkTargetAuxNodeId: "target_file",
    symlinkTargetPath: "/设定/角色.md",
    hasTimelineChange: false,
    isDeleted: false,
    children: [],
    ...overrides,
  };
}

test("EditorArea keeps symlink placeholder text in normal mode", () => {
  const html = renderToStaticMarkup(
    <EditorArea
      target="aux"
      contentNode={null}
      auxNode={createAuxNode()}
      body=""
      auxContent=""
      timelineLabel="原点"
      contentSaveState={{ isSaving: false, isDirty: false, error: null }}
      auxSaveState={{ isSaving: false, isDirty: false, error: null }}
      auxPending={false}
      isAuxSymlinkTargetPickerActive={false}
      onBodyChange={() => {}}
      onAuxContentChange={() => {}}
    />,
  );

  expect(html).toContain("符号链接，请打开目标文件进行编辑");
});

test("EditorArea switches symlink placeholder while target picker is active", () => {
  const html = renderToStaticMarkup(
    <EditorArea
      target="aux"
      contentNode={null}
      auxNode={createAuxNode()}
      body=""
      auxContent=""
      timelineLabel="原点"
      contentSaveState={{ isSaving: false, isDirty: false, error: null }}
      auxSaveState={{ isSaving: false, isDirty: false, error: null }}
      auxPending={false}
      isAuxSymlinkTargetPickerActive
      onBodyChange={() => {}}
      onAuxContentChange={() => {}}
    />,
  );

  expect(html).toContain("正在选择新的符号链接目标");
});
