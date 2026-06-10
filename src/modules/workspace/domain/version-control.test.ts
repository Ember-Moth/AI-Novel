import { eq } from "drizzle-orm";
import { expect, test } from "bun:test";

import { setupMockDatabase } from "@/test/mock-db";

setupMockDatabase();

const { db, schema } = await import("@/db");
const service = await import("./index");

function seedProject(projectId: string) {
  db.insert(schema.projects)
    .values({ id: projectId, name: `Project ${projectId}`, description: null })
    .run();
  return service.createDefaultWorkspace(projectId);
}

test("default workspace creates a default branch and links project", () => {
  const workspace = seedProject("proj_default");
  expect(workspace.branchId).toBeTruthy();

  const project = db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, "proj_default"))
    .get();
  expect(project?.defaultBranchId).toBe(workspace.branchId);

  const branch = service.getBranch(workspace.branchId);
  expect(branch.name).toBe("main");
  expect(branch.headCommitId).toBeNull();
});

test("commit then checkout round-trips content, timeline and aux state", () => {
  const workspace = seedProject("proj_rt");
  const rootId = workspace.contentRootId!;

  const point = service.createTimelinePoint({
    workspaceId: workspace.id,
    key: "tp_intro",
    label: "Intro",
  });
  const chapter = service.createContentNode({
    workspaceId: workspace.id,
    parentId: rootId,
    kind: "chapter",
    title: "Chapter 1",
    body: "Once upon a time",
    anchorPointId: point.id,
  });
  service.createContentNode({
    workspaceId: workspace.id,
    parentId: chapter.id,
    kind: "scene",
    title: "Scene 1",
    body: "Opening",
  });
  const dir = service.mkdirAt({
    workspaceId: workspace.id,
    parentDirId: workspace.auxRootId!,
    name: "lore",
  });
  service.writeFileAt({
    workspaceId: workspace.id,
    parentDirId: dir.id,
    name: "world.md",
    content: "world building",
  });

  const before = service.exportContentSubtree(workspace.id);
  const auxBefore = service.exportAuxSnapshotTree(workspace.id);
  const timelineBefore = service.listTimelinePoints(workspace.id);

  const commit = service.createCommit({
    branchId: workspace.branchId,
    message: "first commit",
    author: "tester",
  });
  expect(commit.id).toMatch(/^commit_/);

  // Mutate the working copy after the commit.
  service.updateContentNode({
    workspaceId: workspace.id,
    nodeId: chapter.id,
    title: "Changed title",
    body: "different",
  });
  service.deleteAuxNodeAt({ workspaceId: workspace.id, nodeId: dir.id });

  // Checkout the commit and verify state is restored exactly.
  service.checkoutCommit({ workspaceId: workspace.id, commitId: commit.id });

  expect(service.exportContentSubtree(workspace.id)).toEqual(before);
  expect(service.exportAuxSnapshotTree(workspace.id)).toEqual(auxBefore);
  expect(service.listTimelinePoints(workspace.id)).toEqual(timelineBefore);
});

test("identical content across commits shares blobs and tree objects", () => {
  const workspace = seedProject("proj_dedup");
  service.createContentNode({
    workspaceId: workspace.id,
    parentId: workspace.contentRootId!,
    kind: "chapter",
    title: "Dup",
    body: "shared body text",
  });

  service.createCommit({ branchId: workspace.branchId, message: "c1" });
  const blobCountAfterFirst = db.select().from(schema.blobs).all().length;
  const treeCountAfterFirst = db.select().from(schema.treeObjects).all().length;

  // Commit again without changes: should not create new blobs or tree objects.
  service.createCommit({ branchId: workspace.branchId, message: "c2" });
  expect(db.select().from(schema.blobs).all().length).toBe(blobCountAfterFirst);
  expect(db.select().from(schema.treeObjects).all().length).toBe(treeCountAfterFirst);
});

test("branch off a commit shares the same head and forked metadata", () => {
  const workspace = seedProject("proj_branch");
  service.createContentNode({
    workspaceId: workspace.id,
    parentId: workspace.contentRootId!,
    kind: "chapter",
    title: "Base",
    body: "base",
  });
  const commit = service.createCommit({ branchId: workspace.branchId, message: "base" });

  const featureWorkspace = service.createBranchWorkspace({
    projectId: "proj_branch",
    name: "feature",
    fromCommitId: commit.id,
  });

  const branch = service.getBranch(featureWorkspace.branchId);
  expect(branch.forkedFromCommitId).toBe(commit.id);
  expect(branch.headCommitId).toBe(commit.id);

  // The new workspace is checked out from the commit and has the same content.
  const exported = service.exportContentSubtree(featureWorkspace.id);
  expect(exported.nodes[0]?.title).toBe("Base");
  expect(exported.nodes[0]?.body).toBe("base");
});

test("merge metadata records multiple parents without merging", () => {
  const workspace = seedProject("proj_merge");
  service.createContentNode({
    workspaceId: workspace.id,
    parentId: workspace.contentRootId!,
    kind: "chapter",
    title: "A",
  });
  const base = service.createCommit({ branchId: workspace.branchId, message: "base" });

  const otherWorkspace = service.createBranchWorkspace({
    projectId: "proj_merge",
    name: "side",
    fromCommitId: base.id,
  });
  const sideCommit = service.createCommit({
    branchId: otherWorkspace.branchId,
    message: "side change",
  });

  const mergeCommit = service.createCommit({
    branchId: workspace.branchId,
    message: "merge side",
    extraParents: [{ parentId: sideCommit.id }],
  });

  const detail = service.getCommit(mergeCommit.id, "proj_merge");
  expect(detail.parents.length).toBe(2);
  expect(detail.parents[0]?.parentId).toBe(base.id);
  expect(detail.parents[0]?.mergeRole).toBe("mainline");
  expect(detail.parents[1]?.parentId).toBe(sideCommit.id);
  expect(detail.parents[1]?.mergeRole).toBe("merged");
});

test("listCommits walks the mainline history newest first", () => {
  const workspace = seedProject("proj_history");
  service.createContentNode({
    workspaceId: workspace.id,
    parentId: workspace.contentRootId!,
    kind: "chapter",
    title: "One",
  });
  const c1 = service.createCommit({ branchId: workspace.branchId, message: "one" });
  service.createContentNode({
    workspaceId: workspace.id,
    parentId: workspace.contentRootId!,
    kind: "chapter",
    title: "Two",
  });
  const c2 = service.createCommit({ branchId: workspace.branchId, message: "two" });

  const history = service.listCommits(workspace.branchId);
  expect(history.map((commit) => commit.id)).toEqual([c2.id, c1.id]);
});
