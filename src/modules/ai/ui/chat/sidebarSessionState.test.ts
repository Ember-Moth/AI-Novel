import { expect, test } from "bun:test";

import { resolveSidebarActiveChat } from "./sidebarSessionState";

test("resolveSidebarActiveChat keeps the current active chat when it remains visible", () => {
  expect(
    resolveSidebarActiveChat({
      activeChatId: "chat_b",
      visibleChatIds: ["chat_a", "chat_b"],
      canAutoCreateWhenEmpty: true,
    }),
  ).toEqual({
    nextActiveChatId: "chat_b",
    shouldAutoCreate: false,
  });
});

test("resolveSidebarActiveChat falls back to the first visible chat when the active chat is filtered out", () => {
  expect(
    resolveSidebarActiveChat({
      activeChatId: "archived_chat",
      visibleChatIds: ["chat_a", "chat_b"],
      canAutoCreateWhenEmpty: false,
    }),
  ).toEqual({
    nextActiveChatId: "chat_a",
    shouldAutoCreate: false,
  });
});

test("resolveSidebarActiveChat does not auto-create when hiding archived leaves the list empty after initialization", () => {
  expect(
    resolveSidebarActiveChat({
      activeChatId: "archived_chat",
      visibleChatIds: [],
      canAutoCreateWhenEmpty: false,
    }),
  ).toEqual({
    nextActiveChatId: null,
    shouldAutoCreate: false,
  });
});

test("resolveSidebarActiveChat auto-creates only when the initial empty state allows it", () => {
  expect(
    resolveSidebarActiveChat({
      activeChatId: null,
      visibleChatIds: [],
      canAutoCreateWhenEmpty: true,
    }),
  ).toEqual({
    nextActiveChatId: null,
    shouldAutoCreate: true,
  });
});
