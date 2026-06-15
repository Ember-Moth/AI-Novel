import { createJsonFileStore } from "@/shared/lib/json-file-store";
import { getConfigFilePath } from "@/shared/lib/storage-paths";
import type {
  AiConnectionCatalogOverrideRow,
  AiConnectionCustomModelRow,
  AiConnectionRow,
} from "../types";

interface AiConnectionsConfigFile {
  connections: AiConnectionRow[];
  catalogOverrides: AiConnectionCatalogOverrideRow[];
  customModels: AiConnectionCustomModelRow[];
}

const aiConnectionsStore = createJsonFileStore<AiConnectionsConfigFile>(
  () => getConfigFilePath("ai-connections.json"),
  () => ({ connections: [], catalogOverrides: [], customModels: [] }),
);

function normalizeAiConnectionsFile(file: AiConnectionsConfigFile): AiConnectionsConfigFile {
  return {
    connections: file.connections ?? [],
    catalogOverrides: file.catalogOverrides ?? [],
    customModels: file.customModels ?? [],
  };
}

export function list() {
  return [...normalizeAiConnectionsFile(aiConnectionsStore.read()).connections].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export function get(id: string) {
  return (
    normalizeAiConnectionsFile(aiConnectionsStore.read()).connections.find(
      (connection) => connection.id === id,
    ) ?? null
  );
}

export function insert(connection: AiConnectionRow) {
  aiConnectionsStore.update((file) => {
    const normalized = normalizeAiConnectionsFile(file);
    return {
      ...normalized,
      connections: [...normalized.connections, connection],
    };
  });
  return connection;
}

export function update(id: string, updates: Partial<AiConnectionRow>) {
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

export function remove(id: string) {
  aiConnectionsStore.update((file) => {
    const normalized = normalizeAiConnectionsFile(file);
    return {
      ...normalized,
      connections: normalized.connections.filter((connection) => connection.id !== id),
      catalogOverrides: normalized.catalogOverrides.filter(
        (override) => override.connectionId !== id,
      ),
      customModels: normalized.customModels.filter((model) => model.connectionId !== id),
    };
  });
}

export function listCatalogOverridesForConnection(connectionId: string) {
  return normalizeAiConnectionsFile(aiConnectionsStore.read()).catalogOverrides.filter(
    (override) => override.connectionId === connectionId,
  );
}

export function setCatalogModelOverride(override: AiConnectionCatalogOverrideRow) {
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

export function deleteCatalogModelOverride(connectionId: string, catalogModelId: string) {
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

export function listCustomModelsForConnection(connectionId: string) {
  return normalizeAiConnectionsFile(aiConnectionsStore.read()).customModels.filter(
    (model) => model.connectionId === connectionId,
  );
}

export function getCustomModel(id: string) {
  return (
    normalizeAiConnectionsFile(aiConnectionsStore.read()).customModels.find(
      (model) => model.id === id,
    ) ?? null
  );
}

export function insertCustomModel(model: AiConnectionCustomModelRow) {
  aiConnectionsStore.update((file) => {
    const normalized = normalizeAiConnectionsFile(file);
    return {
      ...normalized,
      customModels: [...normalized.customModels, model],
    };
  });
  return model;
}

export function updateCustomModel(id: string, updates: Partial<AiConnectionCustomModelRow>) {
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

export function deleteCustomModel(id: string) {
  aiConnectionsStore.update((file) => {
    const normalized = normalizeAiConnectionsFile(file);
    return {
      ...normalized,
      customModels: normalized.customModels.filter((model) => model.id !== id),
    };
  });
}
