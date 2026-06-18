import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { MessageList } from "./MessageList";

test("MessageList uses sidebar card tables for assistant markdown in chat", () => {
  const html = renderToStaticMarkup(
    <MessageList
      messages={[
        {
          id: "assistant_1",
          role: "assistant",
          parts: [
            {
              type: "text",
              text: "| 工具 | 结果 |\n| - | - |\n| `create_manuscript_node` | 已创建节点 |",
              state: "done",
            },
          ],
        } as any,
      ]}
      allMessages={[]}
      candidateGroups={[]}
      isStreaming={false}
      onSelectBranch={() => {}}
      onSubmitAskUser={() => {}}
    />,
  );

  expect(html).toContain('data-ai-sidebar-table="root"');
  expect(html).toContain("create_manuscript_node");
  expect(html).toContain("已创建节点");
});
