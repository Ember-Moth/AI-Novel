import { createScope, molecule, useMolecule } from "bunshi/react";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

import type { AssistantAskUserAnswer } from "../messages/askUserModel";
import {
  DEFAULT_ALLOW_WRITES_FOR_NEXT_SEND,
  type EditingThreadState,
  type PendingAssistantAction,
} from "./controllerState";
import type { AssistantStreamOverlay } from "./streamOverlay";
import { resolveNext, type Updater } from "./storeUtils";

type AssistantStoreStateData = {
  draft: string;
  draftMentionCount: number;
  allowWritesForNextSend: boolean;
  pendingAction: PendingAssistantAction | null;
  activeStream: AssistantStreamOverlay | null;
  editingThread: EditingThreadState | null;
  showArchivedThreads: boolean;
  expectedActiveThreadId: string | null;
  composerError: string | null;
  submittingToolInputToolCallId: string | null;
  submittedToolInputAnswers: Record<string, AssistantAskUserAnswer[]>;
};

type AssistantStoreStateActions = {
  setDraft: (updater: Updater<string>) => void;
  setDraftMentionCount: (updater: Updater<number>) => void;
  setAllowWritesForNextSend: (updater: Updater<boolean>) => void;
  setPendingAction: (updater: Updater<PendingAssistantAction | null>) => void;
  setActiveStream: (updater: Updater<AssistantStreamOverlay | null>) => void;
  setEditingThread: (updater: Updater<EditingThreadState | null>) => void;
  setShowArchivedThreads: (updater: Updater<boolean>) => void;
  setExpectedActiveThreadId: (updater: Updater<string | null>) => void;
  setComposerError: (updater: Updater<string | null>) => void;
  setSubmittingToolInputToolCallId: (updater: Updater<string | null>) => void;
  setSubmittedToolInputAnswers: (
    updater: Updater<Record<string, AssistantAskUserAnswer[]>>,
  ) => void;
  resetToolInputSubmissionState: () => void;
  resetAllowWritesForNextSend: () => void;
};

export type AssistantStoreState = AssistantStoreStateData & AssistantStoreStateActions;
export type AssistantStore = ReturnType<typeof createAssistantStore>;

export const AssistantScope = createScope<string>("");

export function createAssistantStore() {
  return createStore<AssistantStoreState>()((set) => {
    const field =
      <K extends keyof AssistantStoreStateData>(key: K) =>
      (updater: Updater<AssistantStoreStateData[K]>) =>
        set(
          (state) =>
            ({ [key]: resolveNext(updater, state[key]) }) as Pick<AssistantStoreStateData, K>,
        );

    return {
      draft: "",
      draftMentionCount: 0,
      allowWritesForNextSend: DEFAULT_ALLOW_WRITES_FOR_NEXT_SEND,
      pendingAction: null,
      activeStream: null,
      editingThread: null,
      showArchivedThreads: false,
      expectedActiveThreadId: null,
      composerError: null,
      submittingToolInputToolCallId: null,
      submittedToolInputAnswers: {},
      setDraft: field("draft"),
      setDraftMentionCount: field("draftMentionCount"),
      setAllowWritesForNextSend: field("allowWritesForNextSend"),
      setPendingAction: field("pendingAction"),
      setActiveStream: field("activeStream"),
      setEditingThread: field("editingThread"),
      setShowArchivedThreads: field("showArchivedThreads"),
      setExpectedActiveThreadId: field("expectedActiveThreadId"),
      setComposerError: field("composerError"),
      setSubmittingToolInputToolCallId: field("submittingToolInputToolCallId"),
      setSubmittedToolInputAnswers: field("submittedToolInputAnswers"),
      resetToolInputSubmissionState: () =>
        set({
          submittingToolInputToolCallId: null,
          submittedToolInputAnswers: {},
        }),
      resetAllowWritesForNextSend: () =>
        set({
          allowWritesForNextSend: DEFAULT_ALLOW_WRITES_FOR_NEXT_SEND,
        }),
    };
  });
}

export const AssistantStoreMolecule = molecule((_, getScope) => {
  getScope(AssistantScope);
  return createAssistantStore();
});

export function useAssistantStoreApi(): AssistantStore {
  return useMolecule(AssistantStoreMolecule);
}

export function useAssistantState<T>(selector: (state: AssistantStoreState) => T): T {
  return useStore(useMolecule(AssistantStoreMolecule), selector);
}
