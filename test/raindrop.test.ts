import assert from "node:assert/strict";
import test from "node:test";

import { fetchRaindrops, moveProcessedRaindrops } from "../api/_lib/raindrop.js";

test("fetchRaindrops normalizes tag shorthand before calling Raindrop", async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];

  globalThis.fetch = (async (url) => {
    calls.push(String(url));

    return new Response(
      JSON.stringify({
        items: [],
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
        },
      },
    );
  }) as typeof fetch;

  try {
    await fetchRaindrops({
      token: "token",
      collectionId: 42,
      processedCollectionId: null,
      search: 'tag:tts -tag:"long reads"',
      sort: "-created",
      nested: true,
      maxArticles: 20,
      maxMinutes: 45,
      wordsPerMinute: 180,
      extractionConcurrency: 4,
      fetchTimeoutMs: 12000,
      maxHtmlBytes: 750000,
      maxWords: 8100,
      perPage: 20,
    });

    assert.equal(calls.length, 1);
    const firstCall = calls[0];

    if (!firstCall) {
      throw new Error("Expected a Raindrop request to be recorded.");
    }

    const url = new URL(firstCall);
    assert.equal(url.pathname, "/rest/v1/raindrops/42");
    assert.equal(url.searchParams.get("search"), '#tts -#"long reads"');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("moveProcessedRaindrops groups articles by source collection and reports successes", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; body: unknown }> = [];

  globalThis.fetch = (async (url, init) => {
    calls.push({
      url: String(url),
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });

    return new Response(
      JSON.stringify({
        result: true,
        modified: 2,
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
        },
      },
    );
  }) as typeof fetch;

  try {
    const summary = await moveProcessedRaindrops(
      [
        {
          id: 1,
          title: "One",
          sourceUrl: "https://example.com/one",
          collectionId: 10,
          content: "One",
          wordCount: 1,
          minutes: 1,
          position: 0,
        },
        {
          id: 2,
          title: "Two",
          sourceUrl: "https://example.com/two",
          collectionId: 10,
          content: "Two",
          wordCount: 1,
          minutes: 1,
          position: 1,
        },
        {
          id: 3,
          title: "Three",
          sourceUrl: "https://example.com/three",
          collectionId: 12,
          content: "Three",
          wordCount: 1,
          minutes: 1,
          position: 2,
        },
      ],
      {
        token: "token",
        collectionId: 0,
        processedCollectionId: 99,
        search: "",
        sort: "-created",
        nested: true,
        maxArticles: 20,
        maxMinutes: 45,
        wordsPerMinute: 180,
        extractionConcurrency: 4,
        fetchTimeoutMs: 12000,
        maxHtmlBytes: 750000,
        maxWords: 8100,
        perPage: 20,
      },
    );

    assert.ok(summary);
    assert.equal(summary.destinationCollectionId, 99);
    assert.equal(summary.attempted, 3);
    assert.equal(summary.moved, 3);
    assert.equal(summary.failed, 0);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls.map((call) => call.url).sort(), [
      "https://api.raindrop.io/rest/v1/raindrops/10",
      "https://api.raindrop.io/rest/v1/raindrops/12",
    ]);
    assert.deepEqual(calls[0]?.body, {
      ids: [1, 2],
      collection: {
        $id: 99,
      },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("moveProcessedRaindrops records failures when Raindrop move requests fail", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => {
    return new Response(
      JSON.stringify({
        error: "bad",
      }),
      {
        status: 500,
        headers: {
          "content-type": "application/json; charset=utf-8",
        },
      },
    );
  }) as typeof fetch;

  try {
    const summary = await moveProcessedRaindrops(
      [
        {
          id: 7,
          title: "Broken move",
          sourceUrl: "https://example.com/broken",
          collectionId: 44,
          content: "Broken",
          wordCount: 1,
          minutes: 1,
          position: 0,
        },
      ],
      {
        token: "token",
        collectionId: 44,
        processedCollectionId: 99,
        search: "",
        sort: "-created",
        nested: true,
        maxArticles: 20,
        maxMinutes: 45,
        wordsPerMinute: 180,
        extractionConcurrency: 4,
        fetchTimeoutMs: 12000,
        maxHtmlBytes: 750000,
        maxWords: 8100,
        perPage: 20,
      },
    );

    assert.ok(summary);
    assert.equal(summary.moved, 0);
    assert.equal(summary.failed, 1);
    assert.match(summary.failures[0]?.error || "", /Raindrop returned an unexpected response/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
