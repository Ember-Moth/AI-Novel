import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeEach, expect, test } from "bun:test";

const tempDir = mkdtempSync(join(tmpdir(), "novel-evolver-ai-selection-"));
const dbPath = join(tempDir, "ai-selection-test.sqlite");
process.env.DATABASE_URL = dbPath;

const { db, schema } = await import("@/db");
const { setGlobalConfig } = await import("./global-config");
const { getAiAssistantModelSelection, setAiAssistantModelSelection } =
  await import("./ai-assistant-model-selection");

beforeEach(() => {
  db.delete(schema.globalConfigOptions).run();
});

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

test("reads back a stored ai assistant model selection", () => {
  const selection = setAiAssistantModelSelection({
    connectionId: " conn-1 ",
    modelId: " model-1 ",
  });

  expect(selection).toEqual({
    connectionId: "conn-1",
    modelId: "model-1",
  });
  expect(getAiAssistantModelSelection()).toEqual({
    connectionId: "conn-1",
    modelId: "model-1",
  });
});

test("returns null for missing or malformed selections", () => {
  expect(getAiAssistantModelSelection()).toBeNull();

  setGlobalConfig("ai.assistant.modelSelection", { connectionId: "conn-only" });
  expect(getAiAssistantModelSelection()).toBeNull();

  setGlobalConfig("ai.assistant.modelSelection", "broken");
  expect(getAiAssistantModelSelection()).toBeNull();
});

test("clearing or writing incomplete selections removes the stored value", () => {
  setAiAssistantModelSelection({
    connectionId: "conn-1",
    modelId: "model-1",
  });
  expect(getAiAssistantModelSelection()).not.toBeNull();

  expect(setAiAssistantModelSelection(null)).toBeNull();
  expect(getAiAssistantModelSelection()).toBeNull();

  setAiAssistantModelSelection({
    connectionId: "conn-2",
    modelId: "model-2",
  });
  expect(setAiAssistantModelSelection({ connectionId: "conn-2", modelId: " " })).toBeNull();
  expect(getAiAssistantModelSelection()).toBeNull();
});
