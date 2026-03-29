import assert from "node:assert/strict";
import test from "node:test";

import { parseRunIdFromPath, readBatchIndex } from "../api/_lib/routes.js";

test("parseRunIdFromPath reads the dynamic run id segment", () => {
  assert.equal(
    parseRunIdFromPath("https://example.com/api/runs/run-123/process"),
    "run-123",
  );
});

test("readBatchIndex requires a positive integer batch parameter", () => {
  assert.equal(readBatchIndex("https://example.com/api/queue/latest/html?batch=2"), 2);

  assert.throws(
    () => readBatchIndex("https://example.com/api/queue/latest/html"),
    /batch is required/,
  );

  assert.throws(
    () => readBatchIndex("https://example.com/api/queue/latest/html?batch=0"),
    /positive integer/,
  );
});
