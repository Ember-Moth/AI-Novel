import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let currentDataDir: string | null = null;

export function resetTestDataDir() {
  if (currentDataDir) {
    rmSync(currentDataDir, { recursive: true, force: true });
  }

  currentDataDir = mkdtempSync(join(tmpdir(), "novel-evolver-test-"));
  process.env.NOVEL_EVOLVER_DATA_DIR = currentDataDir;
  return currentDataDir;
}

export function cleanupTestDataDir() {
  if (!currentDataDir) return;

  rmSync(currentDataDir, { recursive: true, force: true });
  if (process.env.NOVEL_EVOLVER_DATA_DIR === currentDataDir) {
    delete process.env.NOVEL_EVOLVER_DATA_DIR;
  }
  currentDataDir = null;
}
