import { afterAll, mock } from "bun:test";

import { cleanupTestDataDir, resetTestDataDir } from "./data-dir";

resetTestDataDir();
afterAll(cleanupTestDataDir);

const { mockedDbModule } = await import("./mock-db");

mock.module("@/db", () => mockedDbModule);
