import { expect, test } from "bun:test";

import { getAssistantToolTrace, listAssistantContextDetails } from "./assistantState";

test("getAssistantToolTrace reads valid tool trace entries from metadata", () => {
  expect(
    getAssistantToolTrace({
      finishReason: "stop",
      toolTrace: [
        {
          toolName: "read_current_writing_context",
          summary: "读取写作上下文：Scene 1",
          status: "success",
        },
        {
          toolName: "broken",
          summary: "broken",
          status: "error",
        },
        {
          toolName: "invalid",
          status: "success",
        },
      ],
    }),
  ).toEqual([
    {
      toolName: "read_current_writing_context",
      summary: "读取写作上下文：Scene 1",
      status: "success",
    },
    {
      toolName: "broken",
      summary: "broken",
      status: "error",
    },
  ]);
});

test("listAssistantContextDetails formats current context chips", () => {
  expect(
    listAssistantContextDetails({
      workspaceId: "workspace_main",
      activeContentNodeId: "content_1",
      activeContentTitle: "第 1 场",
      activeAuxNodeId: "aux_1",
      activeAuxPath: "notes/scene-1.md",
      activeTimelinePointId: "timeline_now",
      activeTimelineLabel: "现在",
    }),
  ).toEqual([
    {
      label: "正文",
      value: "第 1 场",
    },
    {
      label: "辅助",
      value: "notes/scene-1.md",
    },
    {
      label: "时间",
      value: "现在",
    },
  ]);
});
