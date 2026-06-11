import { expect, mock, test } from "bun:test";
import { ScopeProvider } from "bunshi/react";
import { renderToStaticMarkup } from "react-dom/server";

import type { AuxTreeNodeVM } from "@/modules/workspace/ui/editor/model/types";

import { ProjectScope } from "../scopes";
import { useWorkspaceStoreApi, type WorkspaceStore } from "../molecules/workspaceStore";
import { useProjectActions } from "./useProjectActions";
import type { ProjectWorkspaceState } from "./useProjectWorkspace";

function createAuxNode(overrides: Partial<AuxTreeNodeVM> & Pick<AuxTreeNodeVM, "id" | "name">) {
  const { id, name, ...rest } = overrides;
  return {
    id,
    nodeType: "file",
    name,
    content: "",
    path: `/${name}`,
    symlinkTargetPath: null,
    hasTimelineChange: false,
    isDeleted: false,
    children: [],
    ...rest,
  } satisfies AuxTreeNodeVM;
}

function buildAuxMaps(nodes: AuxTreeNodeVM[], parentId: string | null = null) {
  const nodeMap = new Map<string, AuxTreeNodeVM>();
  const parentMap = new Map<string, string | null>();

  const visit = (currentNodes: AuxTreeNodeVM[], currentParentId: string | null) => {
    for (const node of currentNodes) {
      nodeMap.set(node.id, node);
      parentMap.set(node.id, currentParentId);
      visit(node.children, node.id);
    }
  };

  visit(nodes, parentId);
  return { nodeMap, parentMap };
}

function createWorkspaceState(input: {
  auxTree: AuxTreeNodeVM[];
  auxRootId?: string;
  moveMutate?: (_input: {
    workspaceId: string;
    timelinePointId: string;
    nodeId: string;
    newParentDirId: string;
    newName: string;
  }) => Promise<{ id: string }>;
  linkMutate?: (_input: {
    workspaceId: string;
    timelinePointId: string;
    parentDirId: string;
    name: string;
    targetNodeId: string;
  }) => Promise<{ id: string }>;
}) {
  const auxRootId = input.auxRootId ?? "aux_root";
  const { nodeMap, parentMap } = buildAuxMaps(input.auxTree, auxRootId);

  return {
    identity: {
      workspaceId: "workspace_1",
      contentRootId: "content_root",
    },
    content: {
      tree: [],
      flatNodes: [],
      nodeMap: new Map(),
      parentMap: new Map(),
      createContent: { isPending: false, mutate: mock(async () => ({ id: "content_new" })) },
      deleteContent: { isPending: false, mutate: mock(async () => undefined) },
      moveContent: { isPending: false, mutate: mock(async () => undefined) },
      updateContent: { isPending: false, mutate: mock(async () => ({ id: "content_1" })) },
    },
    timeline: {
      points: [],
      createTimeline: { isPending: false, mutate: mock(async () => ({ id: "point_new" })) },
      moveTimeline: { isPending: false, mutate: mock(async () => undefined) },
      deleteTimeline: { isPending: false, mutate: mock(async () => undefined) },
      updateTimeline: { isPending: false, mutate: mock(async () => undefined) },
    },
    aux: {
      tree: input.auxTree,
      rootId: auxRootId,
      nodeMap,
      parentMap,
      mkdirAux: { isPending: false, mutate: mock(async () => ({ id: "aux_dir_new" })) },
      writeFileAux: { isPending: false, mutate: mock(async () => ({ id: "aux_file_new" })) },
      linkAux: {
        isPending: false,
        mutate:
          input.linkMutate ??
          mock(async () => ({
            id: "aux_link_new",
          })),
      },
      moveAux: {
        isPending: false,
        mutate:
          input.moveMutate ??
          mock(async () => ({
            id: "aux_moved",
          })),
      },
      deleteAux: { isPending: false, mutate: mock(async () => undefined) },
      restoreAux: { isPending: false, mutate: mock(async () => undefined) },
    },
    selection: {
      activeContentNode: null,
    },
    editor: {},
  } as unknown as ProjectWorkspaceState;
}

function renderActions(workspace: ProjectWorkspaceState): {
  actions: ReturnType<typeof useProjectActions>;
  store: WorkspaceStore;
} {
  let capturedActions: ReturnType<typeof useProjectActions> | null = null;
  let capturedStore: WorkspaceStore | null = null;

  function Harness() {
    capturedActions = useProjectActions(workspace);
    capturedStore = useWorkspaceStoreApi();
    return null;
  }

  renderToStaticMarkup(
    <ScopeProvider scope={ProjectScope} value="project_actions_test">
      <Harness />
    </ScopeProvider>,
  );

  const actions = capturedActions;
  const store = capturedStore;

  if (!actions || !store) {
    throw new Error("failed to capture hook state");
  }

  return { actions, store };
}

test("handleAuxCreateSymlink creates a same-directory symlink with a unique generated name", async () => {
  const target = createAuxNode({ id: "aux_1", name: "notes.md" });
  const workspace = createWorkspaceState({
    auxTree: [
      target,
      createAuxNode({ id: "aux_2", name: "notes.md - 链接 1" }),
      createAuxNode({ id: "aux_3", name: "notes.md - 链接 2" }),
    ],
    linkMutate: mock(async () => ({ id: "aux_link_3" })),
  });
  const { actions, store } = renderActions(workspace);

  store.getState().setActiveTimelinePointId("timeline_1");
  store.getState().setShouldAutoSelectContent(true);
  await actions.handleAuxCreateSymlink(target, "aux:create-symlink:aux_1");

  expect(workspace.aux.linkAux.mutate).toHaveBeenCalledWith({
    workspaceId: "workspace_1",
    timelinePointId: "timeline_1",
    parentDirId: "aux_root",
    name: "notes.md - 链接 3",
    targetNodeId: "aux_1",
  });
  expect(store.getState().activeAuxNodeId).toBe("aux_link_3");
  expect(store.getState().pendingAuxNodeId).toBe("aux_link_3");
  expect(store.getState().shouldAutoSelectContent).toBe(false);
  expect(store.getState().expandedAuxIds.has("aux_root")).toBe(true);
});

test("handleAuxCreateSymlink reports action errors without changing selection on failure", async () => {
  const target = createAuxNode({ id: "aux_1", name: "notes.md" });
  const workspace = createWorkspaceState({
    auxTree: [target],
    linkMutate: mock(async () => {
      throw new Error("创建失败");
    }),
  });
  const { actions, store } = renderActions(workspace);

  store.getState().setActiveTimelinePointId("timeline_1");
  await actions.handleAuxCreateSymlink(target, "aux:create-symlink:aux_1");

  expect(store.getState().activeAuxNodeId).toBeNull();
  expect(store.getState().auxError).toEqual({
    message: "创建失败",
    anchorId: "aux:create-symlink:aux_1",
  });
});

test("handleAuxCreateSymlink links to the symlink node itself when invoked on a symlink row", async () => {
  const symlink = createAuxNode({
    id: "aux_link_source",
    nodeType: "symlink",
    name: "角色入口",
    symlinkTargetPath: "/设定/角色.md",
  });
  const workspace = createWorkspaceState({
    auxTree: [symlink],
    linkMutate: mock(async () => ({ id: "aux_link_copy" })),
  });
  const { actions, store } = renderActions(workspace);

  store.getState().setActiveTimelinePointId("timeline_1");
  await actions.handleAuxCreateSymlink(symlink, "aux:create-symlink:aux_link_source");

  expect(workspace.aux.linkAux.mutate).toHaveBeenCalledWith({
    workspaceId: "workspace_1",
    timelinePointId: "timeline_1",
    parentDirId: "aux_root",
    name: "角色入口 - 链接 1",
    targetNodeId: "aux_link_source",
  });
});

test("handleAuxMove moves a node into a directory and keeps its current name", async () => {
  const workspace = createWorkspaceState({
    auxTree: [
      createAuxNode({ id: "dir_target", name: "设定", nodeType: "dir" }),
      createAuxNode({ id: "file_source", name: "notes.md" }),
    ],
  });
  const { actions, store } = renderActions(workspace);

  store.getState().setActiveTimelinePointId("timeline_1");
  await actions.handleAuxMove({ nodeId: "file_source", targetId: "dir_target" });

  expect(workspace.aux.moveAux.mutate).toHaveBeenCalledWith({
    workspaceId: "workspace_1",
    timelinePointId: "timeline_1",
    nodeId: "file_source",
    newParentDirId: "dir_target",
    newName: "notes.md",
  });
  expect(store.getState().expandedAuxIds.has("dir_target")).toBe(true);
});

test("handleAuxMove reports server errors on the source row anchor", async () => {
  const workspace = createWorkspaceState({
    auxTree: [
      createAuxNode({ id: "dir_target", name: "设定", nodeType: "dir" }),
      createAuxNode({ id: "file_source", name: "notes.md" }),
    ],
    moveMutate: mock(async () => {
      throw new Error("重名冲突");
    }),
  });
  const { actions, store } = renderActions(workspace);

  store.getState().setActiveTimelinePointId("timeline_1");
  await actions.handleAuxMove({ nodeId: "file_source", targetId: "dir_target" });

  expect(store.getState().auxError).toEqual({
    message: "重名冲突",
    anchorId: "aux:row:file_source",
  });
});
