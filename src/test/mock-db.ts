import { afterEach, beforeEach } from "bun:test";

import { cleanupTestDataDir, resetTestDataDir } from "./data-dir";

export function setupMockDatabase() {
  beforeEach(() => {
    resetTestDataDir();
  });

  afterEach(() => {
    cleanupTestDataDir();
  });
}
