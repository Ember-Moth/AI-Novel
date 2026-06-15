import { expect, test } from "bun:test";

import { EMPTY_ASSISTANT_STATE } from "./controllerState";
import { buildAssistantDerivedState, getAssistantOverview } from "./assistantStateModel";

const baseThread = {
  projectId: "project_1",
  agentProfile: "project-assistant",
  activeTipNodeId: null,
  createdAt: 1,
  updatedAt: 1,
} as const;

test("getAssistantOverview falls back to the empty assistant overview", () => {
  expect(getAssistantOverview(null)).toEqual({
    activeThreadId: null,
    threads: [],
    state: EMPTY_ASSISTANT_STATE,
  });
});

test("buildAssistantDerivedState computes send availability and model capability", () => {
  const derived = buildAssistantDerivedState({
    overview: {
      activeThreadId: "thread_1",
      threads: [
        {
          ...baseThread,
          id: "thread_1",
          title: "Current",
          archivedAt: null,
        },
      ],
      state: {
        ...EMPTY_ASSISTANT_STATE,
        activePath: [],
        latestRuns: [],
      },
    },
    showArchivedThreads: false,
    draft: "继续写这一段",
    draftMentionCount: 0,
    selectionHydrated: true,
    selectedConnectionId: "connection_1",
    selectedModelId: "model_1",
    expectedActiveThreadId: null,
    pendingActionKind: null,
    activeStreamKind: null,
    assistantStateIsInitialLoading: false,
    connectionModels: [
      {
        connection: {
          id: "connection_1",
          kind: "openai",
          name: "OpenAI",
          sdkPackage: "@ai-sdk/openai",
          catalogProviderId: null,
          baseUrl: null,
          apiKey: null,
          configJson: "{}",
          isEnabled: true,
          createdAt: 1,
          updatedAt: 1,
        },
        models: [
          {
            id: "model_1",
            connectionId: "connection_1",
            origin: "custom",
            sdkPackage: "@ai-sdk/openai",
            modelId: "gpt-test",
            displayName: "GPT Test",
            family: null,
            contextWindow: null,
            maxOutputTokens: null,
            supportsVision: false,
            supportsToolUse: true,
            supportsReasoning: false,
            supportsTemperature: true,
            inputPricePer1m: null,
            outputPricePer1m: null,
            isEnabled: true,
            catalogModelId: null,
            customModelId: "custom_model_1",
            isActive: true,
          },
        ],
      },
    ],
    isCreatingThread: false,
    isSettingActiveThread: false,
    isRenamingThread: false,
    isArchivingThread: false,
    isSelectingThreadTip: false,
    isSendingMessage: false,
    isRetryingMessage: false,
    isContinuingRun: false,
    isSubmittingToolInput: false,
  });

  expect(derived.canSubmit).toBe(true);
  expect(derived.selectedModelSupportsToolUse).toBe(true);
  expect(derived.showEmptyState).toBe(true);
  expect(derived.sessionRows).toHaveLength(1);
});

test("buildAssistantDerivedState reports busy state from streaming and thread mutations", () => {
  const derived = buildAssistantDerivedState({
    overview: {
      activeThreadId: null,
      threads: [],
      state: {
        ...EMPTY_ASSISTANT_STATE,
        latestRuns: [],
      },
    },
    showArchivedThreads: true,
    draft: "",
    draftMentionCount: 1,
    selectionHydrated: true,
    selectedConnectionId: "connection_1",
    selectedModelId: "model_1",
    expectedActiveThreadId: "thread_pending",
    pendingActionKind: "send",
    activeStreamKind: "send",
    assistantStateIsInitialLoading: true,
    connectionModels: [],
    isCreatingThread: false,
    isSettingActiveThread: false,
    isRenamingThread: false,
    isArchivingThread: false,
    isSelectingThreadTip: false,
    isSendingMessage: true,
    isRetryingMessage: false,
    isContinuingRun: false,
    isSubmittingToolInput: false,
  });

  expect(derived.isGenerating).toBe(true);
  expect(derived.isThreadBusy).toBe(true);
  expect(derived.isBusy).toBe(true);
  expect(derived.sessionOverlayState).toBe("loading");
  expect(derived.showEmptyState).toBe(false);
  expect(derived.canSubmit).toBe(false);
});
