import { expect, test } from "bun:test";

import type { AssistantAskUserAnswer } from "../messages/askUserModel";
import { createAssistantStore } from "./assistantStore";
import { DEFAULT_ALLOW_WRITES_FOR_NEXT_SEND } from "./controllerState";

test("assistant store field setters support updater functions", () => {
  const store = createAssistantStore();

  store.getState().setDraft("hello");
  store.getState().setDraft((current) => `${current} world`);
  store.getState().setShowArchivedThreads((current) => !current);
  store.getState().setDraftMentionCount((current) => current + 2);

  expect(store.getState().draft).toBe("hello world");
  expect(store.getState().showArchivedThreads).toBe(true);
  expect(store.getState().draftMentionCount).toBe(2);
});

test("assistant store resets tool input submission state", () => {
  const store = createAssistantStore();
  const answers: AssistantAskUserAnswer[] = [
    {
      questionId: "question_1",
      type: "free_text",
      text: "answer",
    },
  ];

  store.getState().setSubmittingToolInputToolCallId("tool_call_1");
  store.getState().setSubmittedToolInputAnswers({
    tool_call_1: answers,
  });
  store.getState().resetToolInputSubmissionState();

  expect(store.getState().submittingToolInputToolCallId).toBeNull();
  expect(store.getState().submittedToolInputAnswers).toEqual({});
});

test("assistant store resets allowWritesForNextSend to default", () => {
  const store = createAssistantStore();

  store.getState().setAllowWritesForNextSend(false);
  store.getState().resetAllowWritesForNextSend();

  expect(store.getState().allowWritesForNextSend).toBe(DEFAULT_ALLOW_WRITES_FOR_NEXT_SEND);
});
