import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeEach, expect, test } from "bun:test";

const tempDir = mkdtempSync(join(tmpdir(), "novel-evolver-ai-rpc-"));
const dbPath = join(tempDir, "ai-rpc.sqlite");
process.env.DATABASE_URL = dbPath;

const { db, schema } = await import("@/db");
const logs = await import("@/modules/ai/domain/logs");
const handlers = await import("./index");
const { rpcTags } = await import("@/rpc/tags");

const requestCtx = { req: new Request("http://localhost/api/rpc") } as unknown as Parameters<
  typeof handlers.getThreadView.handler
>[1];

function seedProject(projectId: string) {
  db.insert(schema.projects)
    .values({
      id: projectId,
      name: `Project ${projectId}`,
      description: null,
    })
    .run();
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

test("listProjectThreads watches the project thread tag", async () => {
  seedProject("rpc_threads");
  logs.createThread({
    projectId: "rpc_threads",
  });

  const result = await handlers.listProjectThreads.handler(
    { projectId: "rpc_threads" },
    requestCtx,
  );
  expect(result.watch).toEqual([rpcTags.aiProjectThreads("rpc_threads")]);
  expect(result.data).toHaveLength(1);
});

test("getThreadView watches the thread tag", async () => {
  seedProject("rpc_thread_view");
  const thread = logs.createThread({
    projectId: "rpc_thread_view",
  });

  const result = await handlers.getThreadView.handler({ threadId: thread.id }, requestCtx);
  expect(result.watch).toEqual([rpcTags.aiThreadView(thread.id)]);
});

test("createProjectAssistantThread invalidates overview and thread view", async () => {
  seedProject("rpc_create_thread");

  const result = await handlers.createProjectAssistantThread.handler(
    { projectId: "rpc_create_thread" },
    requestCtx,
  );

  expect(result.invalidate).toEqual([
    rpcTags.aiProjectAssistantOverview("rpc_create_thread"),
    rpcTags.aiProjectThreads("rpc_create_thread"),
    rpcTags.aiThreadView(result.data.id),
  ]);
});
