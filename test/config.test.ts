import assert from "node:assert/strict";
import test from "node:test";

import { getPublicConfig, resolveConfig } from "../api/_lib/config.js";

test("resolveConfig requires the raindrop token", () => {
  assert.throws(
    () => resolveConfig("https://example.com/api/generate", {}),
    /RAINDROP_TOKEN/,
  );
});

test("resolveConfig reads defaults from the environment", () => {
  const config = resolveConfig("https://example.com/api/generate", {
    RAINDROP_TOKEN: "token",
  });

  assert.deepEqual(getPublicConfig(config), {
    collectionId: 0,
    search: "",
    sort: "-created",
    nested: true,
    maxArticles: 20,
    maxMinutes: 45,
    wordsPerMinute: 180,
    extractionConcurrency: 4,
    fetchTimeoutMs: 12000,
    maxHtmlBytes: 750000,
  });
});

test("resolveConfig allows safe query overrides", () => {
  const config = resolveConfig(
    "https://example.com/api/generate?maxArticles=12&maxMinutes=60&wordsPerMinute=200&nested=false&sort=title&search=tag%3Atts",
    {
      RAINDROP_TOKEN: "token",
      MAX_ARTICLES: "8",
    },
  );

  assert.equal(config.maxArticles, 12);
  assert.equal(config.maxMinutes, 60);
  assert.equal(config.wordsPerMinute, 200);
  assert.equal(config.nested, false);
  assert.equal(config.sort, "title");
  assert.equal(config.search, "tag:tts");
});

test("resolveConfig rejects unsupported sort values", () => {
  assert.throws(
    () =>
      resolveConfig("https://example.com/api/generate?sort=random", {
        RAINDROP_TOKEN: "token",
      }),
    /Unsupported sort value/,
  );
});
