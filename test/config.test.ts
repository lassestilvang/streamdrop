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
  assert.equal(config.processedCollectionId, null);
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

test("resolveConfig accepts quoted tag shorthand in search filters", () => {
  const config = resolveConfig(
    "https://example.com/api/generate?search=tag%3A%22machine%20learning%22%20-tag%3Aarchive",
    {
      RAINDROP_TOKEN: "token",
    },
  );

  assert.equal(config.search, 'tag:"machine learning" -tag:archive');
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

test("resolveConfig rejects malformed tag shorthand", () => {
  assert.throws(
    () =>
      resolveConfig("https://example.com/api/generate?search=tag%3A", {
        RAINDROP_TOKEN: "token",
      }),
    /invalid tag filter/i,
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

test("resolveConfig reads the optional processed collection id from the environment", () => {
  const config = resolveConfig("https://example.com/api/generate", {
    RAINDROP_TOKEN: "token",
    RAINDROP_PROCESSED_COLLECTION_ID: "77",
  });

  assert.equal(config.processedCollectionId, 77);
});
