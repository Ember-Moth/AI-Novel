import { test, expect } from "bun:test";
import { createEditor, $createParagraphNode, $createTextNode, $getRoot } from "lexical";

import {
  $createAssistantMentionNode,
  AssistantMentionNode,
  compileAssistantComposerState,
} from "./assistantComposerModel";

test("compileAssistantComposerState collects mentions without adding labels to text", () => {
  const editor = createEditor({
    namespace: "AssistantComposerTest",
    nodes: [AssistantMentionNode],
    onError(error) {
      throw error;
    },
  });

  editor.update(
    () => {
      const root = $getRoot();
      root.clear();

      const first = $createParagraphNode();
      first.append(
        $createAssistantMentionNode({
          kind: "global-prompt",
          mode: "snapshot-ref",
          targetId: "prompt_expand",
          label: "章节扩写",
        }),
        $createTextNode(" 请扩写这一段"),
      );

      const second = $createParagraphNode();
      second.append($createTextNode("保持视角一致"));

      root.append(first, second);
    },
    { discrete: true },
  );

  expect(compileAssistantComposerState(editor.getEditorState())).toEqual({
    text: " 请扩写这一段\n保持视角一致",
    mentions: [
      {
        kind: "global-prompt",
        mode: "snapshot-ref",
        targetId: "prompt_expand",
        label: "章节扩写",
      },
    ],
  });
});
