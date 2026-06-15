import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";

import type {
  AgentThreadView,
  ProjectAssistantContextSnapshot,
  ProjectAssistantStreamEvent,
  TimelineSelectionUpdatedEvent,
  WorkspaceRefreshRequestedEvent,
} from "@/modules/ai/domain/types";
import { rpc } from "@/rpc/client";

import type { AssistantComposerSubmitPayload } from "../composer/AssistantComposer";
import type { AssistantAskUserAnswer } from "../messages/askUserModel";
import { selectPendingRun } from "../messages/runSummaryModel";
import { resolveExpectedActiveThreadAfterArchiveToggle } from "../sessions/sessionListModel";
import {
  buildProjectAssistantRetryActiveTools,
  buildProjectAssistantSendActiveTools,
} from "./activeTools";
import { patchAssistantOverviewState } from "./assistantQueryCache";
import { useAssistantStoreApi, useAssistantState } from "./assistantStore";
import { EMPTY_ASSISTANT_STATE, EMPTY_THREADS } from "./controllerState";
import {
  getForwardedAssistantRefreshEvent,
  isAssistantStreamAbortError,
  isToolInputResumeEvent,
} from "./streamEvents";
import {
  applyAssistantStreamEvent,
  createStreamOverlay,
  failAssistantStreamOverlay,
  type AssistantStreamOverlay,
} from "./streamOverlay";
import { useAssistantModelSelection } from "./useAssistantModelSelection";

type AssistantStreamResult = {
  thread: AgentThreadView;
  state: typeof EMPTY_ASSISTANT_STATE;
};

type AssistantStreamMutation<Input> = {
  isStreaming: boolean;
  abort: () => void;
  startAsync: (
    input: Input,
    options: {
      onEvent: (_event: ProjectAssistantStreamEvent) => void;
    },
  ) => Promise<AssistantStreamResult>;
};

const AssistantRuntimeContext = createContext<AiAssistantRuntime | null>(null);

export function AiAssistantRuntimeProvider({
  projectId,
  context,
  onWorkspaceRefreshRequested,
  children,
}: {
  projectId: string;
  context?: ProjectAssistantContextSnapshot | null;
  onWorkspaceRefreshRequested?: (
    _event: WorkspaceRefreshRequestedEvent | TimelineSelectionUpdatedEvent,
  ) => void;
  children: ReactNode;
}) {
  const value = useAiAssistantRuntime(projectId, onWorkspaceRefreshRequested, context);

  return (
    <AssistantRuntimeContext.Provider value={value}>{children}</AssistantRuntimeContext.Provider>
  );
}

export function useAssistantRuntime() {
  const value = useContext(AssistantRuntimeContext);
  if (value == null) {
    throw new Error("useAssistantRuntime must be used within AiAssistantRuntimeProvider");
  }
  return value;
}

export function useAiAssistantRuntime(
  projectId: string,
  onWorkspaceRefreshRequested?: (
    _event: WorkspaceRefreshRequestedEvent | TimelineSelectionUpdatedEvent,
  ) => void,
  context?: ProjectAssistantContextSnapshot | null,
) {
  const selection = useAssistantModelSelection();
  const store = useAssistantStoreApi();
  const activeStream = useAssistantState((state) => state.activeStream);
  const expectedActiveThreadId = useAssistantState((state) => state.expectedActiveThreadId);

  const assistantOverviewQuery = rpc.useQuery("ai.getProjectAssistantState", { projectId });
  const connectionModelsQuery = rpc.useQuery("ai.listEnabledConnectionModels");
  const createThread = rpc.useMutation("ai.createProjectAssistantThread");
  const setActiveThread = rpc.useMutation("ai.setProjectAssistantActiveThread");
  const renameThread = rpc.useMutation("ai.renameProjectAssistantThread");
  const archiveThread = rpc.useMutation("ai.archiveProjectAssistantThread");
  const selectThreadTip = rpc.useMutation("ai.selectThreadTip");
  const cancelRun = rpc.useMutation("ai.cancelProjectAssistantRun");
  const sendMessageStream = rpc.useStreamMutation("ai.sendProjectAssistantMessageStream");
  const retryMessageStream = rpc.useStreamMutation("ai.retryProjectAssistantMessageStream");
  const continueRunStream = rpc.useStreamMutation("ai.continueProjectAssistantRunStream");
  const submitToolInputStream = rpc.useStreamMutation("ai.submitProjectAssistantToolInputStream");

  const overview = assistantOverviewQuery.data ?? {
    activeThreadId: null,
    threads: EMPTY_THREADS,
    state: EMPTY_ASSISTANT_STATE,
  };
  const activeThreadId = overview.activeThreadId;
  const threads = overview.threads;
  const assistantState = overview.state;
  const pendingRun = selectPendingRun(assistantState);
  const runSummaries = assistantState.runSummaries;

  useEffect(() => {
    if (expectedActiveThreadId === null) {
      return;
    }

    if (
      (expectedActiveThreadId === "" && activeThreadId === null) ||
      expectedActiveThreadId === activeThreadId
    ) {
      store.getState().setExpectedActiveThreadId(null);
    }
  }, [activeThreadId, expectedActiveThreadId, store]);

  useEffect(() => {
    store.getState().resetToolInputSubmissionState();
  }, [activeThreadId, store]);

  useEffect(() => {
    if (!pendingRun || activeStream != null) {
      return;
    }

    const timer = setInterval(() => {
      void assistantOverviewQuery.refetch();
    }, 1500);

    return () => {
      clearInterval(timer);
    };
  }, [activeStream, assistantOverviewQuery, pendingRun]);

  useEffect(() => {
    if (!activeStream || activeStream.status !== "failed" || !activeStream.runId) {
      return;
    }

    if (runSummaries.some((summary) => summary.runId === activeStream.runId)) {
      const state = store.getState();
      if (activeStream.kind === "send") {
        state.setPendingAction(null);
      }
      state.setActiveStream(null);
    }
  }, [activeStream, runSummaries, store]);

  const runAssistantStreamAction = useCallback(
    async <Input,>({
      overlay,
      mutation,
      input,
      fallbackErrorMessage,
      onEvent,
    }: {
      overlay: AssistantStreamOverlay;
      mutation: AssistantStreamMutation<Input>;
      input: Input;
      fallbackErrorMessage: string;
      onEvent?: (_event: ProjectAssistantStreamEvent) => void;
    }) => {
      store.getState().setActiveStream(overlay);

      try {
        const result = await mutation.startAsync(input, {
          onEvent: (event) => {
            const refreshEvent = getForwardedAssistantRefreshEvent(event);
            if (refreshEvent) {
              onWorkspaceRefreshRequested?.(refreshEvent);
            }
            onEvent?.(event);
            store
              .getState()
              .setActiveStream((current) => applyAssistantStreamEvent(current, event));
          },
        });
        patchAssistantOverviewState({
          projectId,
          thread: result.thread,
          state: result.state,
        });
        store.getState().setActiveStream(null);
        return { status: "success" as const };
      } catch (error) {
        if (isAssistantStreamAbortError(error)) {
          void assistantOverviewQuery.refetch();
          store.getState().setActiveStream(null);
          return { status: "aborted" as const };
        }

        const message = error instanceof Error ? error.message : fallbackErrorMessage;
        const state = store.getState();
        state.setComposerError(message);
        state.setActiveStream((current) => failAssistantStreamOverlay(current, message));
        void assistantOverviewQuery.refetch();
        return { status: "error" as const };
      }
    },
    [assistantOverviewQuery, onWorkspaceRefreshRequested, projectId, store],
  );

  const resolveSelectedModelSupportsToolUse = useCallback(() => {
    const selectedResolvedModel =
      connectionModelsQuery.data
        ?.find((group) => group.connection.id === selection.selectedConnectionId)
        ?.models.find((model) => model.id === selection.selectedModelId) ?? null;

    return selectedResolvedModel?.supportsToolUse ?? false;
  }, [connectionModelsQuery.data, selection.selectedConnectionId, selection.selectedModelId]);

  const sendAssistantMessage = useCallback(
    async (payload: AssistantComposerSubmitPayload) => {
      const state = store.getState();
      const text = payload.text.trim();
      const activeTools = resolveSelectedModelSupportsToolUse()
        ? buildProjectAssistantSendActiveTools({ allowWrites: state.allowWritesForNextSend })
        : null;

      state.setComposerError(null);
      state.setPendingAction({ kind: "send", text, mentions: payload.mentions });
      state.setDraft("");
      state.setDraftMentionCount(0);
      let clearPendingAction = true;

      try {
        let threadId = activeThreadId;
        if (!threadId) {
          const thread = await createThread.mutate({ projectId });
          threadId = thread.id;
          store.getState().setExpectedActiveThreadId(thread.id);
        }

        const result = await runAssistantStreamAction({
          overlay: createStreamOverlay({
            kind: "send",
            threadId,
            triggerNodeId: null,
          }),
          mutation: sendMessageStream,
          input: {
            projectId,
            threadId,
            text,
            mentions: payload.mentions,
            context,
            activeTools,
          },
          fallbackErrorMessage: "发送消息失败。",
        });

        if (result.status !== "success") {
          const current = store.getState();
          current.setDraft(text);
          current.setDraftMentionCount(0);
        }

        if (result.status === "error") {
          clearPendingAction = false;
        }
      } catch (error) {
        const current = store.getState();
        current.setDraft(text);
        current.setDraftMentionCount(0);
        current.setComposerError(error instanceof Error ? error.message : "发送消息失败。");
        void assistantOverviewQuery.refetch();
      } finally {
        const current = store.getState();
        current.resetAllowWritesForNextSend();
        if (clearPendingAction) {
          current.setPendingAction(null);
        }
      }
    },
    [
      activeThreadId,
      assistantOverviewQuery,
      context,
      createThread,
      projectId,
      resolveSelectedModelSupportsToolUse,
      runAssistantStreamAction,
      sendMessageStream,
      store,
    ],
  );

  const handleSubmit = useCallback(
    (payload: AssistantComposerSubmitPayload) => {
      const text = payload.text.trim();
      const current = store.getState();
      const hasPendingRun = selectPendingRun(
        assistantOverviewQuery.data?.state ?? EMPTY_ASSISTANT_STATE,
      );

      if (
        !selection.selectionHydrated ||
        selection.selectedConnectionId.length === 0 ||
        selection.selectedModelId.length === 0 ||
        hasPendingRun != null
      ) {
        return false;
      }

      if (text.length === 0 && payload.mentions.length === 0) {
        return false;
      }

      if (
        createThread.isPending ||
        setActiveThread.isPending ||
        renameThread.isPending ||
        archiveThread.isPending ||
        selectThreadTip.isPending ||
        sendMessageStream.isStreaming ||
        retryMessageStream.isStreaming ||
        continueRunStream.isStreaming ||
        submitToolInputStream.isStreaming ||
        current.expectedActiveThreadId !== null
      ) {
        return false;
      }

      void sendAssistantMessage({ ...payload, text });
      return true;
    },
    [
      archiveThread.isPending,
      assistantOverviewQuery.data?.state,
      continueRunStream.isStreaming,
      createThread.isPending,
      renameThread.isPending,
      retryMessageStream.isStreaming,
      selection.selectedConnectionId,
      selection.selectedModelId,
      selection.selectionHydrated,
      selectThreadTip.isPending,
      sendAssistantMessage,
      sendMessageStream.isStreaming,
      setActiveThread.isPending,
      store,
      submitToolInputStream.isStreaming,
    ],
  );

  const handleRetry = useCallback(
    async (triggerNodeId: string) => {
      if (!activeThreadId) {
        return;
      }

      const state = store.getState();
      state.setComposerError(null);
      state.setPendingAction({ kind: "retry", triggerNodeId });
      try {
        await runAssistantStreamAction({
          overlay: createStreamOverlay({
            kind: "retry",
            threadId: activeThreadId,
            triggerNodeId,
          }),
          mutation: retryMessageStream,
          input: {
            projectId,
            threadId: activeThreadId,
            triggerNodeId,
            activeTools: resolveSelectedModelSupportsToolUse()
              ? buildProjectAssistantRetryActiveTools()
              : null,
          },
          fallbackErrorMessage: "重试失败。",
        });
      } finally {
        store.getState().setPendingAction(null);
      }
    },
    [
      activeThreadId,
      projectId,
      resolveSelectedModelSupportsToolUse,
      retryMessageStream,
      runAssistantStreamAction,
      store,
    ],
  );

  const handleContinueRun = useCallback(
    async (runId: string) => {
      if (!activeThreadId) {
        return;
      }

      const state = store.getState();
      state.setComposerError(null);
      state.setPendingAction({ kind: "continue", runId });
      try {
        await runAssistantStreamAction({
          overlay: createStreamOverlay({
            kind: "continue",
            threadId: activeThreadId,
            triggerNodeId: null,
          }),
          mutation: continueRunStream,
          input: {
            projectId,
            threadId: activeThreadId,
            runId,
          },
          fallbackErrorMessage: "继续生成失败。",
        });
      } finally {
        store.getState().setPendingAction(null);
      }
    },
    [activeThreadId, continueRunStream, projectId, runAssistantStreamAction, store],
  );

  const handleSubmitToolInput = useCallback(
    async (toolCallId: string, answers: AssistantAskUserAnswer[]) => {
      if (!activeThreadId || !pendingRun || pendingRun.status !== "waiting_for_input") {
        return;
      }

      const state = store.getState();
      state.setComposerError(null);
      state.setSubmittingToolInputToolCallId(toolCallId);
      state.setSubmittedToolInputAnswers((current) => ({
        ...current,
        [toolCallId]: answers,
      }));
      state.setPendingAction({ kind: "tool-input", runId: pendingRun.id, toolCallId });

      const result = await runAssistantStreamAction({
        overlay: createStreamOverlay({
          kind: "tool-input",
          threadId: activeThreadId,
          triggerNodeId: pendingRun.triggerNodeId,
          runId: pendingRun.id,
        }),
        mutation: submitToolInputStream,
        input: {
          projectId,
          threadId: activeThreadId,
          runId: pendingRun.id,
          toolCallId,
          answers,
        },
        fallbackErrorMessage: "提交回答失败。",
        onEvent: (event) => {
          if (isToolInputResumeEvent(event)) {
            store.getState().setSubmittingToolInputToolCallId(null);
          }
        },
      });

      try {
        if (result.status !== "error") {
          return;
        }

        store.getState().setSubmittedToolInputAnswers((current) => {
          const next = { ...current };
          delete next[toolCallId];
          return next;
        });
      } finally {
        const current = store.getState();
        current.setSubmittingToolInputToolCallId(null);
        current.setPendingAction(null);
      }
    },
    [activeThreadId, pendingRun, projectId, runAssistantStreamAction, store, submitToolInputStream],
  );

  const handleCreateThread = useCallback(async () => {
    const state = store.getState();
    state.setComposerError(null);
    state.setEditingThread(null);

    try {
      const thread = await createThread.mutate({ projectId });
      store.getState().setExpectedActiveThreadId(thread.id);
    } catch (error) {
      store.getState().setComposerError(error instanceof Error ? error.message : "新建会话失败。");
    }
  }, [createThread, projectId, store]);

  const handleActivateThread = useCallback(
    async (threadId: string) => {
      const current = store.getState();
      const isThreadBusy =
        current.expectedActiveThreadId !== null ||
        createThread.isPending ||
        setActiveThread.isPending ||
        renameThread.isPending ||
        archiveThread.isPending ||
        selectThreadTip.isPending;

      if (threadId === activeThreadId || isThreadBusy) {
        return;
      }

      current.setComposerError(null);
      current.setEditingThread(null);
      current.setExpectedActiveThreadId(threadId);

      try {
        await setActiveThread.mutate({ projectId, threadId });
      } catch (error) {
        const state = store.getState();
        state.setExpectedActiveThreadId(null);
        state.setComposerError(error instanceof Error ? error.message : "切换会话失败。");
      }
    },
    [
      activeThreadId,
      archiveThread.isPending,
      createThread.isPending,
      projectId,
      renameThread.isPending,
      selectThreadTip.isPending,
      setActiveThread,
      store,
    ],
  );

  const handleRenameStart = useCallback(
    (thread: AgentThreadView) => {
      store.getState().setEditingThread({ threadId: thread.id, title: thread.title });
    },
    [store],
  );

  const handleRenameCancel = useCallback(() => {
    store.getState().setEditingThread(null);
  }, [store]);

  const handleEditingThreadTitleChange = useCallback(
    (threadId: string, value: string) => {
      store.getState().setEditingThread({ threadId, title: value });
    },
    [store],
  );

  const handleRenameSubmit = useCallback(async () => {
    const state = store.getState();
    if (!state.editingThread) {
      return;
    }

    const normalizedTitle = state.editingThread.title.trim();
    const currentThread =
      threads.find((thread) => thread.id === state.editingThread?.threadId) ?? null;
    if (currentThread && normalizedTitle === currentThread.title.trim()) {
      state.setEditingThread(null);
      return;
    }

    state.setComposerError(null);

    try {
      await renameThread.mutate({
        threadId: state.editingThread.threadId,
        title: normalizedTitle,
      });
      store.getState().setEditingThread(null);
    } catch (error) {
      store
        .getState()
        .setComposerError(error instanceof Error ? error.message : "重命名会话失败。");
    }
  }, [renameThread, store, threads]);

  const handleArchiveToggle = useCallback(
    async (thread: AgentThreadView, archived: boolean) => {
      const state = store.getState();
      state.setComposerError(null);
      state.setEditingThread((current) => (current?.threadId === thread.id ? null : current));

      const unarchivedThreads = threads.filter((entry) => entry.archivedAt == null);
      const nextExpectedActiveThreadId = resolveExpectedActiveThreadAfterArchiveToggle({
        activeThreadId,
        thread,
        archived,
        unarchivedThreads,
      });
      if (nextExpectedActiveThreadId !== null) {
        state.setExpectedActiveThreadId(nextExpectedActiveThreadId);
      }

      try {
        await archiveThread.mutate({ threadId: thread.id, archived });
      } catch (error) {
        const current = store.getState();
        current.setExpectedActiveThreadId(null);
        current.setComposerError(error instanceof Error ? error.message : "更新会话状态失败。");
      }
    },
    [activeThreadId, archiveThread, store, threads],
  );

  const handleAbort = useCallback(async () => {
    const activeRunId = store.getState().activeStream?.runId ?? pendingRun?.id ?? null;
    if (!activeThreadId || !activeRunId) {
      if (sendMessageStream.isStreaming) {
        sendMessageStream.abort();
      } else if (retryMessageStream.isStreaming) {
        retryMessageStream.abort();
      } else if (continueRunStream.isStreaming) {
        continueRunStream.abort();
      } else if (submitToolInputStream.isStreaming) {
        submitToolInputStream.abort();
      }
      return;
    }

    try {
      await cancelRun.mutate({
        projectId,
        threadId: activeThreadId,
        runId: activeRunId,
      });
    } finally {
      if (sendMessageStream.isStreaming) {
        sendMessageStream.abort();
      } else if (retryMessageStream.isStreaming) {
        retryMessageStream.abort();
      } else if (continueRunStream.isStreaming) {
        continueRunStream.abort();
      } else if (submitToolInputStream.isStreaming) {
        submitToolInputStream.abort();
      }
      void assistantOverviewQuery.refetch();
    }
  }, [
    activeThreadId,
    assistantOverviewQuery,
    cancelRun,
    continueRunStream,
    pendingRun?.id,
    projectId,
    retryMessageStream,
    sendMessageStream,
    store,
    submitToolInputStream,
  ]);

  const handleSelectCandidate = useCallback(
    async (tipNodeId: string) => {
      const threadId = assistantState.thread?.id;
      const current = store.getState();
      const isThreadBusy =
        current.expectedActiveThreadId !== null ||
        createThread.isPending ||
        setActiveThread.isPending ||
        renameThread.isPending ||
        archiveThread.isPending ||
        selectThreadTip.isPending;

      if (!threadId || isThreadBusy) {
        return;
      }

      current.setComposerError(null);
      try {
        await selectThreadTip.mutate({ threadId, tipNodeId });
      } catch (error) {
        store
          .getState()
          .setComposerError(error instanceof Error ? error.message : "切换候选失败。");
      }
    },
    [
      archiveThread.isPending,
      assistantState.thread?.id,
      createThread.isPending,
      renameThread.isPending,
      selectThreadTip,
      setActiveThread.isPending,
      store,
    ],
  );

  return useMemo(
    () => ({
      assistantOverviewQuery,
      connectionModelsQuery,
      createThread,
      setActiveThread,
      renameThread,
      archiveThread,
      selectThreadTip,
      cancelRun,
      sendMessageStream,
      retryMessageStream,
      continueRunStream,
      submitToolInputStream,
      actions: {
        handleSubmit,
        handleRetry,
        handleContinueRun,
        handleSubmitToolInput,
        handleCreateThread,
        handleActivateThread,
        handleRenameStart,
        handleRenameCancel,
        handleEditingThreadTitleChange,
        handleRenameSubmit,
        handleArchiveToggle,
        handleAbort,
        handleSelectCandidate,
      },
    }),
    [
      archiveThread,
      assistantOverviewQuery,
      cancelRun,
      connectionModelsQuery,
      continueRunStream,
      createThread,
      handleAbort,
      handleActivateThread,
      handleArchiveToggle,
      handleContinueRun,
      handleCreateThread,
      handleEditingThreadTitleChange,
      handleRenameCancel,
      handleRenameStart,
      handleRenameSubmit,
      handleRetry,
      handleSelectCandidate,
      handleSubmit,
      handleSubmitToolInput,
      renameThread,
      retryMessageStream,
      selectThreadTip,
      sendMessageStream,
      setActiveThread,
      submitToolInputStream,
    ],
  );
}

export type AiAssistantRuntime = ReturnType<typeof useAiAssistantRuntime>;
