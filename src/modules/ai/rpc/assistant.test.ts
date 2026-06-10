import { afterEach, expect, test } from "bun:test";

import type { ProjectAssistantService } from "@/modules/ai/server/project-assistant";
import { rpcTags } from "@/rpc/tags";

const handlers = await import("./index");
const { getProjectAssistantService, setProjectAssistantServiceForTests } =
  await import("@/modules/ai/server/project-assistant");

const requestCtx = { req: new Request("http://localhost/api/rpc") } as unknown as Parameters<
  typeof handlers.getProjectAssistantState.handler
>[1];

const originalService = getProjectAssistantService();

afterEach(() => {
  setProjectAssistantServiceForTests(originalService);
});

function useService(service: ProjectAssistantService) {
  setProjectAssistantServiceForTests(service);
}

test("getProjectAssistantState watches overview, threads, and the active thread view", async () => {
  useService({
    getProjectAssistantState: () => ({
      activeThreadId: "thread_state",
      threads: [],
      state: {
        thread: {
          id: "thread_state",
          projectId: "rpc_assistant_state",
          agentProfile: "project-assistant",
          title: "主会话",
          activeTipNodeId: null,
          archivedAt: null,
          createdAt: 1,
          updatedAt: 1,
        },
        activePath: [],
        candidateGroups: [],
        latestRuns: [],
      },
    }),
    createProjectAssistantThread: () => {
      throw new Error("unused");
    },
    setProjectAssistantActiveThread: () => {
      throw new Error("unused");
    },
    renameProjectAssistantThread: () => {
      throw new Error("unused");
    },
    archiveProjectAssistantThread: () => {
      throw new Error("unused");
    },
    getThreadView: () => {
      throw new Error("unused");
    },
    getRunTrace: () => {
      throw new Error("unused");
    },
    getNodeCandidates: () => {
      throw new Error("unused");
    },
    getChildRuns: () => {
      throw new Error("unused");
    },
    selectThreadTip: () => {
      throw new Error("unused");
    },
    sendProjectAssistantMessage: async () => {
      throw new Error("unused");
    },
    retryProjectAssistantMessage: async () => {
      throw new Error("unused");
    },
    editProjectAssistantMessage: async () => {
      throw new Error("unused");
    },
  } as unknown as ProjectAssistantService);

  const result = await handlers.getProjectAssistantState.handler(
    { projectId: "rpc_assistant_state" },
    requestCtx,
  );

  expect(result.watch).toEqual([
    rpcTags.aiProjectAssistantOverview("rpc_assistant_state"),
    rpcTags.aiProjectThreads("rpc_assistant_state"),
    rpcTags.aiThreadView("thread_state"),
  ]);
});

test("sendProjectAssistantMessage invalidates overview, thread view, candidates, and run trace", async () => {
  useService({
    getProjectAssistantState: () => ({
      activeThreadId: null,
      threads: [],
      state: {
        thread: null,
        activePath: [],
        candidateGroups: [],
        latestRuns: [],
      },
    }),
    createProjectAssistantThread: () => {
      throw new Error("unused");
    },
    setProjectAssistantActiveThread: () => {
      throw new Error("unused");
    },
    renameProjectAssistantThread: () => {
      throw new Error("unused");
    },
    archiveProjectAssistantThread: () => {
      throw new Error("unused");
    },
    getThreadView: () => {
      throw new Error("unused");
    },
    getRunTrace: () => {
      throw new Error("unused");
    },
    getNodeCandidates: () => {
      throw new Error("unused");
    },
    getChildRuns: () => {
      throw new Error("unused");
    },
    selectThreadTip: () => {
      throw new Error("unused");
    },
    sendProjectAssistantMessage: async () => ({
      thread: {
        id: "thread_send",
        projectId: "rpc_assistant_send",
        agentProfile: "project-assistant",
        title: "主会话",
        activeTipNodeId: "node_assistant",
        archivedAt: null,
        createdAt: 1,
        updatedAt: 2,
      },
      userNode: {
        id: "node_user",
        threadId: "thread_send",
        parentNodeId: null,
        role: "user",
        createdByRunId: null,
        sourceStepId: null,
        sourceKind: "user_input",
        summaryText: "Hello",
        message: { role: "user", content: [{ type: "text", text: "Hello" }] },
        parts: [],
        createdAt: 1,
      },
      assistantNode: null,
      run: {
        id: "run_send",
        threadId: "thread_send",
        parentRunId: null,
        parentEventId: null,
        triggerNodeId: "node_user",
        baseTipNodeId: "node_user",
        runMode: "send",
        status: "succeeded",
        agentProfile: "project-assistant",
        selectionSnapshot: {},
        contextSnapshot: null,
        errorArtifactId: null,
        startedAt: 1,
        completedAt: 2,
        createdAt: 1,
        updatedAt: 2,
      },
      state: {
        thread: null,
        activePath: [],
        candidateGroups: [],
        latestRuns: [],
      },
    }),
    retryProjectAssistantMessage: async () => {
      throw new Error("unused");
    },
    editProjectAssistantMessage: async () => {
      throw new Error("unused");
    },
  } as unknown as ProjectAssistantService);

  const result = await handlers.sendProjectAssistantMessage.handler(
    {
      projectId: "rpc_assistant_send",
      threadId: "thread_send",
      text: "Hello",
    },
    requestCtx,
  );

  expect(result.invalidate).toEqual([
    rpcTags.aiProjectAssistantOverview("rpc_assistant_send"),
    rpcTags.aiProjectThreads("rpc_assistant_send"),
    rpcTags.aiThreadView("thread_send"),
    rpcTags.aiNodeCandidates("node_user"),
    rpcTags.aiRunTrace("run_send"),
    rpcTags.aiChildRuns("run_send"),
  ]);
});
