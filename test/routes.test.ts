import assert from "node:assert/strict";
import test from "node:test";

import { parseRunIdFromPath, readBatchIndex, readLimit } from "../api/_lib/routes.js";

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

test("readLimit uses a bounded integer query parameter", () => {
  assert.equal(readLimit("https://example.com/api/runs?limit=8"), 8);
  assert.equal(readLimit("https://example.com/api/runs"), 12);

  assert.throws(
    () => readLimit("https://example.com/api/runs?limit=0"),
    /between 1 and 50/,
  );
});
