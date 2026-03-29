import assert from "node:assert/strict";
import test from "node:test";

import { createPublicBatchToken, verifyPublicBatchToken } from "../api/_lib/public-html.js";

const ENV = {
  HTML_LINK_SIGNING_SECRET: "share-secret",
  HTML_LINK_TTL_SECONDS: "3600",
};

test("public batch tokens verify for the intended run and batch", () => {
  const { expiresAt, token } = createPublicBatchToken("run-123", 2, ENV);

  assert.equal(verifyPublicBatchToken("run-123", 2, expiresAt, token, ENV), true);
  assert.equal(verifyPublicBatchToken("run-123", 3, expiresAt, token, ENV), false);
  assert.equal(verifyPublicBatchToken("other-run", 2, expiresAt, token, ENV), false);
});

test("public batch tokens reject expired timestamps", () => {
  const expired = new Date(Date.now() - 60_000).toISOString();
  const { token } = createPublicBatchToken("run-123", 2, ENV);

  assert.equal(verifyPublicBatchToken("run-123", 2, expired, token, ENV), false);
});
