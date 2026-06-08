import { expect, test } from "bun:test";

import { resolveVisibleSnapshot } from "./visibleSnapshot";

test("resolveVisibleSnapshot returns undefined when there is no workspace cache", () => {
  const cache = new Map<string, { id: string }>();

  expect(resolveVisibleSnapshot(cache, "workspace_a", undefined)).toBeUndefined();
});

test("resolveVisibleSnapshot keeps the last successful snapshot during refresh", () => {
  const cache = new Map<string, { id: string }>();
  const snapshot = { id: "snapshot_a" };

  expect(resolveVisibleSnapshot(cache, "workspace_a", snapshot)).toBe(snapshot);
  expect(resolveVisibleSnapshot(cache, "workspace_a", undefined)).toBe(snapshot);
});

test("resolveVisibleSnapshot does not wipe cached data when the latest fetch is missing", () => {
  const cache = new Map<string, { id: string }>();
  const first = { id: "snapshot_a" };
  const next = { id: "snapshot_b" };

  resolveVisibleSnapshot(cache, "workspace_a", first);
  expect(resolveVisibleSnapshot(cache, "workspace_a", undefined)).toBe(first);
  expect(resolveVisibleSnapshot(cache, "workspace_a", next)).toBe(next);
  expect(resolveVisibleSnapshot(cache, "workspace_a", undefined)).toBe(next);
});
