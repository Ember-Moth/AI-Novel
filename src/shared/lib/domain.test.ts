import { expect, test } from "bun:test";

import { createId, createProjectId, createTimelineKey } from "./domain";

test("createId keeps the prefix and separator", () => {
  const id = createId("workspace");

  expect(id).toStartWith("workspace_");
  expect(id.slice("workspace_".length)).not.toHaveLength(0);
  expect(id.includes("-")).toBe(false);
});

test("createProjectId returns a bare nanoid", () => {
  const id = createProjectId();

  expect(id).not.toContain("_");
  expect(id).not.toHaveLength(0);
  expect(id.includes("-")).toBe(false);
});

test("createTimelineKey keeps the timeline prefix and fixed suffix length", () => {
  const key = createTimelineKey();

  expect(key).toStartWith("timeline_");
  expect(key).toHaveLength("timeline_".length + 10);
  expect(key.slice("timeline_".length)).toMatch(/^[a-z0-9]{10}$/);
});
