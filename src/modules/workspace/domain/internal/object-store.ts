import { eq } from "drizzle-orm";

import { type DatabaseExecutor, schema } from "@/db";

import { hashBlob, hashTreeObject } from "../hash";
import { now } from "@/shared/lib/domain";

export function putBlob(executor: DatabaseExecutor, content: string): string {
  const id = hashBlob(content);
  const existing = executor
    .select({ id: schema.blobs.id })
    .from(schema.blobs)
    .where(eq(schema.blobs.id, id))
    .get();
  if (!existing) {
    executor.insert(schema.blobs).values({ id, content, createdAt: now() }).run();
  }
  return id;
}

export function getBlob(executor: DatabaseExecutor, id: string): string | null {
  const row = executor
    .select({ content: schema.blobs.content })
    .from(schema.blobs)
    .where(eq(schema.blobs.id, id))
    .get();
  return row?.content ?? null;
}

type TreeObjectKind = "root" | "content" | "aux" | "timeline";

export function putTreeObject(
  executor: DatabaseExecutor,
  input: { projectId: string; kind: TreeObjectKind; payload: unknown },
): string {
  const payloadJson = JSON.stringify(input.payload);
  const id = hashTreeObject({ kind: input.kind, projectId: input.projectId, payloadJson });
  const existing = executor
    .select({ id: schema.treeObjects.id })
    .from(schema.treeObjects)
    .where(eq(schema.treeObjects.id, id))
    .get();
  if (!existing) {
    executor
      .insert(schema.treeObjects)
      .values({ id, projectId: input.projectId, kind: input.kind, payloadJson, createdAt: now() })
      .run();
  }
  return id;
}

export function getTreeObject<T = unknown>(
  executor: DatabaseExecutor,
  id: string,
): { kind: TreeObjectKind; payload: T } | null {
  const row = executor
    .select({ kind: schema.treeObjects.kind, payloadJson: schema.treeObjects.payloadJson })
    .from(schema.treeObjects)
    .where(eq(schema.treeObjects.id, id))
    .get();
  if (!row) {
    return null;
  }
  return { kind: row.kind as TreeObjectKind, payload: JSON.parse(row.payloadJson) as T };
}
