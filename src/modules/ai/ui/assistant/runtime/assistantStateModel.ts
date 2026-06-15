import { useMemo } from "react";

import type { AgentThreadStateView, AgentThreadView } from "@/modules/ai/domain/types";

import {
  canSendAssistantMessage,
  getCandidateGroupForNode,
  selectPendingRun,
  selectRetryableRun,
} from "../messages/runSummaryModel";
import { buildSessionRows } from "../sessions/sessionListModel";
import { useAssistantState } from "./assistantStore";
import { EMPTY_ASSISTANT_STATE, EMPTY_THREADS } from "./controllerState";
import { useAssistantRuntime } from "./useAiAssistantRuntime";
import { useAssistantModelSelection } from "./useAssistantModelSelection";

type AssistantOverview = {
  activeThreadId: string | null;
  threads: AgentThreadView[];
  state: AgentThreadStateView;
};

type BuildAssistantDerivedStateArgs = {
  overview: AssistantOverview;
  showArchivedThreads: boolean;
  draft: string;
  draftMentionCount: number;
  selectionHydrated: boolean;
  selectedConnectionId: string;
  selectedModelId: string;
  expectedActiveThreadId: string | null;
  pendingActionKind: "send" | "retry" | "continue" | "tool-input" | null;
  activeStreamKind: "send" | "retry" | "continue" | "tool-input" | null;
  assistantStateIsInitialLoading: boolean;
  connectionModels:
    | NonNullable<ReturnType<typeof useAssistantRuntime>["connectionModelsQuery"]["data"]>
    | undefined;
  isCreatingThread: boolean;
  isSettingActiveThread: boolean;
  isRenamingThread: boolean;
  isArchivingThread: boolean;
  isSelectingThreadTip: boolean;
  isSendingMessage: boolean;
  isRetryingMessage: boolean;
  isContinuingRun: boolean;
  isSubmittingToolInput: boolean;
};

export function getAssistantOverview(
  overview: AssistantOverview | null | undefined,
): AssistantOverview {
  return (
    overview ?? {
      activeThreadId: null,
      threads: EMPTY_THREADS,
      state: EMPTY_ASSISTANT_STATE,
    }
  );
}

export function getSelectedResolvedModel(
  connectionModels: BuildAssistantDerivedStateArgs["connectionModels"],
  selectedConnectionId: string,
  selectedModelId: string,
) {
  return (
    connectionModels
      ?.find((group) => group.connection.id === selectedConnectionId)
      ?.models.find((model) => model.id === selectedModelId) ?? null
  );
}

export function buildAssistantDerivedState({
  overview,
  showArchivedThreads,
  draft,
  draftMentionCount,
  selectionHydrated,
  selectedConnectionId,
  selectedModelId,
  expectedActiveThreadId,
  pendingActionKind,
  activeStreamKind,
  assistantStateIsInitialLoading,
  connectionModels,
  isCreatingThread,
  isSettingActiveThread,
  isRenamingThread,
  isArchivingThread,
  isSelectingThreadTip,
  isSendingMessage,
  isRetryingMessage,
  isContinuingRun,
  isSubmittingToolInput,
}: BuildAssistantDerivedStateArgs) {
  const assistantState = overview.state;
  const activeThreadId = overview.activeThreadId;
  const threads = overview.threads;
  const unarchivedThreads = threads.filter((thread) => thread.archivedAt == null);
  const archivedThreads = threads.filter((thread) => thread.archivedAt != null);
  const sessionOverlayState =
    assistantStateIsInitialLoading && threads.length === 0
      ? ("loading" as const)
      : threads.length === 0
        ? ("empty" as const)
        : null;
  const sessionRows = buildSessionRows({
    unarchivedThreads,
    archivedThreads,
    showArchivedThreads,
  });
  const retryableRun = selectRetryableRun(assistantState);
  const pendingRun = selectPendingRun(assistantState);
  const selectedResolvedModel = getSelectedResolvedModel(
    connectionModels,
    selectedConnectionId,
    selectedModelId,
  );
  const selectedModelSupportsToolUse = selectedResolvedModel?.supportsToolUse ?? false;
  const isGenerating =
    isSendingMessage || isRetryingMessage || isContinuingRun || isSubmittingToolInput;
  const isWaitingForInput = pendingRun?.status === "waiting_for_input";
  const isThreadMutating =
    isCreatingThread ||
    isSettingActiveThread ||
    isRenamingThread ||
    isArchivingThread ||
    isSelectingThreadTip;
  const isThreadBusy = isThreadMutating || expectedActiveThreadId !== null;
  const isBusy = isGenerating || isThreadBusy;
  const canSubmit = canSendAssistantMessage({
    draft,
    mentionCount: draftMentionCount,
    selectedConnectionId,
    selectedModelId,
    selectionHydrated,
    isBusy,
    hasPendingRun: pendingRun != null,
  });
  const messages = assistantState.activePath;
  const showEmptyState =
    messages.length === 0 && pendingActionKind !== "send" && activeStreamKind !== "send";

  return {
    overview,
    activeThreadId,
    assistantState,
    threads,
    messages,
    runSummaries: assistantState.runSummaries,
    retryableRun,
    pendingRun,
    sessionRows,
    sessionOverlayState,
    selectedModelSupportsToolUse,
    isGenerating,
    isWaitingForInput,
    isThreadMutating,
    isThreadBusy,
    isBusy,
    canSubmit,
    showEmptyState,
    isRetrying: isRetryingMessage,
    isContinuing: isContinuingRun,
    assistantStateIsInitialLoading,
    hasDraft: draft.trim().length > 0,
  };
}

export function useAssistantDerivedState() {
  const runtime = useAssistantRuntime();
  const selection = useAssistantModelSelection();
  const draft = useAssistantState((state) => state.draft);
  const draftMentionCount = useAssistantState((state) => state.draftMentionCount);
  const allowWritesForNextSend = useAssistantState((state) => state.allowWritesForNextSend);
  const activeStream = useAssistantState((state) => state.activeStream);
  const pendingAction = useAssistantState((state) => state.pendingAction);
  const editingThread = useAssistantState((state) => state.editingThread);
  const showArchivedThreads = useAssistantState((state) => state.showArchivedThreads);
  const expectedActiveThreadId = useAssistantState((state) => state.expectedActiveThreadId);
  const composerError = useAssistantState((state) => state.composerError);
  const submittingToolInputToolCallId = useAssistantState(
    (state) => state.submittingToolInputToolCallId,
  );
  const submittedToolInputAnswers = useAssistantState((state) => state.submittedToolInputAnswers);

  const overview = getAssistantOverview(runtime.assistantOverviewQuery.data);

  const derived = useMemo(
    () =>
      buildAssistantDerivedState({
        overview,
        showArchivedThreads,
        draft,
        draftMentionCount,
        selectionHydrated: selection.selectionHydrated,
        selectedConnectionId: selection.selectedConnectionId,
        selectedModelId: selection.selectedModelId,
        expectedActiveThreadId,
        pendingActionKind: pendingAction?.kind ?? null,
        activeStreamKind: activeStream?.kind ?? null,
        assistantStateIsInitialLoading: runtime.assistantOverviewQuery.isInitialLoading,
        connectionModels: runtime.connectionModelsQuery.data,
        isCreatingThread: runtime.createThread.isPending,
        isSettingActiveThread: runtime.setActiveThread.isPending,
        isRenamingThread: runtime.renameThread.isPending,
        isArchivingThread: runtime.archiveThread.isPending,
        isSelectingThreadTip: runtime.selectThreadTip.isPending,
        isSendingMessage: runtime.sendMessageStream.isStreaming,
        isRetryingMessage: runtime.retryMessageStream.isStreaming,
        isContinuingRun: runtime.continueRunStream.isStreaming,
        isSubmittingToolInput: runtime.submitToolInputStream.isStreaming,
      }),
    [
      activeStream?.kind,
      draft,
      draftMentionCount,
      expectedActiveThreadId,
      overview,
      pendingAction?.kind,
      runtime.archiveThread.isPending,
      runtime.assistantOverviewQuery.isInitialLoading,
      runtime.connectionModelsQuery.data,
      runtime.continueRunStream.isStreaming,
      runtime.createThread.isPending,
      runtime.renameThread.isPending,
      runtime.retryMessageStream.isStreaming,
      runtime.selectThreadTip.isPending,
      runtime.sendMessageStream.isStreaming,
      runtime.setActiveThread.isPending,
      runtime.submitToolInputStream.isStreaming,
      selection.selectedConnectionId,
      selection.selectedModelId,
      selection.selectionHydrated,
      showArchivedThreads,
    ],
  );

  return {
    ...selection,
    ...derived,
    draft,
    allowWritesForNextSend,
    activeStream,
    pendingAction,
    editingThread,
    showArchivedThreads,
    composerError,
    submittingToolInputToolCallId,
    submittedToolInputAnswers,
    getCandidateGroupForNode: (node: (typeof derived.messages)[number]) =>
      getCandidateGroupForNode(derived.assistantState.candidateGroups, node),
  };
}
