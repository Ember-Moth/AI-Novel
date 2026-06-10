import { expect, test } from "bun:test";

import { getAssistantToolTrace, listAssistantContextDetails } from "./assistantState";

test("getAssistantToolTrace extracts tool summaries from node parts", () => {
  expect(
    getAssistantToolTrace({
      id: "node_tool",
      threadId: "thread_1",
      parentNodeId: "node_user",
      role: "assistant",
      createdByRunId: "run_1",
      sourceStepId: "step_1",
      sourceKind: "model_response",
      summaryText: "tool call",
      message: {
        role: "assistant",
        content: [{ type: "tool-call", toolCallId: "tool_1", toolName: "lookup", input: {} }],
      },
      parts: [
        {
          id: "part_1",
          nodeId: "node_tool",
          partIndex: 0,
          partKind: "tool-call",
          visibility: "internal",
          state: "done",
          providerOptions: null,
          providerMetadata: null,
          payload: {
            type: "tool-call",
            toolCallId: "tool_1",
            toolName: "lookup",
            input: {},
          },
          createdAt: 1,
        },
      ],
      createdAt: 1,
    }),
  ).toEqual([
    {
      toolCallId: "tool_1",
      toolName: "lookup",
      summary: "调用 lookup",
      status: "success",
      nodeId: "node_tool",
      runId: "run_1",
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
