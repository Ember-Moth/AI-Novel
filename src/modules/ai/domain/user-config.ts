import { YAML } from "bun";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";

import { createJsonFileStore } from "@/shared/lib/json-file-store";
import { ensureConfigDir, getConfigFilePath } from "@/shared/lib/storage-paths";
import type {
  AiConnectionCatalogOverrideRow,
  AiConnectionCustomModelRow,
  AiConnectionRow,
  GlobalPromptRow,
} from "./types";

interface AiConnectionsConfigFile {
  connections: AiConnectionRow[];
  catalogOverrides: AiConnectionCatalogOverrideRow[];
  customModels: AiConnectionCustomModelRow[];
}

const aiConnectionsStore = createJsonFileStore<AiConnectionsConfigFile>(
  () => getConfigFilePath("ai-connections.json"),
  () => ({ connections: [], catalogOverrides: [], customModels: [] }),
);

function getPromptsConfigDir() {
  const dir = join(ensureConfigDir(), "prompts");
  mkdirSync(dir, { recursive: true });
  return dir;
}

function getPromptConfigFilePath(id: string, isEnabled = true) {
  const suffix = isEnabled ? ".md" : ".disabled.md";
  return join(getPromptsConfigDir(), `${encodeURIComponent(id)}${suffix}`);
}

type PromptFrontMatter = Pick<GlobalPromptRow, "name" | "description">;
type PromptFrontMatterValues = Record<string, unknown>;

function readPromptFile(filepath: string): GlobalPromptRow {
  try {
    const raw = readFileSync(filepath, "utf8");
    const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
    if (!match) {
      throw new Error("缺少 YAML Front Matter。");
    }

    const frontMatter = parsePromptFrontMatter(match[1] ?? "");
    const timestamps = getPromptFileTimestamps(filepath);
    return {
      id: inferPromptIdFromFilePath(filepath),
      ...frontMatter,
      content: stripTrailingNewline(match[2] ?? ""),
      isEnabled: inferPromptEnabledFromFilePath(filepath),
      ...timestamps,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`配置文件 ${filepath} 不是有效 Prompt Markdown：${message}`);
  }
}

function writePromptFile(prompt: GlobalPromptRow): GlobalPromptRow {
  const { content } = prompt;
  const frontMatter: PromptFrontMatter = {
    name: prompt.name,
    description: prompt.description,
  };
  const markdown = `---\n${stringifyPromptFrontMatter(frontMatter)}---\n${content.trim()}\n`;
  const targetPath = getPromptConfigFilePath(prompt.id, prompt.isEnabled);
  const alternatePath = getPromptConfigFilePath(prompt.id, !prompt.isEnabled);
  const writePath = existsSync(targetPath)
    ? targetPath
    : existsSync(alternatePath)
      ? alternatePath
      : targetPath;

  writeFileSync(writePath, markdown, "utf8");
  if (writePath !== targetPath) {
    if (existsSync(targetPath)) {
      unlinkSync(targetPath);
    }
    renameSync(writePath, targetPath);
  }
  return readPromptFile(targetPath);
}

function listPromptConfigFiles(dir: string) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => join(dir, entry.name))
    .sort();
}

function readPromptConfigDirectory() {
  const dir = getPromptsConfigDir();
  return listPromptConfigFiles(dir).map((filepath) => readPromptFile(filepath));
}

function parsePromptFrontMatter(raw: string): PromptFrontMatter {
  const parsed = YAML.parse(raw);
  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Front Matter 必须是 YAML 对象。");
  }
  const values = parsed as PromptFrontMatterValues;

  return {
    name: requireFrontMatterString(values, "name"),
    description: requireNullableFrontMatterString(values, "description"),
  };
}

function inferPromptIdFromFilePath(filepath: string) {
  const filename = basename(filepath);
  const encodedId = filename.endsWith(".disabled.md")
    ? filename.slice(0, -".disabled.md".length)
    : filename.slice(0, -".md".length);
  return decodeURIComponent(encodedId);
}

function inferPromptEnabledFromFilePath(filepath: string) {
  return !basename(filepath).endsWith(".disabled.md");
}

function getPromptFileTimestamps(filepath: string) {
  const stats = statSync(filepath);
  return {
    createdAt: Math.trunc(stats.birthtimeMs),
    updatedAt: Math.trunc(stats.mtimeMs),
  };
}

function stripTrailingNewline(value: string) {
  return value.replace(/\r?\n$/, "");
}

function stringifyPromptFrontMatter(frontMatter: PromptFrontMatter) {
  const values = {
    name: frontMatter.name,
    ...(frontMatter.description != null ? { description: frontMatter.description } : {}),
  };
  return `${YAML.stringify(values, null, 2).trimEnd()}\n`;
}

function requireFrontMatterString(values: PromptFrontMatterValues, key: string) {
  const value = values[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Front Matter 字段 ${key} 必须是非空字符串。`);
  }
  return value;
}

function requireNullableFrontMatterString(values: PromptFrontMatterValues, key: string) {
  const value = values[key];
  if (value === undefined) {
    return null;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(`Front Matter 字段 ${key} 必须是字符串或 null。`);
  }
  return value.trim().length > 0 ? value : null;
}

function normalizeAiConnectionsFile(file: AiConnectionsConfigFile): AiConnectionsConfigFile {
  return {
    connections: file.connections ?? [],
    catalogOverrides: file.catalogOverrides ?? [],
    customModels: file.customModels ?? [],
  };
}

export function listGlobalPromptsFromConfig() {
  return readPromptConfigDirectory().sort((a, b) => a.name.localeCompare(b.name));
}

export function getGlobalPromptFromConfig(id: string) {
  return readPromptConfigDirectory().find((prompt) => prompt.id === id) ?? null;
}

export function findGlobalPromptByNameFromConfig(name: string) {
  return readPromptConfigDirectory().find((prompt) => prompt.name === name) ?? null;
}

export function insertGlobalPromptToConfig(prompt: GlobalPromptRow) {
  readPromptConfigDirectory();
  return writePromptFile(prompt);
}

export function updateGlobalPromptInConfig(id: string, updates: Partial<GlobalPromptRow>) {
  const prompt = readPromptConfigDirectory().find((item) => item.id === id);
  if (!prompt) return null;

  const updated = { ...prompt, ...updates };
  return writePromptFile(updated);
}

export function deleteGlobalPromptFromConfig(id: string) {
  readPromptConfigDirectory();
  for (const filepath of [getPromptConfigFilePath(id, true), getPromptConfigFilePath(id, false)]) {
    if (existsSync(filepath)) {
      unlinkSync(filepath);
    }
  }
}

export function listAiConnectionsFromConfig() {
  return [...normalizeAiConnectionsFile(aiConnectionsStore.read()).connections].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export function getAiConnectionFromConfig(id: string) {
  return (
    normalizeAiConnectionsFile(aiConnectionsStore.read()).connections.find(
      (connection) => connection.id === id,
    ) ?? null
  );
}

export function insertAiConnectionToConfig(connection: AiConnectionRow) {
  aiConnectionsStore.update((file) => {
    const normalized = normalizeAiConnectionsFile(file);
    return {
      ...normalized,
      connections: [...normalized.connections, connection],
    };
  });
  return connection;
}

export function updateAiConnectionInConfig(id: string, updates: Partial<AiConnectionRow>) {
  let updated: AiConnectionRow | null = null;
  aiConnectionsStore.update((file) => {
    const normalized = normalizeAiConnectionsFile(file);
    return {
      ...normalized,
      connections: normalized.connections.map((connection) => {
        if (connection.id !== id) return connection;
        updated = { ...connection, ...updates };
        return updated;
      }),
    };
  });
  return updated;
}

export function deleteAiConnectionFromConfig(id: string) {
  aiConnectionsStore.update((file) => {
    const normalized = normalizeAiConnectionsFile(file);
    return {
      connections: normalized.connections.filter((connection) => connection.id !== id),
      catalogOverrides: normalized.catalogOverrides.filter(
        (override) => override.connectionId !== id,
      ),
      customModels: normalized.customModels.filter((model) => model.connectionId !== id),
    };
  });
}

export function listCatalogOverridesForConnectionFromConfig(connectionId: string) {
  return normalizeAiConnectionsFile(aiConnectionsStore.read()).catalogOverrides.filter(
    (override) => override.connectionId === connectionId,
  );
}

export function setCatalogModelOverrideInConfig(override: AiConnectionCatalogOverrideRow) {
  aiConnectionsStore.update((file) => {
    const normalized = normalizeAiConnectionsFile(file);
    const existing = normalized.catalogOverrides.find(
      (item) =>
        item.connectionId === override.connectionId &&
        item.catalogModelId === override.catalogModelId,
    );
    return {
      ...normalized,
      catalogOverrides: existing
        ? normalized.catalogOverrides.map((item) =>
            item.connectionId === override.connectionId &&
            item.catalogModelId === override.catalogModelId
              ? { ...item, isEnabled: override.isEnabled, updatedAt: override.updatedAt }
              : item,
          )
        : [...normalized.catalogOverrides, override],
    };
  });
}

export function deleteCatalogModelOverrideFromConfig(connectionId: string, catalogModelId: string) {
  aiConnectionsStore.update((file) => {
    const normalized = normalizeAiConnectionsFile(file);
    return {
      ...normalized,
      catalogOverrides: normalized.catalogOverrides.filter(
        (override) =>
          override.connectionId !== connectionId || override.catalogModelId !== catalogModelId,
      ),
    };
  });
}

export function listCustomModelsForConnectionFromConfig(connectionId: string) {
  return normalizeAiConnectionsFile(aiConnectionsStore.read()).customModels.filter(
    (model) => model.connectionId === connectionId,
  );
}

export function getCustomModelFromConfig(id: string) {
  return (
    normalizeAiConnectionsFile(aiConnectionsStore.read()).customModels.find(
      (model) => model.id === id,
    ) ?? null
  );
}

export function insertCustomModelToConfig(model: AiConnectionCustomModelRow) {
  aiConnectionsStore.update((file) => {
    const normalized = normalizeAiConnectionsFile(file);
    return {
      ...normalized,
      customModels: [...normalized.customModels, model],
    };
  });
  return model;
}

export function updateCustomModelInConfig(
  id: string,
  updates: Partial<AiConnectionCustomModelRow>,
) {
  let updated: AiConnectionCustomModelRow | null = null;
  aiConnectionsStore.update((file) => {
    const normalized = normalizeAiConnectionsFile(file);
    return {
      ...normalized,
      customModels: normalized.customModels.map((model) => {
        if (model.id !== id) return model;
        updated = { ...model, ...updates };
        return updated;
      }),
    };
  });
  return updated;
}

export function deleteCustomModelFromConfig(id: string) {
  aiConnectionsStore.update((file) => {
    const normalized = normalizeAiConnectionsFile(file);
    return {
      ...normalized,
      customModels: normalized.customModels.filter((model) => model.id !== id),
    };
  });
}
