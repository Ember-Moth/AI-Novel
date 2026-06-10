import { expect, test } from "bun:test";

import {
  applyStreamEvent,
  buildSessionRows,
  createStreamOverlay,
  resolveExpectedActiveThreadAfterArchiveToggle,
} from "./useAiAssistantController";

const baseThread = {
  projectId: "project_1",
  agentProfile: "project-assistant",
  activeTipNodeId: null,
  createdAt: 1,
  updatedAt: 1,
} as const;

test("buildSessionRows adds archived toggle and archived rows when expanded", () => {
  const rows = buildSessionRows({
    unarchivedThreads: [
      {
        ...baseThread,
        id: "thread_a",
        title: "A",
        archivedAt: null,
      },
    ],
    archivedThreads: [
      {
        ...baseThread,
        id: "thread_b",
        title: "B",
        archivedAt: 2,
      },
    ],
    showArchivedThreads: true,
  });

  expect(rows.map((row) => row.type)).toEqual(["thread", "archived-toggle", "thread"]);
});

test("resolveExpectedActiveThreadAfterArchiveToggle chooses fallback when archiving active thread", () => {
  const result = resolveExpectedActiveThreadAfterArchiveToggle({
    activeThreadId: "thread_a",
    thread: {
      ...baseThread,
      id: "thread_a",
      title: "A",
      archivedAt: null,
    },
    archived: true,
    unarchivedThreads: [
      {
        ...baseThread,
        id: "thread_a",
        title: "A",
        archivedAt: null,
      },
      {
        ...baseThread,
        id: "thread_b",
        title: "B",
        archivedAt: null,
      },
    ],
  });

  expect(result).toBe("thread_b");
});

test("applyStreamEvent updates step count as soon as a step starts", () => {
  const overlay = createStreamOverlay({
    kind: "send",
    threadId: "thread_a",
    triggerNodeId: null,
  });

  expect(
    applyStreamEvent(overlay, {
      type: "step-started",
      stepIndex: 0,
    }).stepCount,
  ).toBe(1);
});

test("applyStreamEvent accumulates usage tokens as steps finish", () => {
  const overlay = createStreamOverlay({
    kind: "send",
    threadId: "thread_a",
    triggerNodeId: null,
  });

  const afterFirstStep = applyStreamEvent(overlay, {
    type: "step-finished",
    stepIndex: 0,
    finishReason: "tool-calls",
    usage: { totalTokens: 40 },
  });
  const afterSecondStep = applyStreamEvent(afterFirstStep, {
    type: "step-finished",
    stepIndex: 1,
    finishReason: "stop",
    usage: { totalTokens: 41 },
  });

  expect(afterSecondStep.stepCount).toBe(2);
  expect(afterSecondStep.totalTokens).toBe(81);
});
