import { expect, test } from "bun:test";
import { YAML } from "bun";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { ensureConfigDir } from "@/shared/lib/storage-paths";
import { setupTestDataDir } from "@/test/setup";

setupTestDataDir();

const userConfig = await import("./user-config");

function prompt(id: string, name = id) {
  return {
    id,
    name,
    description: null,
    content: `${name} content`,
    isEnabled: true,
    createdAt: 1,
    updatedAt: 1,
  };
}

function getPromptsConfigDir() {
  return join(ensureConfigDir(), "prompts");
}

function getPromptConfigFilePath(id: string) {
  return join(getPromptsConfigDir(), `${encodeURIComponent(id)}.md`);
}

function getDisabledPromptConfigFilePath(id: string) {
  return join(getPromptsConfigDir(), `${encodeURIComponent(id)}.disabled.md`);
}

test("user config files default to empty lists when missing", () => {
  expect(userConfig.globalPrompts.list()).toEqual([]);
  expect(userConfig.aiConnections.list()).toEqual([]);
});

test("prompt config persists create update and delete operations", () => {
  userConfig.globalPrompts.insert(prompt("prompt_a", "Alpha"));
  userConfig.globalPrompts.insert(prompt("prompt_b", "Beta"));

  expect(userConfig.globalPrompts.list().map((item) => item.name)).toEqual(["Alpha", "Beta"]);

  userConfig.globalPrompts.update("prompt_a", {
    content: "Updated",
    updatedAt: 2,
  });
  const updatedPrompt = userConfig.globalPrompts.get("prompt_a");
  expect(updatedPrompt?.content).toBe("Updated");

  userConfig.globalPrompts.remove("prompt_b");
  expect(userConfig.globalPrompts.list().map((item) => item.id)).toEqual(["prompt_a"]);

  const promptFiles = readdirSync(getPromptsConfigDir()).filter((name) => name.endsWith(".md"));
  expect(promptFiles).toEqual(["prompt_a.md"]);
  const rawPrompt = readFileSync(getPromptConfigFilePath("prompt_a"), "utf8");
  const frontMatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(rawPrompt)?.[1] ?? "";
  expect(YAML.parse(frontMatter)).toEqual({
    name: "Alpha",
  });
  const stats = statSync(getPromptConfigFilePath("prompt_a"));
  expect(updatedPrompt).toMatchObject({
    id: "prompt_a",
    createdAt: Math.trunc(stats.birthtimeMs),
    updatedAt: Math.trunc(stats.mtimeMs),
  });
  expect(rawPrompt).toContain("---\nUpdated\n");
  expect(existsSync(getPromptConfigFilePath("prompt_b"))).toBe(false);
});

test("prompt enabled state is stored in the filename suffix", () => {
  userConfig.globalPrompts.insert({ ...prompt("prompt_a", "Alpha"), isEnabled: false });

  expect(existsSync(getPromptConfigFilePath("prompt_a"))).toBe(false);
  expect(existsSync(getDisabledPromptConfigFilePath("prompt_a"))).toBe(true);
  expect(userConfig.globalPrompts.get("prompt_a")?.isEnabled).toBe(false);

  userConfig.globalPrompts.update("prompt_a", { isEnabled: true });
  expect(existsSync(getPromptConfigFilePath("prompt_a"))).toBe(true);
  expect(existsSync(getDisabledPromptConfigFilePath("prompt_a"))).toBe(false);
  expect(userConfig.globalPrompts.get("prompt_a")?.isEnabled).toBe(true);

  userConfig.globalPrompts.update("prompt_a", { isEnabled: false });
  expect(existsSync(getPromptConfigFilePath("prompt_a"))).toBe(false);
  expect(existsSync(getDisabledPromptConfigFilePath("prompt_a"))).toBe(true);

  const rawPrompt = readFileSync(getDisabledPromptConfigFilePath("prompt_a"), "utf8");
  const frontMatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(rawPrompt)?.[1] ?? "";
  expect(YAML.parse(frontMatter)).toEqual({
    name: "Alpha",
  });
});

test("ai connection config persists connections overrides and custom models", () => {
  userConfig.aiConnections.insert({
    id: "conn_a",
    kind: "custom",
    name: "Connection A",
    sdkPackage: "@ai-sdk/openai",
    catalogProviderId: null,
    baseUrl: null,
    apiKey: "sk-test",
    configJson: "{}",
    isEnabled: true,
    createdAt: 1,
    updatedAt: 1,
  });
  userConfig.aiConnections.insertCustomModel({
    id: "model_a",
    connectionId: "conn_a",
    modelId: "gpt-test",
    displayName: "GPT Test",
    contextWindow: null,
    maxOutputTokens: null,
    supportsVision: false,
    supportsToolUse: true,
    supportsReasoning: false,
    supportsTemperature: false,
    inputPricePer1m: null,
    outputPricePer1m: null,
    isEnabled: true,
    createdAt: 1,
    updatedAt: 1,
  });
  userConfig.aiConnections.setCatalogModelOverride({
    id: "override_a",
    connectionId: "conn_a",
    catalogModelId: "openai:gpt-test",
    isEnabled: false,
    createdAt: 1,
    updatedAt: 1,
  });

  expect(userConfig.aiConnections.get("conn_a")?.apiKey).toBe("sk-test");
  expect(userConfig.aiConnections.listCustomModelsForConnection("conn_a")).toHaveLength(1);
  expect(userConfig.aiConnections.listCatalogOverridesForConnection("conn_a")).toHaveLength(1);

  userConfig.aiConnections.remove("conn_a");
  expect(userConfig.aiConnections.get("conn_a")).toBeNull();
  expect(userConfig.aiConnections.listCustomModelsForConnection("conn_a")).toEqual([]);
  expect(userConfig.aiConnections.listCatalogOverridesForConnection("conn_a")).toEqual([]);
});

test("invalid prompt directory file throws and is not overwritten", () => {
  userConfig.globalPrompts.insert(prompt("prompt_a", "Alpha"));
  writeFileSync(getPromptConfigFilePath("prompt_a"), "{not-front-matter", "utf8");

  expect(() => userConfig.globalPrompts.list()).toThrow("不是有效 Prompt Markdown");
  expect(() =>
    userConfig.globalPrompts.update("prompt_a", {
      content: "Updated",
      updatedAt: 2,
    }),
  ).toThrow("不是有效 Prompt Markdown");
  expect(readFileSync(getPromptConfigFilePath("prompt_a"), "utf8")).toBe("{not-front-matter");
});

test("multiple file-backed writes keep all records", async () => {
  await Promise.all(
    Array.from({ length: 20 }, async (_, index) => {
      userConfig.globalPrompts.insert(prompt(`prompt_${index}`, `Prompt ${index}`));
    }),
  );

  expect(userConfig.globalPrompts.list()).toHaveLength(20);
});
