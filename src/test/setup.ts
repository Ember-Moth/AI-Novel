import { beforeEach } from "bun:test";

import { resetTestDataDir } from "./data-dir";

export function setupTestDataDir() {
  beforeEach(() => {
    resetTestDataDir();
  });
}
