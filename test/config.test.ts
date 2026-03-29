import assert from "node:assert/strict";
import test from "node:test";

import { getPublicConfig, resolveConfig, restoreConfig } from "../api/_lib/config.js";

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

test("restoreConfig rebuilds derived fields from a stored public config", () => {
  const config = restoreConfig(
    {
      collectionId: 42,
      search: "tag:tts",
      sort: "title",
      nested: false,
      maxArticles: 12,
      maxMinutes: 60,
      wordsPerMinute: 200,
      extractionConcurrency: 3,
      fetchTimeoutMs: 9000,
      maxHtmlBytes: 500000,
    },
    {
      RAINDROP_TOKEN: "token",
    },
  );

  assert.equal(config.token, "token");
  assert.equal(config.maxWords, 12000);
  assert.equal(config.perPage, 12);
  assert.equal(config.collectionId, 42);
  assert.equal(config.search, "tag:tts");
  assert.equal(config.sort, "title");
  assert.equal(config.nested, false);
});
