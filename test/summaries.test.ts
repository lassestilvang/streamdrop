import assert from "node:assert/strict";
import test from "node:test";

import { maybeSummarizeArticles } from "../api/_lib/summaries.js";
import type { AppConfig, ExtractedArticle } from "../api/_lib/types.js";

function createConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    token: "token",
    collectionId: 0,
    processedCollectionId: null,
    includeSummaries: false,
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
    ...overrides,
  };
}

function createArticle(overrides: Partial<ExtractedArticle> = {}): ExtractedArticle {
  return {
    id: 1,
    title: "Example article",
    sourceUrl: "https://example.com/article",
    collectionId: 1,
    content: "A short article body for testing summaries.",
    wordCount: 7,
    minutes: 1,
    position: 0,
    ...overrides,
  };
}

test("maybeSummarizeArticles skips model calls when summaries are disabled", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;

  globalThis.fetch = (async () => {
    fetchCalled = true;
    throw new Error("fetch should not be called");
  }) as typeof fetch;

  try {
    const articles = [createArticle()];
    const result = await maybeSummarizeArticles(articles, createConfig(), {
      GEMINI_API_KEY: "key",
    });

    assert.equal(fetchCalled, false);
    assert.deepEqual(result, articles);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("maybeSummarizeArticles adds bounded summaries when Gemini returns text", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => {
    return new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: `Summary: ${"Long summary text ".repeat(20)}`,
                },
              ],
            },
          },
        ],
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
    const [result] = await maybeSummarizeArticles([createArticle()], createConfig({ includeSummaries: true }), {
      GEMINI_API_KEY: "key",
      GEMINI_MODEL: "gemini-3-flash-preview",
    });

    assert.ok(result?.summary);
    assert.ok(result.summary.length <= 240);
    assert.doesNotMatch(result.summary, /^summary:/i);
    assert.match(result.summary, /\.\.\.$/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("maybeSummarizeArticles keeps queue generation resilient when a summary request fails", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;

  globalThis.fetch = (async () => {
    calls += 1;

    if (calls === 1) {
      return new Response("bad", { status: 500 });
    }

    return new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [{ text: "A concise follow-up summary." }],
            },
          },
        ],
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
    const result = await maybeSummarizeArticles(
      [createArticle({ id: 1 }), createArticle({ id: 2, position: 1, title: "Second article" })],
      createConfig({ includeSummaries: true }),
      { GEMINI_API_KEY: "key" },
    );

    assert.equal(result[0]?.summary, undefined);
    assert.equal(result[1]?.summary, "A concise follow-up summary.");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
