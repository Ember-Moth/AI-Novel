import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeEach, expect, test } from "bun:test";

const tempDir = mkdtempSync(join(tmpdir(), "novel-evolver-project-assistant-"));
const dbPath = join(tempDir, "assistant.sqlite");
process.env.DATABASE_URL = dbPath;

const { db, schema } = await import("@/db");
const logs = await import("@/modules/ai/domain/logs");
const { createProjectAssistantService } = await import("./project-assistant");

function seedProject(projectId: string) {
  db.insert(schema.projects)
    .values({
      id: projectId,
      name: `Project ${projectId}`,
      description: null,
    })
    .run();
}

function seedCustomConnection({
  connectionId,
  modelId,
  modelRowId,
  apiKey = "sk-test",
  supportsToolUse = false,
}: {
  connectionId: string;
  modelId: string;
  modelRowId: string;
  apiKey?: string | null;
  supportsToolUse?: boolean;
}) {
  db.insert(schema.aiConnections)
    .values({
      id: connectionId,
      kind: "custom",
      name: "Primary Connection",
      sdkPackage: "@ai-sdk/openai-compatible",
      baseUrl: "https://example.test/v1",
      apiKey,
      configJson: "{}",
      isEnabled: true,
    })
    .run();
  db.insert(schema.aiConnectionCustomModels)
    .values({
      id: modelRowId,
      connectionId,
      modelId,
      displayName: "Story Model",
      supportsReasoning: true,
      supportsToolUse,
      isEnabled: true,
    })
    .run();

  return {
    selection: {
      connectionId,
      modelId: `custom:${modelRowId}`,
    },
  };
}

beforeEach(() => {
  db.run("PRAGMA foreign_keys = OFF;");
  db.delete(schema.agentRunEvents).run();
  db.delete(schema.agentThreadNodeParts).run();
  db.delete(schema.agentThreadNodes).run();
  db.delete(schema.agentRunSteps).run();
  db.delete(schema.agentArtifacts).run();
  db.delete(schema.agentRuns).run();
  db.delete(schema.agentProjectState).run();
  db.delete(schema.agentThreads).run();
  db.delete(schema.aiConnectionCatalogOverrides).run();
  db.delete(schema.aiConnectionCustomModels).run();
  db.delete(schema.aiConnections).run();
  db.delete(schema.aiCatalogModels).run();
  db.delete(schema.aiCatalogProviders).run();
  db.delete(schema.aiRegistryState).run();
  db.delete(schema.auxNodeLayers).run();
  db.delete(schema.contentNodes).run();
  db.delete(schema.timelinePoints).run();
  db.delete(schema.auxNodes).run();
  db.delete(schema.workspaces).run();
  db.delete(schema.projects).run();
  db.run("PRAGMA foreign_keys = ON;");
});

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

test("sendProjectAssistantMessage materializes user and assistant nodes and records a run", async () => {
  seedProject("assistant_send");
  const seeded = seedCustomConnection({
    connectionId: "conn_send",
    modelId: "story-model",
    modelRowId: "cmodel_send",
  });
  const service = createProjectAssistantService({
    readStoredSelection: () => seeded.selection,
    generateAssistantText: async ({ messages }) => ({
      text: "Assistant reply",
      usage: { totalTokens: 42 },
      finishReason: "stop",
      preparedMessagesByStep: [messages],
      steps: [
        {
          stepNumber: 0,
          model: { provider: "openai", modelId: "story-model" },
          finishReason: "stop",
          rawFinishReason: "stop",
          usage: { totalTokens: 42 },
          request: { body: { prompt: "Hello world" } },
          response: {
            body: { id: "resp_1" },
            messages: [
              {
                role: "assistant",
                content: [{ type: "text", text: "Assistant reply" }],
              },
            ],
          },
          providerMetadata: { openai: { cachedPromptTokens: 0 } },
          toolCalls: [],
          toolResults: [],
        },
      ],
    }),
  });
  const thread = service.createProjectAssistantThread("assistant_send");

  const result = await service.sendProjectAssistantMessage({
    projectId: "assistant_send",
    threadId: thread.id,
    text: "Hello world",
  });

  expect(result.userNode.role).toBe("user");
  expect(result.assistantNode?.role).toBe("assistant");
  expect(result.state.activePath.map((node) => node.role)).toEqual(["user", "assistant"]);
  expect(result.run.status).toBe("succeeded");
  expect(service.getRunTrace(result.run.id).steps).toHaveLength(1);
});

test("retryProjectAssistantMessage creates sibling assistant candidates", async () => {
  seedProject("assistant_retry");
  const seeded = seedCustomConnection({
    connectionId: "conn_retry",
    modelId: "story-model",
    modelRowId: "cmodel_retry",
  });
  const service = createProjectAssistantService({
    readStoredSelection: () => seeded.selection,
    generateAssistantText: async ({ messages }) => ({
      text: "Retried reply",
      usage: { totalTokens: 9 },
      finishReason: "stop",
      preparedMessagesByStep: [messages],
      steps: [
        {
          stepNumber: 0,
          model: { provider: "openai", modelId: "story-model" },
          finishReason: "stop",
          rawFinishReason: "stop",
          usage: { totalTokens: 9 },
          request: { body: { prompt: "Need help" } },
          response: {
            body: { id: "resp_retry" },
            messages: [
              {
                role: "assistant",
                content: [{ type: "text", text: "Retried reply" }],
              },
            ],
          },
          providerMetadata: {},
          toolCalls: [],
          toolResults: [],
        },
      ],
    }),
  });
  const thread = service.createProjectAssistantThread("assistant_retry");
  const userNode = logs.appendUserNode({
    threadId: thread.id,
    parentNodeId: null,
    message: {
      role: "user",
      content: [{ type: "text", text: "Need help" }],
    },
  });

  const result = await service.retryProjectAssistantMessage({
    projectId: "assistant_retry",
    threadId: thread.id,
    triggerNodeId: userNode.id,
  });

  expect(result.assistantNode?.summaryText).toBe("Retried reply");
  expect(service.getNodeCandidates(userNode.id)).toHaveLength(1);
});
