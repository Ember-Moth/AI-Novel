import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { AgentThreadView, ProjectAssistantContextSnapshot } from "@/modules/ai/domain/types";
import { rpc } from "@/rpc/client";

import {
  canSendAssistantMessage,
  EMPTY_ASSISTANT_STATE,
  EMPTY_THREADS,
  type EditingThreadState,
  getCandidateGroupForNode,
  selectPendingRun,
  selectRetryableRun,
  type PendingAssistantAction,
} from "./assistantState";

export type SessionListRow =
  | {
      key: string;
      type: "thread";
      thread: AgentThreadView;
      className?: string;
    }
  | {
      key: "archived-toggle";
      type: "archived-toggle";
      count: number;
    };

export function buildSessionRows({
  unarchivedThreads,
  archivedThreads,
  showArchivedThreads,
}: {
  unarchivedThreads: AgentThreadView[];
  archivedThreads: AgentThreadView[];
  showArchivedThreads: boolean;
}): SessionListRow[] {
  const rows: SessionListRow[] = [];

  rows.push(
    ...unarchivedThreads.map((thread) => ({
      key: thread.id,
      type: "thread" as const,
      thread,
    })),
  );

  if (archivedThreads.length === 0) {
    return rows;
  }

  rows.push({
    key: "archived-toggle",
    type: "archived-toggle",
    count: archivedThreads.length,
  });

  if (!showArchivedThreads) {
    return rows;
  }

  archivedThreads.forEach((thread, index) => {
    const classNames = [
      index === 0 ? "mt-1" : "",
      index === archivedThreads.length - 1 ? "pb-1" : "",
    ]
      .filter(Boolean)
      .join(" ");

    rows.push({
      key: thread.id,
      type: "thread",
      thread,
      className: classNames || undefined,
    });
  });

  return rows;
}

export function resolveExpectedActiveThreadAfterArchiveToggle({
  activeThreadId,
  thread,
  archived,
  unarchivedThreads,
}: {
  activeThreadId: string | null;
  thread: AgentThreadView;
  archived: boolean;
  unarchivedThreads: AgentThreadView[];
}) {
  if (archived && thread.id === activeThreadId) {
    const fallbackThread = unarchivedThreads.find((current) => current.id !== thread.id) ?? null;
    return fallbackThread?.id ?? "";
  }

  if (!archived && activeThreadId == null) {
    return thread.id;
  }

  return null;
}

export function useAiAssistantController(
  projectId: string,
  contextSnapshot: ProjectAssistantContextSnapshot,
) {
  const [selectedConnectionId, setSelectedConnectionId] = useState("");
  const [selectedModelId, setSelectedModelId] = useState("");
  const [draft, setDraft] = useState("");
  const [selectionHydrated, setSelectionHydrated] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAssistantAction | null>(null);
  const [editingThread, setEditingThread] = useState<EditingThreadState | null>(null);
  const [showArchivedThreads, setShowArchivedThreads] = useState(false);
  const [expectedActiveThreadId, setExpectedActiveThreadId] = useState<string | null>(null);
  const [composerError, setComposerError] = useState<string | null>(null);

  const storedSelectionQuery = rpc.useQuery("config.getAiAssistantModelSelection");
  const assistantOverviewQuery = rpc.useQuery("ai.getProjectAssistantState", { projectId });
  const saveSelection = rpc.useMutation("config.setAiAssistantModelSelection", {
    onSuccess: (selection) => {
      rpc.setQueryData("config.getAiAssistantModelSelection", undefined, selection);
    },
  });

  const createThread = rpc.useMutation("ai.createProjectAssistantThread");
  const setActiveThread = rpc.useMutation("ai.setProjectAssistantActiveThread");
  const renameThread = rpc.useMutation("ai.renameProjectAssistantThread");
  const archiveThread = rpc.useMutation("ai.archiveProjectAssistantThread");
  const selectThreadTip = rpc.useMutation("ai.selectThreadTip");
  const sendMessage = rpc.useMutation("ai.sendProjectAssistantMessage");
  const retryMessage = rpc.useMutation("ai.retryProjectAssistantMessage");

  const isLoadingSelection = !selectionHydrated;
  const overview = assistantOverviewQuery.data ?? {
    activeThreadId: null,
    threads: EMPTY_THREADS,
    state: EMPTY_ASSISTANT_STATE,
  };
  const assistantState = overview.state;
  const activeThreadId = overview.activeThreadId;
  const threads = overview.threads;
  const unarchivedThreads = useMemo(
    () => threads.filter((thread) => thread.archivedAt == null),
    [threads],
  );
  const archivedThreads = useMemo(
    () => threads.filter((thread) => thread.archivedAt != null),
    [threads],
  );
  const sessionOverlayState =
    assistantOverviewQuery.isInitialLoading && threads.length === 0
      ? ("loading" as const)
      : unarchivedThreads.length === 0
        ? ("empty" as const)
        : null;
  const sessionRows = useMemo(
    () =>
      buildSessionRows({
        unarchivedThreads,
        archivedThreads,
        showArchivedThreads,
      }),
    [archivedThreads, showArchivedThreads, unarchivedThreads],
  );
  const retryableRun = selectRetryableRun(assistantState);
  const pendingRun = selectPendingRun(assistantState);
  const isGenerating = sendMessage.isPending || retryMessage.isPending;
  const isThreadMutating =
    createThread.isPending ||
    setActiveThread.isPending ||
    renameThread.isPending ||
    archiveThread.isPending ||
    selectThreadTip.isPending;
  const isThreadBusy = isThreadMutating || expectedActiveThreadId !== null;
  const isBusy = isGenerating || isThreadBusy;
  const canSubmit = canSendAssistantMessage({
    draft,
    threadId: activeThreadId,
    selectedConnectionId,
    selectedModelId,
    selectionHydrated,
    isBusy,
    hasPendingRun: pendingRun != null,
  });
  const messages = assistantState.activePath;
  const showEmptyState = messages.length === 0 && pendingAction?.kind !== "send";

  useEffect(() => {
    if (expectedActiveThreadId === null) {
      return;
    }

    if (
      (expectedActiveThreadId === "" && activeThreadId === null) ||
      expectedActiveThreadId === activeThreadId
    ) {
      setExpectedActiveThreadId(null);
    }
  }, [activeThreadId, expectedActiveThreadId]);

  useEffect(() => {
    if (selectionHydrated) {
      return;
    }

    const hasResolvedStoredSelection =
      storedSelectionQuery.data !== undefined || storedSelectionQuery.error !== null;
    if (!hasResolvedStoredSelection) {
      return;
    }

    setSelectedConnectionId(storedSelectionQuery.data?.connectionId ?? "");
    setSelectedModelId(storedSelectionQuery.data?.modelId ?? "");
    setSelectionHydrated(true);
  }, [selectionHydrated, storedSelectionQuery.data, storedSelectionQuery.error]);

  const handleSelectionChange = useCallback((connectionId: string, modelId: string) => {
    setSelectedConnectionId(connectionId);
    setSelectedModelId(modelId);
  }, []);

  const handleSelectionCommit = useCallback(
    (connectionId: string, modelId: string) => {
      handleSelectionChange(connectionId, modelId);
      void saveSelection.mutate(
        connectionId && modelId
          ? {
              connectionId,
              modelId,
            }
          : null,
      );
    },
    [handleSelectionChange, saveSelection],
  );

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!canSubmit || !activeThreadId) {
        return;
      }

      const text = draft.trim();
      setComposerError(null);
      setPendingAction({ kind: "send", text });
      setDraft("");

      try {
        await sendMessage.mutate({
          projectId,
          threadId: activeThreadId,
          text,
          context: contextSnapshot,
        });
      } catch (error) {
        setDraft(text);
        setComposerError(error instanceof Error ? error.message : "发送消息失败。");
      } finally {
        setPendingAction(null);
      }
    },
    [activeThreadId, canSubmit, contextSnapshot, draft, projectId, sendMessage],
  );

  const handleRetry = useCallback(
    async (triggerNodeId: string) => {
      if (!activeThreadId) {
        return;
      }

      setComposerError(null);
      setPendingAction({ kind: "retry", triggerNodeId });

      try {
        await retryMessage.mutate({
          projectId,
          threadId: activeThreadId,
          triggerNodeId,
          context: contextSnapshot,
        });
      } catch (error) {
        setComposerError(error instanceof Error ? error.message : "重试失败。");
      } finally {
        setPendingAction(null);
      }
    },
    [activeThreadId, contextSnapshot, projectId, retryMessage],
  );

  const handleCreateThread = useCallback(async () => {
    setComposerError(null);
    setEditingThread(null);

    try {
      const thread = await createThread.mutate({ projectId });
      setExpectedActiveThreadId(thread.id);
    } catch (error) {
      setComposerError(error instanceof Error ? error.message : "新建会话失败。");
    }
  }, [createThread, projectId]);

  const handleActivateThread = useCallback(
    async (threadId: string) => {
      if (threadId === activeThreadId || isThreadBusy) {
        return;
      }

      setComposerError(null);
      setEditingThread(null);
      setExpectedActiveThreadId(threadId);

      try {
        await setActiveThread.mutate({ projectId, threadId });
      } catch (error) {
        setExpectedActiveThreadId(null);
        setComposerError(error instanceof Error ? error.message : "切换会话失败。");
      }
    },
    [activeThreadId, isThreadBusy, projectId, setActiveThread],
  );

  const handleRenameStart = useCallback((thread: AgentThreadView) => {
    setEditingThread({ threadId: thread.id, title: thread.title });
  }, []);

  const handleRenameCancel = useCallback(() => {
    setEditingThread(null);
  }, []);

  const handleEditingThreadTitleChange = useCallback((threadId: string, value: string) => {
    setEditingThread({ threadId, title: value });
  }, []);

  const handleRenameSubmit = useCallback(async () => {
    if (!editingThread) {
      return;
    }

    const normalizedTitle = editingThread.title.trim();
    const currentThread = threads.find((thread) => thread.id === editingThread.threadId) ?? null;
    if (currentThread && normalizedTitle === currentThread.title.trim()) {
      setEditingThread(null);
      return;
    }

    setComposerError(null);

    try {
      await renameThread.mutate({
        threadId: editingThread.threadId,
        title: normalizedTitle,
      });
      setEditingThread(null);
    } catch (error) {
      setComposerError(error instanceof Error ? error.message : "重命名会话失败。");
    }
  }, [editingThread, renameThread, threads]);

  const handleArchiveToggle = useCallback(
    async (thread: AgentThreadView, archived: boolean) => {
      setComposerError(null);
      setEditingThread((current) => (current?.threadId === thread.id ? null : current));

      const nextExpectedActiveThreadId = resolveExpectedActiveThreadAfterArchiveToggle({
        activeThreadId,
        thread,
        archived,
        unarchivedThreads,
      });
      if (nextExpectedActiveThreadId !== null) {
        setExpectedActiveThreadId(nextExpectedActiveThreadId);
      }

      try {
        await archiveThread.mutate({ threadId: thread.id, archived });
      } catch (error) {
        setExpectedActiveThreadId(null);
        setComposerError(error instanceof Error ? error.message : "更新会话状态失败。");
      }
    },
    [activeThreadId, archiveThread, unarchivedThreads],
  );

  const handleSelectCandidate = useCallback(
    async (tipNodeId: string) => {
      const threadId = assistantState.thread?.id;
      if (!threadId || isThreadBusy) {
        return;
      }

      setComposerError(null);
      try {
        await selectThreadTip.mutate({
          threadId,
          tipNodeId,
        });
      } catch (error) {
        setComposerError(error instanceof Error ? error.message : "切换候选失败。");
      }
    },
    [assistantState.thread?.id, isThreadBusy, selectThreadTip],
  );

  return {
    activeThreadId,
    canSubmit,
    composerError,
    draft,
    editingThread,
    getCandidateGroupForNode: (node: (typeof messages)[number]) =>
      getCandidateGroupForNode(assistantState.candidateGroups, node),
    handleActivateThread,
    handleArchiveToggle,
    handleCreateThread,
    handleEditingThreadTitleChange,
    handleRenameCancel,
    handleRenameStart,
    handleRenameSubmit,
    handleRetry,
    handleSelectCandidate,
    handleSelectionChange,
    handleSelectionCommit,
    handleSubmit,
    isBusy,
    isGenerating,
    isLoadingSelection,
    isRetrying: retryMessage.isPending,
    isThreadBusy,
    isThreadMutating,
    messages,
    pendingAction,
    pendingRun,
    retryableRun,
    selectedConnectionId,
    selectedModelId,
    selectionHydrated,
    sessionOverlayState,
    sessionRows,
    setDraft,
    showArchivedThreads,
    setShowArchivedThreads,
    showEmptyState,
    assistantStateIsInitialLoading: assistantOverviewQuery.isInitialLoading,
    contextSnapshot,
    hasDraft: draft.trim().length > 0,
  };
}
