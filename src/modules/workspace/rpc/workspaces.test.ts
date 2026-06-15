import { expect, test } from "bun:test";

import { setupTestDataDir } from "@/test/setup";
import { seedProjectRecord } from "@/test/project";

setupTestDataDir();

const service = await import("@/modules/workspace/domain");
const { rpcTags } = await import("@/rpc/tags");
const workspaceHandlers = await import("./workspaces");
const requestCtx = { req: new Request("http://localhost/api/rpc") } as unknown as Parameters<
  typeof workspaceHandlers.list.handler
>[1];

function seedProject(projectId: string) {
  seedProjectRecord(projectId);
  if (!service.getDefaultWorkspace(projectId)) {
    service.createDefaultWorkspace(projectId);
  }
  return service.getDefaultWorkspace(projectId)!;
}

test("workspace detail query watches the workspace tag and returns the workspace", async () => {
  const workspace = seedProject("rpc_workspace_detail");

  const result = await workspaceHandlers.get.handler({ workspaceId: workspace.id }, requestCtx);

  expect(result.watch).toEqual([rpcTags.workspace(workspace.id)]);
  expect(result.data).toMatchObject({
    id: workspace.id,
    projectId: "rpc_workspace_detail",
    name: "main",
    branchId: workspace.branchId,
  });
});
