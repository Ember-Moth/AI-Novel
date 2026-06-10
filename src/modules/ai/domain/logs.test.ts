import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeEach, expect, test } from "bun:test";

const tempDir = mkdtempSync(join(tmpdir(), "novel-evolver-agent-logs-"));
const dbPath = join(tempDir, "agent-logs.sqlite");
process.env.DATABASE_URL = dbPath;

const { db, schema } = await import("@/db");
const logs = await import("./logs");

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

test("createThread activates the new thread and appendUserNode extends the active path", () => {
  seedProject("project_agent_thread");
  const thread = logs.createThread({
    projectId: "project_agent_thread",
  });
  const node = logs.appendUserNode({
    threadId: thread.id,
    parentNodeId: null,
    message: {
      role: "user",
      content: [{ type: "text", text: "Hello world" }],
    },
  });

  const activeThread = logs.resolveActiveThread("project_agent_thread");
  const threadView = logs.getThreadView(thread.id);

  expect(activeThread?.id).toBe(thread.id);
  expect(threadView.activePath.map((current) => current.id)).toEqual([node.id]);
  expect(logs.buildThreadModelMessages(thread.id)).toEqual([
    {
      role: "user",
      content: [{ type: "text", text: "Hello world" }],
    },
  ]);
});

test("retry candidates remain siblings and selectActiveTip switches the displayed branch", () => {
  seedProject("project_candidates");
  const thread = logs.createThread({
    projectId: "project_candidates",
  });
  const userNode = logs.appendUserNode({
    threadId: thread.id,
    parentNodeId: null,
    message: {
      role: "user",
      content: [{ type: "text", text: "Need help" }],
    },
  });
  const runA = logs.createRun({
    threadId: thread.id,
    triggerNodeId: userNode.id,
    baseTipNodeId: userNode.id,
    runMode: "retry",
    agentProfile: "project-assistant",
  });
  const stepA = logs.createRunStep({
    runId: runA.id,
    stepIndex: 0,
    provider: "openai",
    modelId: "gpt-test",
  });
  const branchA = logs.materializeResponseMessages({
    threadId: thread.id,
    parentNodeId: userNode.id,
    runId: runA.id,
    stepId: stepA.id,
    messages: [
      {
        role: "assistant",
        content: [{ type: "text", text: "Candidate A" }],
      },
    ],
  });
  logs.selectActiveTip(thread.id, branchA.tipNodeId!);

  const runB = logs.createRun({
    threadId: thread.id,
    triggerNodeId: userNode.id,
    baseTipNodeId: userNode.id,
    runMode: "retry",
    agentProfile: "project-assistant",
  });
  const stepB = logs.createRunStep({
    runId: runB.id,
    stepIndex: 0,
    provider: "openai",
    modelId: "gpt-test",
  });
  const branchB = logs.materializeResponseMessages({
    threadId: thread.id,
    parentNodeId: userNode.id,
    runId: runB.id,
    stepId: stepB.id,
    messages: [
      {
        role: "assistant",
        content: [{ type: "text", text: "Candidate B" }],
      },
    ],
  });

  const candidates = logs.getNodeCandidates(userNode.id);
  expect(candidates).toHaveLength(2);
  expect(candidates.map((candidate) => candidate.tipNodeId)).toEqual([
    branchA.tipNodeId!,
    branchB.tipNodeId!,
  ]);

  logs.selectActiveTip(thread.id, branchB.tipNodeId!);
  expect(logs.getThreadView(thread.id).activePath.at(-1)?.summaryText).toBe("Candidate B");
});

test("run trace keeps steps, artifacts, and events", () => {
  seedProject("project_trace");
  const thread = logs.createThread({
    projectId: "project_trace",
  });
  const userNode = logs.appendUserNode({
    threadId: thread.id,
    parentNodeId: null,
    message: {
      role: "user",
      content: [{ type: "text", text: "Hello trace" }],
    },
  });
  const run = logs.createRun({
    threadId: thread.id,
    triggerNodeId: userNode.id,
    baseTipNodeId: userNode.id,
    runMode: "send",
    agentProfile: "project-assistant",
  });
  const requestArtifact = logs.createArtifact({
    runId: run.id,
    artifactKind: "request-body",
    visibility: "internal",
    content: { prompt: "Hello trace" },
  });
  const step = logs.createRunStep({
    runId: run.id,
    stepIndex: 0,
    provider: "openai",
    modelId: "gpt-test",
    requestBodyArtifactId: requestArtifact.id,
  });
  logs.appendRunEvent({
    runId: run.id,
    stepId: step.id,
    eventKind: "provider-requested",
    summaryText: "provider request",
    payloadArtifactId: requestArtifact.id,
  });

  const trace = logs.getRunTrace(run.id);
  expect(trace.run.id).toBe(run.id);
  expect(trace.steps).toHaveLength(1);
  expect(trace.events).toHaveLength(1);
  expect(trace.artifacts).toHaveLength(1);
});
