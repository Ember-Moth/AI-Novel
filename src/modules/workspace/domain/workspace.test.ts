import { expect, test } from "bun:test";

import { setupMockDatabase } from "@/test/mock-db";

setupMockDatabase();

const { db, schema } = await import("@/db");
const service = await import("./index");
const { readWorktreeState } = await import("./git-storage/worktree-state");

type ExportedAuxNode = ReturnType<typeof service.exportAuxSnapshotTree>["nodes"][number];

function seedProject(projectId: string) {
  db.insert(schema.projects)
    .values({
      id: projectId,
      name: `Project ${projectId}`,
      description: null,
    })
    .run();
  return service.createDefaultWorkspace(projectId);
}

function flattenAuxNodes(nodes: ExportedAuxNode[]): ExportedAuxNode[] {
  return nodes.flatMap((node) => [node, ...flattenAuxNodes(node.children)]);
}

function auxLayers(workspace: { worktreePath: string }) {
  return readWorktreeState(workspace.worktreePath).auxLayers;
}

test("content export preserves sibling order and nesting", () => {
  const workspace = seedProject("project_content");
  const rootId = workspace.contentRootId!;

  const chapter1 = service.createContentNode({
    workspaceId: workspace.id,
    parentId: rootId,
    title: "Chapter 1",
  });
  const chapter2 = service.createContentNode({
    workspaceId: workspace.id,
    parentId: rootId,
    afterSiblingId: chapter1.id,
    title: "Chapter 2",
  });
  service.createContentNode({
    workspaceId: workspace.id,
    parentId: rootId,
    title: "Prologue",
  });
  service.createContentNode({
    workspaceId: workspace.id,
    parentId: chapter1.id,
    title: "Scene 1",
    body: "Opening scene",
  });

  const exported = service.exportContentSubtree(workspace.id);
  expect(exported.nodes.map((node) => node.title)).toEqual(["Prologue", "Chapter 1", "Chapter 2"]);
  expect(exported.nodes[1]?.children.map((node) => node.title)).toEqual(["Scene 1"]);
  expect(chapter2.parentId).toBe(rootId);
});

test("aux overlay resolves by timeline point and composeWritingContext follows anchor point", () => {
  const workspace = seedProject("project_overlay");
  const rootId = workspace.auxRootId!;
  const contentRootId = workspace.contentRootId!;

  const stateDir = service.mkdirAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: rootId,
    name: "state",
  });
  const locationFile = service.writeFileAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: stateDir.id,
    name: "location.md",
    content: "home",
  });
  const point = service.createTimelinePoint({
    workspaceId: workspace.id,
    afterPointId: service.ORIGIN_TIMELINE_POINT_ID,
    label: "After leave home",
  });
  service.writeFileAt({
    workspaceId: workspace.id,
    timelinePointId: point.id,
    nodeId: locationFile.id,
    content: "park",
  });
  const scene = service.createContentNode({
    workspaceId: workspace.id,
    parentId: contentRootId,
    anchorPointId: point.id,
    title: "Arrival",
  });

  expect(
    service.readAuxByPathAt(workspace.id, service.ORIGIN_TIMELINE_POINT_ID, "/state/location.md")
      ?.content,
  ).toBe("home");
  expect(service.readAuxByPathAt(workspace.id, point.id, "/state/location.md")?.content).toBe(
    "park",
  );

  const context = service.composeWritingContext(workspace.id, scene.id);
  expect(context.timelinePointId).toBe(point.id);
  expect(context.auxSnapshot.find((node) => node.path === "/state/location.md")?.content).toBe(
    "park",
  );
});

test("symlink keeps following the same aux node after rename and move", () => {
  const workspace = seedProject("project_symlink");
  const rootId = workspace.auxRootId!;

  const places = service.mkdirAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: rootId,
    name: "places",
  });
  const home = service.mkdirAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: places.id,
    name: "home",
  });
  const bathroom = service.mkdirAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: home.id,
    name: "bathroom",
  });
  service.linkAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: rootId,
    name: "current_location",
    targetNodeId: bathroom.id,
  });

  const point = service.createTimelinePoint({
    workspaceId: workspace.id,
    afterPointId: service.ORIGIN_TIMELINE_POINT_ID,
    label: "After move",
  });
  const villa = service.mkdirAt({
    workspaceId: workspace.id,
    timelinePointId: point.id,
    parentDirId: places.id,
    name: "villa",
  });
  service.moveAuxNodeAt({
    workspaceId: workspace.id,
    timelinePointId: point.id,
    nodeId: bathroom.id,
    newParentDirId: villa.id,
    newName: "main_bathroom",
  });

  const resolved = service.readAuxByPathAt(workspace.id, point.id, "/current_location");
  expect(resolved?.id).toBeDefined();
  expect(resolved?.nodeType).toBe("symlink");
  expect(resolved?.path).toBe("/current_location");

  const exported = service.exportAuxSnapshotTree(workspace.id, point.id);
  expect(exported.timelinePointId).toBe(point.id);
  expect(exported.nodes.map((node) => node.name)).toEqual(["current_location", "places"]);
  expect(exported.nodes.find((node) => node.name === "current_location")?.symlinkTargetPath).toBe(
    "/places/villa/main_bathroom",
  );
  expect(
    exported.nodes.find((node) => node.name === "places")?.children.map((node) => node.name),
  ).toEqual(["home", "villa"]);
});

test("retargetAuxSymlinkAt updates the exported symlink target path", () => {
  const workspace = seedProject("project_symlink_retarget");
  const rootId = workspace.auxRootId!;

  const oldTarget = service.writeFileAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: rootId,
    name: "old.md",
    content: "old",
  });
  const newTarget = service.mkdirAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: rootId,
    name: "state",
  });
  const symlink = service.linkAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: rootId,
    name: "current",
    targetNodeId: oldTarget.id,
  });

  service.retargetAuxSymlinkAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    symlinkNodeId: symlink.id,
    targetNodeId: newTarget.id,
  });

  const exported = service.exportAuxSnapshotTree(workspace.id);
  expect(exported.nodes.find((node) => node.id === symlink.id)?.symlinkTargetPath).toBe("/state");
  expect(
    service.readAuxByPathAt(workspace.id, service.ORIGIN_TIMELINE_POINT_ID, "/current")?.id,
  ).toBe(symlink.id);
});

test("retargetAuxSymlinkAt can point to another symlink node", () => {
  const workspace = seedProject("project_symlink_retarget_symlink");
  const rootId = workspace.auxRootId!;

  const file = service.writeFileAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: rootId,
    name: "notes.md",
    content: "notes",
  });
  const targetLink = service.linkAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: rootId,
    name: "target_link",
    targetNodeId: file.id,
  });
  const sourceLink = service.linkAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: rootId,
    name: "source_link",
    targetNodeId: file.id,
  });

  service.retargetAuxSymlinkAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    symlinkNodeId: sourceLink.id,
    targetNodeId: targetLink.id,
  });

  const exported = service.exportAuxSnapshotTree(workspace.id);
  expect(exported.nodes.find((node) => node.id === sourceLink.id)?.symlinkTargetPath).toBe(
    "/target_link",
  );
  expect(
    service.readAuxByPathAt(workspace.id, service.ORIGIN_TIMELINE_POINT_ID, "/source_link")?.id,
  ).toBe(sourceLink.id);
});

test("retargetAuxSymlinkAt records self and indirect symlink targets", () => {
  const workspace = seedProject("project_symlink_retarget_cycle");
  const rootId = workspace.auxRootId!;

  const file = service.writeFileAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: rootId,
    name: "notes.md",
    content: "notes",
  });
  const sourceLink = service.linkAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: rootId,
    name: "source_link",
    targetNodeId: file.id,
  });
  const loopB = service.linkAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: rootId,
    name: "loop_b",
    targetNodeId: sourceLink.id,
  });
  const loopA = service.linkAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: rootId,
    name: "loop_a",
    targetNodeId: loopB.id,
  });

  service.retargetAuxSymlinkAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    symlinkNodeId: sourceLink.id,
    targetNodeId: sourceLink.id,
  });
  expect(
    service.exportAuxSnapshotTree(workspace.id).nodes.find((node) => node.id === sourceLink.id)
      ?.symlinkTargetAuxNodeId,
  ).toBe(sourceLink.id);

  service.retargetAuxSymlinkAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    symlinkNodeId: sourceLink.id,
    targetNodeId: loopA.id,
  });
  expect(
    service.exportAuxSnapshotTree(workspace.id).nodes.find((node) => node.id === sourceLink.id)
      ?.symlinkTargetPath,
  ).toBe("/loop_a");
});

test("retargetAuxSymlinkAt rejects non-symlink sources", () => {
  const workspace = seedProject("project_symlink_retarget_non_symlink");
  const rootId = workspace.auxRootId!;

  const file = service.writeFileAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: rootId,
    name: "notes.md",
    content: "notes",
  });
  const dir = service.mkdirAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: rootId,
    name: "state",
  });

  expect(() =>
    service.retargetAuxSymlinkAt({
      workspaceId: workspace.id,
      timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
      symlinkNodeId: file.id,
      targetNodeId: dir.id,
    }),
  ).toThrow("当前辅助信息不是链接。");
});

test("aux node names must stay unique within the same parent", () => {
  const workspace = seedProject("project_aux_unique_names");
  const rootId = workspace.auxRootId!;

  const notesFile = service.writeFileAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: rootId,
    name: "notes.md",
    content: "notes",
  });
  const stateDir = service.mkdirAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: rootId,
    name: "state",
  });

  expect(() =>
    service.moveAuxNodeAt({
      workspaceId: workspace.id,
      timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
      nodeId: stateDir.id,
      newParentDirId: rootId,
      newName: "notes.md",
    }),
  ).toThrow("同名辅助信息已存在。");

  const spacedDir = service.mkdirAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: rootId,
    name: " notes.md ",
  });
  expect(spacedDir.id).toBeTruthy();

  expect(() =>
    service.writeFileAt({
      workspaceId: workspace.id,
      timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
      parentDirId: rootId,
      name: "notes.md",
      content: "duplicate",
    }),
  ).toThrow("同名辅助信息已存在。");

  expect(() =>
    service.linkAt({
      workspaceId: workspace.id,
      timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
      parentDirId: rootId,
      name: "notes.md",
      targetNodeId: notesFile.id,
    }),
  ).toThrow("同名辅助信息已存在。");

  expect(service.exportAuxSnapshotTree(workspace.id).nodes.map((node) => node.path)).toEqual([
    "/ notes.md ",
    "/notes.md",
    "/state",
  ]);
});

test("origin aux creation can coexist with descendant timeline names", () => {
  const workspace = seedProject("project_aux_origin_descendant_duplicate");
  const rootId = workspace.auxRootId!;
  const point = service.createTimelinePoint({
    workspaceId: workspace.id,
    afterPointId: service.ORIGIN_TIMELINE_POINT_ID,
    label: "Point 1",
  });

  service.writeFileAt({
    workspaceId: workspace.id,
    timelinePointId: point.id,
    parentDirId: rootId,
    name: "新文件 1",
    content: "point file",
  });

  service.writeFileAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: rootId,
    name: "新文件 1",
    content: "origin file",
  });

  expect(
    service.exportAuxSnapshotTree(workspace.id, point.id).nodes.map((node) => node.path),
  ).toEqual(["/新文件 1", "/新文件 1"]);
});

test("aux snapshot sorts top-level nodes by path", () => {
  const workspace = seedProject("project_aux_natural_sort");
  const rootId = workspace.auxRootId!;

  service.writeFileAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: rootId,
    name: "文件10",
    content: "",
  });
  service.mkdirAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: rootId,
    name: "目录十",
  });
  service.writeFileAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: rootId,
    name: "文件2",
    content: "",
  });
  service.mkdirAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: rootId,
    name: "目录二",
  });
  service.linkAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: rootId,
    name: "文件１ - 链接",
    targetNodeId: rootId,
  });

  expect(service.exportAuxSnapshotTree(workspace.id).nodes.map((node) => node.path)).toEqual([
    "/文件１ - 链接",
    "/文件10",
    "/文件2",
    "/目录二",
    "/目录十",
  ]);
});

test("aux snapshot omits deleted nodes from the visible tree", () => {
  const workspace = seedProject("project_aux_deleted_ghost_natural_sort");
  const rootId = workspace.auxRootId!;

  const file10 = service.writeFileAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: rootId,
    name: "文件10",
    content: "",
  });
  service.writeFileAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: rootId,
    name: "文件2",
    content: "",
  });

  const point = service.createTimelinePoint({
    workspaceId: workspace.id,
    afterPointId: service.ORIGIN_TIMELINE_POINT_ID,
    label: "After delete file 10",
  });
  service.deleteAuxNodeAt({
    workspaceId: workspace.id,
    timelinePointId: point.id,
    nodeId: file10.id,
  });
  service.writeFileAt({
    workspaceId: workspace.id,
    timelinePointId: point.id,
    parentDirId: rootId,
    name: "文件1",
    content: "",
  });

  const snapshot = service.exportAuxSnapshotTree(workspace.id, point.id);

  expect(snapshot.nodes.map((node) => [node.path, node.isDeleted])).toEqual([
    ["/文件1", false],
    ["/文件2", false],
  ]);
});

test("aux snapshot marks visible nodes with layers at the active timeline point", () => {
  const workspace = seedProject("project_aux_snapshot_changes");
  const rootId = workspace.auxRootId!;

  const stateDir = service.mkdirAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: rootId,
    name: "state",
  });
  const locationFile = service.writeFileAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: stateDir.id,
    name: "location.md",
    content: "home",
  });
  const characterFile = service.writeFileAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: stateDir.id,
    name: "character.md",
    content: "calm",
  });

  const originSnapshot = service.exportAuxSnapshotTree(
    workspace.id,
    service.ORIGIN_TIMELINE_POINT_ID,
  );
  expect(flattenAuxNodes(originSnapshot.nodes).every((node) => !node.hasTimelineChange)).toBe(true);

  const point = service.createTimelinePoint({
    workspaceId: workspace.id,
    afterPointId: service.ORIGIN_TIMELINE_POINT_ID,
    label: "After departure",
  });
  service.writeFileAt({
    workspaceId: workspace.id,
    timelinePointId: point.id,
    nodeId: locationFile.id,
    content: "home",
  });
  service.mkdirAt({
    workspaceId: workspace.id,
    timelinePointId: point.id,
    parentDirId: rootId,
    name: "delta-only",
  });
  service.moveAuxNodeAt({
    workspaceId: workspace.id,
    timelinePointId: point.id,
    nodeId: characterFile.id,
    newParentDirId: rootId,
    newName: "cast.md",
  });

  const pointSnapshot = service.exportAuxSnapshotTree(workspace.id, point.id);
  const changesByPath = new Map(
    flattenAuxNodes(pointSnapshot.nodes).map((node) => [node.path, node.hasTimelineChange]),
  );

  expect(changesByPath.get("/state")).toBe(false);
  expect(changesByPath.get("/state/location.md")).toBe(true);
  expect(changesByPath.get("/delta-only")).toBe(true);
  expect(changesByPath.get("/cast.md")).toBe(true);
});

test("aux snapshot omits deleted folders and descendants", () => {
  const workspace = seedProject("project_aux_deleted_ghosts");
  const rootId = workspace.auxRootId!;

  const stateDir = service.mkdirAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: rootId,
    name: "state",
  });
  service.writeFileAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: stateDir.id,
    name: "location.md",
    content: "home",
  });

  const point = service.createTimelinePoint({
    workspaceId: workspace.id,
    afterPointId: service.ORIGIN_TIMELINE_POINT_ID,
    label: "After delete state",
  });
  service.deleteAuxNodeAt({
    workspaceId: workspace.id,
    timelinePointId: point.id,
    nodeId: stateDir.id,
  });

  const snapshot = service.exportAuxSnapshotTree(workspace.id, point.id);
  expect(snapshot.nodes.find((node) => node.path === "/state")).toBeUndefined();
  expect(
    flattenAuxNodes(snapshot.nodes).find((node) => node.path === "/state/location.md"),
  ).toBeUndefined();
});

test("restoreAuxNodeAt only restores deleted aux nodes", () => {
  const workspace = seedProject("project_aux_restore_layer");
  const rootId = workspace.auxRootId!;

  const notesFile = service.writeFileAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: rootId,
    name: "notes.md",
    content: "origin",
  });
  const point = service.createTimelinePoint({
    workspaceId: workspace.id,
    afterPointId: service.ORIGIN_TIMELINE_POINT_ID,
    label: "After notes",
  });
  service.writeFileAt({
    workspaceId: workspace.id,
    timelinePointId: point.id,
    nodeId: notesFile.id,
    content: "changed",
  });

  expect(service.readAuxByIdAt(workspace.id, point.id, notesFile.id)?.content).toBe("changed");
  expect(() =>
    service.restoreAuxNodeAt({
      workspaceId: workspace.id,
      timelinePointId: point.id,
      nodeId: notesFile.id,
    }),
  ).toThrow("未找到可恢复的辅助信息。");
});

test("restoreAuxNodeAt restores deleted aux nodes by removing the tombstone layer", () => {
  const workspace = seedProject("project_aux_restore_delete");
  const rootId = workspace.auxRootId!;

  const notesFile = service.writeFileAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: rootId,
    name: "notes.md",
    content: "origin",
  });
  const point = service.createTimelinePoint({
    workspaceId: workspace.id,
    afterPointId: service.ORIGIN_TIMELINE_POINT_ID,
    label: "After delete notes",
  });
  service.deleteAuxNodeAt({
    workspaceId: workspace.id,
    timelinePointId: point.id,
    nodeId: notesFile.id,
  });

  expect(service.readAuxByIdAt(workspace.id, point.id, notesFile.id)).toBeNull();

  service.restoreAuxNodeAt({
    workspaceId: workspace.id,
    timelinePointId: point.id,
    nodeId: notesFile.id,
  });

  const restored = service.exportAuxSnapshotTree(workspace.id, point.id).nodes[0];
  expect(restored?.path).toBe("/notes.md");
  expect(restored?.isDeleted).toBe(false);
  expect(restored?.hasTimelineChange).toBe(false);
});

test("restoreAuxNodeAt rejects restore when no tombstone exists", () => {
  const workspace = seedProject("project_aux_restore_rename_duplicate");
  const rootId = workspace.auxRootId!;

  const notesFile = service.writeFileAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: rootId,
    name: "notes.md",
    content: "origin",
  });
  const point = service.createTimelinePoint({
    workspaceId: workspace.id,
    afterPointId: service.ORIGIN_TIMELINE_POINT_ID,
    label: "After rename notes",
  });
  service.moveAuxNodeAt({
    workspaceId: workspace.id,
    timelinePointId: point.id,
    nodeId: notesFile.id,
    newParentDirId: rootId,
    newName: "archive.md",
  });
  service.writeFileAt({
    workspaceId: workspace.id,
    timelinePointId: point.id,
    parentDirId: rootId,
    name: "notes.md",
    content: "current point notes",
  });

  expect(() =>
    service.restoreAuxNodeAt({
      workspaceId: workspace.id,
      timelinePointId: point.id,
      nodeId: notesFile.id,
    }),
  ).toThrow("未找到可恢复的辅助信息。");

  expect(
    service.exportAuxSnapshotTree(workspace.id, point.id).nodes.map((node) => node.path),
  ).toEqual(["/archive.md", "/notes.md"]);
});

test("restoreAuxNodeAt can reveal duplicate visible paths", () => {
  const workspace = seedProject("project_aux_restore_delete_duplicate");
  const rootId = workspace.auxRootId!;

  const notesFile = service.writeFileAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: rootId,
    name: "notes.md",
    content: "origin",
  });
  const point = service.createTimelinePoint({
    workspaceId: workspace.id,
    afterPointId: service.ORIGIN_TIMELINE_POINT_ID,
    label: "After delete duplicate notes",
  });
  service.deleteAuxNodeAt({
    workspaceId: workspace.id,
    timelinePointId: point.id,
    nodeId: notesFile.id,
  });
  service.writeFileAt({
    workspaceId: workspace.id,
    timelinePointId: point.id,
    parentDirId: rootId,
    name: "notes.md",
    content: "replacement",
  });

  service.restoreAuxNodeAt({
    workspaceId: workspace.id,
    timelinePointId: point.id,
    nodeId: notesFile.id,
  });

  const snapshot = service.exportAuxSnapshotTree(workspace.id, point.id);
  expect(snapshot.nodes.map((node) => node.path)).toEqual(["/notes.md", "/notes.md"]);
});

test("content node deletion removes subtree and preserves sibling order", () => {
  const workspace = seedProject("project_content_delete");
  const rootId = workspace.contentRootId!;

  const chapter1 = service.createContentNode({
    workspaceId: workspace.id,
    parentId: rootId,
    title: "Chapter 1",
  });
  service.createContentNode({
    workspaceId: workspace.id,
    parentId: rootId,
    afterSiblingId: chapter1.id,
    title: "Chapter 2",
  });
  service.createContentNode({
    workspaceId: workspace.id,
    parentId: chapter1.id,
    title: "Scene 1",
  });

  service.deleteContentNode({ workspaceId: workspace.id, nodeId: chapter1.id });

  const exported = service.exportContentSubtree(workspace.id);
  expect(exported.nodes.map((node) => node.title)).toEqual(["Chapter 2"]);
});

test("deleting a middle content sibling rewires next sibling without violating uniqueness", () => {
  const workspace = seedProject("project_content_delete_middle");
  const rootId = workspace.contentRootId!;

  const chapter1 = service.createContentNode({
    workspaceId: workspace.id,
    parentId: rootId,
    title: "Chapter 1",
  });
  const chapter2 = service.createContentNode({
    workspaceId: workspace.id,
    parentId: rootId,
    afterSiblingId: chapter1.id,
    title: "Chapter 2",
  });
  service.createContentNode({
    workspaceId: workspace.id,
    parentId: rootId,
    afterSiblingId: chapter2.id,
    title: "Chapter 3",
  });

  expect(() =>
    service.deleteContentNode({ workspaceId: workspace.id, nodeId: chapter2.id }),
  ).not.toThrow();

  const exported = service.exportContentSubtree(workspace.id);
  expect(exported.nodes.map((node) => node.title)).toEqual(["Chapter 1", "Chapter 3"]);
});

test("content node move can reorder across parents and preserve child order", () => {
  const workspace = seedProject("project_content_move_cross_parent");
  const rootId = workspace.contentRootId!;

  const chapter1 = service.createContentNode({
    workspaceId: workspace.id,
    parentId: rootId,
    title: "Chapter 1",
  });
  const chapter2 = service.createContentNode({
    workspaceId: workspace.id,
    parentId: rootId,
    afterSiblingId: chapter1.id,
    title: "Chapter 2",
  });
  const scene1 = service.createContentNode({
    workspaceId: workspace.id,
    parentId: chapter1.id,
    title: "Scene 1",
  });
  service.createContentNode({
    workspaceId: workspace.id,
    parentId: chapter1.id,
    afterSiblingId: scene1.id,
    title: "Scene 2",
  });

  service.moveContentNode({
    workspaceId: workspace.id,
    nodeId: scene1.id,
    newParentId: chapter2.id,
  });

  const exported = service.exportContentSubtree(workspace.id);
  expect(exported.nodes.map((node) => node.title)).toEqual(["Chapter 1", "Chapter 2"]);
  expect(exported.nodes[0]?.children.map((node) => node.title)).toEqual(["Scene 2"]);
  expect(exported.nodes[1]?.children.map((node) => node.title)).toEqual(["Scene 1"]);

  service.moveContentNode({
    workspaceId: workspace.id,
    nodeId: chapter2.id,
    newParentId: rootId,
  });

  expect(service.exportContentSubtree(workspace.id).nodes.map((node) => node.title)).toEqual([
    "Chapter 2",
    "Chapter 1",
  ]);
});

test("content node move rejects moving a node below its own descendant", () => {
  const workspace = seedProject("project_content_move_into_descendant");
  const rootId = workspace.contentRootId!;

  const chapter = service.createContentNode({
    workspaceId: workspace.id,
    parentId: rootId,
    title: "Chapter",
  });
  const scene = service.createContentNode({
    workspaceId: workspace.id,
    parentId: chapter.id,
    title: "Scene",
  });

  expect(() =>
    service.moveContentNode({
      workspaceId: workspace.id,
      nodeId: chapter.id,
      newParentId: scene.id,
    }),
  ).toThrow("无法移动：不能把章节移动到自己的子章节下。");
});

test("content node anchor point can be updated", () => {
  const workspace = seedProject("project_anchor_update");
  const contentRootId = workspace.contentRootId!;

  const pointA = service.createTimelinePoint({
    workspaceId: workspace.id,
    afterPointId: service.ORIGIN_TIMELINE_POINT_ID,
    label: "Point A",
  });
  const pointB = service.createTimelinePoint({
    workspaceId: workspace.id,
    afterPointId: pointA.id,
    label: "Point B",
  });
  const scene = service.createContentNode({
    workspaceId: workspace.id,
    parentId: contentRootId,
    anchorPointId: pointA.id,
    title: "Scene",
  });

  service.updateContentNode({
    workspaceId: workspace.id,
    nodeId: scene.id,
    anchorPointId: pointB.id,
  });

  const exported = service.exportContentSubtree(workspace.id);
  expect(exported.nodes[0]?.anchorTimelinePointId).toBe(pointB.id);
});

test("timeline point deletion is blocked when content still anchors to it", () => {
  const workspace = seedProject("project_guard");
  const contentRootId = workspace.contentRootId!;
  const point = service.createTimelinePoint({
    workspaceId: workspace.id,
    afterPointId: service.ORIGIN_TIMELINE_POINT_ID,
    label: "Occupied point",
  });

  service.createContentNode({
    workspaceId: workspace.id,
    parentId: contentRootId,
    anchorPointId: point.id,
    title: "Guarded",
  });

  expect(() => service.deleteTimelinePoint(workspace.id, point.id)).toThrow(
    "无法删除：仍有章节锚定到该时间点。",
  );
});

test("listAuxChangesAt only returns layer changes at the requested timeline point", () => {
  const workspace = seedProject("project_aux_changes");
  const rootId = workspace.auxRootId!;

  const stateDir = service.mkdirAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: rootId,
    name: "state",
  });
  const locationFile = service.writeFileAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: stateDir.id,
    name: "location.md",
    content: "home",
  });
  const point = service.createTimelinePoint({
    workspaceId: workspace.id,
    afterPointId: service.ORIGIN_TIMELINE_POINT_ID,
    label: "Overlay point",
  });
  service.writeFileAt({
    workspaceId: workspace.id,
    timelinePointId: point.id,
    nodeId: locationFile.id,
    content: "park",
  });
  service.mkdirAt({
    workspaceId: workspace.id,
    timelinePointId: point.id,
    parentDirId: rootId,
    name: "delta-only",
  });

  expect(service.listAuxChangesAt(workspace.id, point.id)).toEqual([
    { path: "/state/location.md", isDeleted: false },
    { path: "/delta-only", isDeleted: false },
  ]);
});

test("listAuxTimelineChangesAt compares a timeline point against its predecessor", () => {
  const workspace = seedProject("project_aux_timeline_diff");
  const auxRootId = workspace.auxRootId!;

  const stateDir = service.mkdirAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: auxRootId,
    name: "state",
  });
  const locationFile = service.writeFileAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: stateDir.id,
    name: "location.md",
    content: "home",
  });
  const backupFile = service.writeFileAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: stateDir.id,
    name: "backup.md",
    content: "backup",
  });
  const currentLocation = service.linkAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: auxRootId,
    name: "current_location",
    targetNodeId: locationFile.id,
  });
  const pointA = service.createTimelinePoint({
    workspaceId: workspace.id,
    afterPointId: service.ORIGIN_TIMELINE_POINT_ID,
    label: "离家后",
  });
  const deltaFile = service.writeFileAt({
    workspaceId: workspace.id,
    timelinePointId: pointA.id,
    parentDirId: auxRootId,
    name: "delta-only.md",
    content: "delta",
  });
  service.writeFileAt({
    workspaceId: workspace.id,
    timelinePointId: pointA.id,
    nodeId: locationFile.id,
    content: "park",
  });
  const pointB = service.createTimelinePoint({
    workspaceId: workspace.id,
    afterPointId: pointA.id,
    label: "折返前",
  });
  service.deleteAuxNodeAt({
    workspaceId: workspace.id,
    timelinePointId: pointB.id,
    nodeId: deltaFile.id,
  });
  service.retargetAuxSymlinkAt({
    workspaceId: workspace.id,
    timelinePointId: pointB.id,
    symlinkNodeId: currentLocation.id,
    targetNodeId: backupFile.id,
  });

  expect(service.summarizeAuxTimelineChangesAt(workspace.id, pointA.id)).toEqual({
    hasChanges: true,
    added: 1,
    modified: 1,
    deleted: 0,
    total: 2,
  });
  expect(service.listAuxTimelineChangesAt(workspace.id, pointB.id)).toEqual([
    {
      kind: "modified",
      nodeId: currentLocation.id,
      nodeType: "symlink",
      path: "/current_location",
      previousPath: null,
      symlinkTargetPath: null,
      previousSymlinkTargetPath: null,
      changedAspects: ["content"],
      isDeleted: false,
    },
    {
      kind: "deleted",
      nodeId: deltaFile.id,
      nodeType: "file",
      path: "/delta-only.md",
      previousPath: null,
      symlinkTargetPath: null,
      previousSymlinkTargetPath: null,
      changedAspects: [],
      isDeleted: true,
    },
  ]);
});

test("timeline point deletion is blocked when auxiliary layers exist without purge", () => {
  const workspace = seedProject("project_aux_guard");
  const auxRootId = workspace.auxRootId!;
  const point = service.createTimelinePoint({
    workspaceId: workspace.id,
    afterPointId: service.ORIGIN_TIMELINE_POINT_ID,
    label: "Aux point",
  });

  service.mkdirAt({
    workspaceId: workspace.id,
    timelinePointId: point.id,
    parentDirId: auxRootId,
    name: "notes",
  });

  expect(() => service.deleteTimelinePoint(workspace.id, point.id)).toThrow(
    "无法删除：该时间点仍有辅助信息变更。",
  );
});

test("timeline point deletion purges auxiliary JSONL layers when requested", () => {
  const workspace = seedProject("project_aux_purge");
  const auxRootId = workspace.auxRootId!;
  const point = service.createTimelinePoint({
    workspaceId: workspace.id,
    afterPointId: service.ORIGIN_TIMELINE_POINT_ID,
    label: "Purge point",
  });

  const notesDir = service.mkdirAt({
    workspaceId: workspace.id,
    timelinePointId: point.id,
    parentDirId: auxRootId,
    name: "notes",
  });

  service.deleteTimelinePoint(workspace.id, point.id, { purgeAuxLayers: true });

  expect(service.listTimelinePoints(workspace.id).some((item) => item.id === point.id)).toBe(false);
  expect(auxLayers(workspace).some((layer) => layer.timelinePointId === point.id)).toBe(false);
  expect(auxLayers(workspace).some((layer) => layer.auxNodeId === notesDir.id)).toBe(false);
});

test("timeline point insertion at origin rewires the previous head", () => {
  const workspace = seedProject("project_timeline_insert_origin");
  const pointA = service.createTimelinePoint({
    workspaceId: workspace.id,
    afterPointId: service.ORIGIN_TIMELINE_POINT_ID,
    label: "Point A",
  });

  const pointB = service.createTimelinePoint({
    workspaceId: workspace.id,
    afterPointId: service.ORIGIN_TIMELINE_POINT_ID,
    label: "Point B",
  });

  const ordered = service.listTimelinePoints(workspace.id);
  expect(ordered.map((point) => point.id)).toEqual([
    service.ORIGIN_TIMELINE_POINT_ID,
    pointB.id,
    pointA.id,
  ]);
});

test("timeline point batch insertion preserves order without requiring intermediate ids", () => {
  const workspace = seedProject("project_timeline_insert_batch");
  const pointA = service.createTimelinePoint({
    workspaceId: workspace.id,
    afterPointId: service.ORIGIN_TIMELINE_POINT_ID,
    label: "Point A",
  });

  const created = service.createTimelinePoints({
    workspaceId: workspace.id,
    afterPointId: service.ORIGIN_TIMELINE_POINT_ID,
    points: [{ label: "Point B" }, { label: "Point C" }, { label: "Point D" }],
  });

  const ordered = service.listTimelinePoints(workspace.id);
  expect(created.map((point) => point.label)).toEqual(["Point B", "Point C", "Point D"]);
  expect(ordered.map((point) => point.id)).toEqual([
    service.ORIGIN_TIMELINE_POINT_ID,
    created[0]!.id,
    created[1]!.id,
    created[2]!.id,
    pointA.id,
  ]);
});

test("timeline point move rewires both source and target segments", () => {
  const workspace = seedProject("project_timeline_move");
  const pointA = service.createTimelinePoint({
    workspaceId: workspace.id,
    afterPointId: service.ORIGIN_TIMELINE_POINT_ID,
    label: "Point A",
  });
  const pointB = service.createTimelinePoint({
    workspaceId: workspace.id,
    afterPointId: pointA.id,
    label: "Point B",
  });
  const pointC = service.createTimelinePoint({
    workspaceId: workspace.id,
    afterPointId: pointB.id,
    label: "Point C",
  });
  const pointD = service.createTimelinePoint({
    workspaceId: workspace.id,
    afterPointId: pointC.id,
    label: "Point D",
  });

  service.moveTimelinePoint({
    workspaceId: workspace.id,
    pointId: pointC.id,
    afterPointId: service.ORIGIN_TIMELINE_POINT_ID,
  });

  let ordered = service.listTimelinePoints(workspace.id);
  expect(ordered.map((point) => point.id)).toEqual([
    service.ORIGIN_TIMELINE_POINT_ID,
    pointC.id,
    pointA.id,
    pointB.id,
    pointD.id,
  ]);

  service.moveTimelinePoint({
    workspaceId: workspace.id,
    pointId: pointA.id,
    afterPointId: pointD.id,
  });

  ordered = service.listTimelinePoints(workspace.id);
  expect(ordered.map((point) => point.id)).toEqual([
    service.ORIGIN_TIMELINE_POINT_ID,
    pointC.id,
    pointB.id,
    pointD.id,
    pointA.id,
  ]);
});

test("deleteAuxNodeAt records a tombstone and hides the aux node", () => {
  const workspace = seedProject("project_aux_gc_delete");
  const auxRootId = workspace.auxRootId!;

  const notesDir = service.mkdirAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: auxRootId,
    name: "notes",
  });

  service.deleteAuxNodeAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    nodeId: notesDir.id,
  });

  expect(
    service.readAuxByIdAt(workspace.id, service.ORIGIN_TIMELINE_POINT_ID, notesDir.id),
  ).toBeNull();
  expect(auxLayers(workspace).filter((layer) => layer.auxNodeId === notesDir.id)).toMatchObject([
    { isDeleted: false },
    { isDeleted: true },
  ]);
});

test("deleting an aux parent hides its descendants but keeps JSONL history", () => {
  const workspace = seedProject("project_aux_gc_parent_guard");
  const auxRootId = workspace.auxRootId!;

  const parentDir = service.mkdirAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: auxRootId,
    name: "state",
  });
  const childFile = service.writeFileAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: parentDir.id,
    name: "location.md",
    content: "home",
  });

  service.deleteAuxNodeAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    nodeId: parentDir.id,
  });

  expect(
    service.readAuxByIdAt(workspace.id, service.ORIGIN_TIMELINE_POINT_ID, parentDir.id),
  ).toBeNull();
  expect(
    service.readAuxByIdAt(workspace.id, service.ORIGIN_TIMELINE_POINT_ID, childFile.id),
  ).toBeNull();
  expect(auxLayers(workspace).some((layer) => layer.auxNodeId === childFile.id)).toBe(true);
});

test("deleting an aux symlink leaves its target visible", () => {
  const workspace = seedProject("project_aux_gc_symlink_guard");
  const auxRootId = workspace.auxRootId!;

  const targetDir = service.mkdirAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: auxRootId,
    name: "places",
  });
  const link = service.linkAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: auxRootId,
    name: "current",
    targetNodeId: targetDir.id,
  });

  service.deleteAuxNodeAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    nodeId: link.id,
  });

  expect(
    service.readAuxByIdAt(workspace.id, service.ORIGIN_TIMELINE_POINT_ID, targetDir.id),
  ).not.toBeNull();
  expect(service.readAuxByIdAt(workspace.id, service.ORIGIN_TIMELINE_POINT_ID, link.id)).toBeNull();
});

test("deleted aux subtree nodes are hidden while their tombstones remain in JSONL", () => {
  const workspace = seedProject("project_aux_gc_subtree");
  const auxRootId = workspace.auxRootId!;

  const parentDir = service.mkdirAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: auxRootId,
    name: "state",
  });
  const childFile = service.writeFileAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    parentDirId: parentDir.id,
    name: "location.md",
    content: "home",
  });

  service.deleteAuxNodeAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    nodeId: childFile.id,
  });
  service.deleteAuxNodeAt({
    workspaceId: workspace.id,
    timelinePointId: service.ORIGIN_TIMELINE_POINT_ID,
    nodeId: parentDir.id,
  });

  expect(
    service.readAuxByIdAt(workspace.id, service.ORIGIN_TIMELINE_POINT_ID, childFile.id),
  ).toBeNull();
  expect(
    service.readAuxByIdAt(workspace.id, service.ORIGIN_TIMELINE_POINT_ID, parentDir.id),
  ).toBeNull();
  expect(
    auxLayers(workspace)
      .filter((layer) => layer.isDeleted)
      .map((layer) => layer.auxNodeId),
  ).toEqual([childFile.id, parentDir.id]);
});

test("timeline point label can be updated", () => {
  const workspace = seedProject("project_timeline_update");
  const point = service.createTimelinePoint({
    workspaceId: workspace.id,
    afterPointId: service.ORIGIN_TIMELINE_POINT_ID,
    label: "Before update",
  });

  service.updateTimelinePoint({
    workspaceId: workspace.id,
    pointId: point.id,
    label: "After update",
  });

  const points = service.listTimelinePoints(workspace.id);
  const updated = points.find((entry) => entry.id === point.id);
  expect(updated?.label).toBe("After update");
});

test("implicit origin timeline point cannot be updated", () => {
  const workspace = seedProject("project_timeline_origin_guard");

  expect(() =>
    service.updateTimelinePoint({
      workspaceId: workspace.id,
      pointId: service.ORIGIN_TIMELINE_POINT_ID,
      label: "Forbidden",
    }),
  ).toThrow("无法修改原点时间点。");
});
