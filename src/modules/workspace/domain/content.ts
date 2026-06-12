import { and, eq } from "drizzle-orm";

import { db, schema } from "@/db";

import {
  assertContentRoot,
  getContentNodeOrThrow,
  getWorkspaceOrThrow,
  touchWorkspace,
} from "./internal/access";
import {
  collectContentSubtreeIds,
  exportContentNode,
  getContentPrevSibling,
  listContentChildren,
  orderContentChildren,
} from "./internal/content-chain";
import { createId, invariant, now } from "@/shared/lib/domain";
import { pointIdOrOrigin, validateTimelinePointRef } from "./internal/timeline-point";
import type {
  ExportedContentSubtree,
  ManuscriptListNode,
  ManuscriptNodeList,
  ManuscriptNodeRead,
  TimelinePointRef,
} from "./types";

export function createContentNode(input: {
  workspaceId: string;
  parentId: string;
  afterSiblingId?: string | null;
  anchorPointId?: TimelinePointRef;
  title?: string | null;
  body?: string | null;
}) {
  return db.transaction((tx) => {
    const workspace = getWorkspaceOrThrow(tx, input.workspaceId);
    getContentNodeOrThrow(tx, workspace.id, input.parentId);
    const anchorTimelinePointId = validateTimelinePointRef(tx, workspace.id, input.anchorPointId);
    const timestamp = now();
    const nodeId = createId("content");

    if (input.afterSiblingId) {
      const previousSibling = getContentNodeOrThrow(tx, workspace.id, input.afterSiblingId);
      invariant(
        previousSibling.parentId === input.parentId,
        "无法创建章节：目标位置不在同一个父级下。",
      );

      tx.insert(schema.contentNodes)
        .values({
          id: nodeId,
          workspaceId: workspace.id,
          parentId: input.parentId,
          nextSiblingId: null,
          anchorTimelinePointId,
          title: input.title ?? null,
          body: input.body ?? null,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .run();

      tx.update(schema.contentNodes)
        .set({ nextSiblingId: nodeId, updatedAt: timestamp })
        .where(
          and(
            eq(schema.contentNodes.workspaceId, workspace.id),
            eq(schema.contentNodes.id, previousSibling.id),
          ),
        )
        .run();

      tx.update(schema.contentNodes)
        .set({ nextSiblingId: previousSibling.nextSiblingId, updatedAt: timestamp })
        .where(
          and(
            eq(schema.contentNodes.workspaceId, workspace.id),
            eq(schema.contentNodes.id, nodeId),
          ),
        )
        .run();
    } else {
      const head = orderContentChildren(listContentChildren(tx, workspace.id, input.parentId))[0];
      tx.insert(schema.contentNodes)
        .values({
          id: nodeId,
          workspaceId: workspace.id,
          parentId: input.parentId,
          nextSiblingId: head?.id ?? null,
          anchorTimelinePointId,
          title: input.title ?? null,
          body: input.body ?? null,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .run();
    }

    touchWorkspace(tx, workspace.id);
    return getContentNodeOrThrow(tx, workspace.id, nodeId);
  });
}

export function moveContentNode(input: {
  workspaceId: string;
  nodeId: string;
  newParentId: string;
  afterSiblingId?: string | null;
}) {
  return db.transaction((tx) => {
    const workspace = getWorkspaceOrThrow(tx, input.workspaceId);
    const contentRootId = assertContentRoot(workspace);
    const node = getContentNodeOrThrow(tx, workspace.id, input.nodeId);
    invariant(node.id !== contentRootId, "无法移动隐藏的正文根节点。");
    const newParent = getContentNodeOrThrow(tx, workspace.id, input.newParentId);
    const subtreeIds = collectContentSubtreeIds(tx, workspace.id, node.id);
    invariant(!subtreeIds.has(newParent.id), "无法移动：不能把章节移动到自己的子章节下。");
    if (input.afterSiblingId) {
      const previousSibling = getContentNodeOrThrow(tx, workspace.id, input.afterSiblingId);
      invariant(previousSibling.parentId === newParent.id, "无法移动：目标位置不在目标父级下。");
      invariant(previousSibling.id !== node.id, "无法移动：不能把章节移动到自己后面。");
    }

    const oldPrev = getContentPrevSibling(tx, workspace.id, node.id);
    const timestamp = now();

    tx.update(schema.contentNodes)
      .set({ nextSiblingId: null, updatedAt: timestamp })
      .where(
        and(eq(schema.contentNodes.workspaceId, workspace.id), eq(schema.contentNodes.id, node.id)),
      )
      .run();

    if (oldPrev) {
      tx.update(schema.contentNodes)
        .set({ nextSiblingId: node.nextSiblingId, updatedAt: timestamp })
        .where(
          and(
            eq(schema.contentNodes.workspaceId, workspace.id),
            eq(schema.contentNodes.id, oldPrev.id),
          ),
        )
        .run();
    }

    if (input.afterSiblingId) {
      const previousSibling = getContentNodeOrThrow(tx, workspace.id, input.afterSiblingId);
      const afterNext = previousSibling.nextSiblingId;
      tx.update(schema.contentNodes)
        .set({ nextSiblingId: node.id, updatedAt: timestamp })
        .where(
          and(
            eq(schema.contentNodes.workspaceId, workspace.id),
            eq(schema.contentNodes.id, previousSibling.id),
          ),
        )
        .run();

      tx.update(schema.contentNodes)
        .set({ parentId: newParent.id, nextSiblingId: afterNext, updatedAt: timestamp })
        .where(
          and(
            eq(schema.contentNodes.workspaceId, workspace.id),
            eq(schema.contentNodes.id, node.id),
          ),
        )
        .run();
    } else {
      const head = orderContentChildren(
        listContentChildren(tx, workspace.id, newParent.id).filter((child) => child.id !== node.id),
      )[0];
      tx.update(schema.contentNodes)
        .set({ parentId: newParent.id, nextSiblingId: head?.id ?? null, updatedAt: timestamp })
        .where(
          and(
            eq(schema.contentNodes.workspaceId, workspace.id),
            eq(schema.contentNodes.id, node.id),
          ),
        )
        .run();
    }

    touchWorkspace(tx, workspace.id);
    return getContentNodeOrThrow(tx, workspace.id, node.id);
  });
}

export function deleteContentNode(input: { workspaceId: string; nodeId: string }) {
  return db.transaction((tx) => {
    const workspace = getWorkspaceOrThrow(tx, input.workspaceId);
    const contentRootId = assertContentRoot(workspace);
    const node = getContentNodeOrThrow(tx, workspace.id, input.nodeId);
    invariant(node.id !== contentRootId, "无法删除隐藏的正文根节点。");

    const oldPrev = getContentPrevSibling(tx, workspace.id, node.id);
    const timestamp = now();

    if (oldPrev && node.nextSiblingId) {
      tx.update(schema.contentNodes)
        .set({ nextSiblingId: null, updatedAt: timestamp })
        .where(
          and(
            eq(schema.contentNodes.workspaceId, workspace.id),
            eq(schema.contentNodes.id, node.id),
          ),
        )
        .run();
    }

    if (oldPrev) {
      tx.update(schema.contentNodes)
        .set({ nextSiblingId: node.nextSiblingId, updatedAt: timestamp })
        .where(
          and(
            eq(schema.contentNodes.workspaceId, workspace.id),
            eq(schema.contentNodes.id, oldPrev.id),
          ),
        )
        .run();
    }

    tx.delete(schema.contentNodes)
      .where(
        and(eq(schema.contentNodes.workspaceId, workspace.id), eq(schema.contentNodes.id, node.id)),
      )
      .run();
    touchWorkspace(tx, workspace.id);
  });
}

export function updateContentNode(input: {
  workspaceId: string;
  nodeId: string;
  anchorPointId?: TimelinePointRef;
  title?: string | null;
  body?: string | null;
}) {
  return db.transaction((tx) => {
    const workspace = getWorkspaceOrThrow(tx, input.workspaceId);
    const node = getContentNodeOrThrow(tx, workspace.id, input.nodeId);
    const anchorTimelinePointId =
      input.anchorPointId === undefined
        ? node.anchorTimelinePointId
        : validateTimelinePointRef(tx, workspace.id, input.anchorPointId);

    tx.update(schema.contentNodes)
      .set({
        anchorTimelinePointId,
        title: input.title === undefined ? node.title : input.title,
        body: input.body === undefined ? node.body : input.body,
        updatedAt: now(),
      })
      .where(
        and(eq(schema.contentNodes.workspaceId, workspace.id), eq(schema.contentNodes.id, node.id)),
      )
      .run();

    touchWorkspace(tx, workspace.id);
    return getContentNodeOrThrow(tx, workspace.id, node.id);
  });
}

export function exportContentSubtree(workspaceId: string, rootNodeId?: string) {
  const workspace = getWorkspaceOrThrow(db, workspaceId);
  const contentRootId = assertContentRoot(workspace);
  const targetRootId = rootNodeId ?? contentRootId;
  const targetNode = getContentNodeOrThrow(db, workspace.id, targetRootId);
  if (targetRootId === contentRootId) {
    return {
      rootNodeId: targetRootId,
      isWorkspaceRoot: true,
      nodes: orderContentChildren(listContentChildren(db, workspace.id, targetRootId)).map(
        (child) => exportContentNode(db, workspace.id, child),
      ),
    } satisfies ExportedContentSubtree;
  }

  return {
    rootNodeId: targetRootId,
    isWorkspaceRoot: false,
    nodes: [exportContentNode(db, workspace.id, targetNode)],
  } satisfies ExportedContentSubtree;
}

function buildManuscriptListNode(
  workspaceId: string,
  node: ReturnType<typeof getContentNodeOrThrow>,
  remainingDepth: number,
): { node: ManuscriptListNode; truncated: boolean } {
  const children = orderContentChildren(listContentChildren(db, workspaceId, node.id));
  if (remainingDepth <= 1) {
    return {
      node: {
        id: node.id,
        anchorTimelinePointId: pointIdOrOrigin(node.anchorTimelinePointId),
        title: node.title,
        children: [],
        ...(children.length > 0 ? { hiddenChildrenCount: children.length } : {}),
      },
      truncated: children.length > 0,
    };
  }

  let truncated = false;
  const listedChildren = children.map((child) => {
    const listed = buildManuscriptListNode(workspaceId, child, remainingDepth - 1);
    if (listed.truncated) {
      truncated = true;
    }
    return listed.node;
  });

  return {
    node: {
      id: node.id,
      anchorTimelinePointId: pointIdOrOrigin(node.anchorTimelinePointId),
      title: node.title,
      children: listedChildren,
    },
    truncated,
  };
}

export function listManuscriptNodes(
  workspaceId: string,
  rootNodeId?: string,
  options: { depth?: number } = {},
): ManuscriptNodeList {
  const workspace = getWorkspaceOrThrow(db, workspaceId);
  const contentRootId = assertContentRoot(workspace);
  const targetRootId = rootNodeId ?? contentRootId;
  const targetNode = getContentNodeOrThrow(db, workspace.id, targetRootId);
  const depth = Math.max(1, Math.trunc(options.depth ?? 2));
  const roots =
    targetRootId === contentRootId
      ? orderContentChildren(listContentChildren(db, workspace.id, targetRootId))
      : [targetNode];
  let truncated = false;
  const nodes = roots.map((node) => {
    const listed = buildManuscriptListNode(workspace.id, node, depth);
    if (listed.truncated) {
      truncated = true;
    }
    return listed.node;
  });

  return {
    rootNodeId: targetRootId,
    isWorkspaceRoot: targetRootId === contentRootId,
    nodes,
    truncated,
  };
}

export function readManuscriptNode(workspaceId: string, nodeId: string): ManuscriptNodeRead {
  const workspace = getWorkspaceOrThrow(db, workspaceId);
  const node = getContentNodeOrThrow(db, workspace.id, nodeId);
  const children = orderContentChildren(listContentChildren(db, workspace.id, node.id)).map(
    (child) => buildManuscriptListNode(workspace.id, child, 1).node,
  );

  return {
    id: node.id,
    anchorTimelinePointId: pointIdOrOrigin(node.anchorTimelinePointId),
    title: node.title,
    body: node.body,
    children,
  };
}
