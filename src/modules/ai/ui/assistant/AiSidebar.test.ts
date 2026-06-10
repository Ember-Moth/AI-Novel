import { expect, test } from "bun:test";

import {
  buildSessionRows,
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
