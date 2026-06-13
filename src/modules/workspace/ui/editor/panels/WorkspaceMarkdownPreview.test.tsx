import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { WorkspaceMarkdownPreview } from "./WorkspaceMarkdownPreview";

test("WorkspaceMarkdownPreview renders markdown content", () => {
  const html = renderToStaticMarkup(
    <WorkspaceMarkdownPreview content={"# 标题\n\n- 条目"} emptyLabel="暂无内容" />,
  );

  expect(html).toContain('data-streamdown="heading-1"');
  expect(html).toContain('data-streamdown="unordered-list"');
});

test("WorkspaceMarkdownPreview renders empty state", () => {
  const html = renderToStaticMarkup(
    <WorkspaceMarkdownPreview content="   " emptyLabel="暂无内容" />,
  );

  expect(html).toContain("暂无内容");
});
