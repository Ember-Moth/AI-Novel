import { customAlphabet } from "nanoid";

const createEntityIdSuffix = customAlphabet(
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
  21,
);
const createTimelineKeySuffix = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 10);

export function createId(prefix: string) {
  return `${prefix}_${createEntityIdSuffix()}`;
}

export function createProjectId() {
  return createEntityIdSuffix();
}

export function createTimelineKey() {
  return `timeline_${createTimelineKeySuffix()}`;
}

export function now() {
  return Date.now();
}

export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
