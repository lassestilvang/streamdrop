import assert from "node:assert/strict";
import test from "node:test";

import { createBatches, renderBatchHtml } from "../api/_lib/queue.js";

test("createBatches does not emit empty batches for oversized articles", () => {
  const batches = createBatches(
    [
      {
        id: 1,
        title: "Long read",
        sourceUrl: "https://example.com/long",
        content: "word ".repeat(250),
        wordCount: 250,
        minutes: 250 / 180,
        position: 0,
      },
      {
        id: 2,
        title: "Short read",
        sourceUrl: "https://example.com/short",
        content: "word ".repeat(50),
        wordCount: 50,
        minutes: 50 / 180,
        position: 1,
      },
    ],
    200,
  );

  assert.equal(batches.length, 2);
  assert.equal(batches[0]?.articleCount, 1);
  assert.equal(batches[1]?.articleCount, 1);
});

test("renderBatchHtml escapes article content and titles", () => {
  const [batch] = createBatches(
    [
      {
        id: 1,
        title: "<Unsafe>",
        sourceUrl: "https://example.com?q=<tag>",
        content: "Paragraph <script>alert(1)</script>",
        wordCount: 4,
        minutes: 1,
        position: 0,
      },
    ],
    200,
  );

  assert.ok(batch);

  const html = renderBatchHtml(batch);

  assert.match(html, /&lt;Unsafe&gt;/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test("renderBatchHtml omits spoken queue counts and article reading times", () => {
  const [batch] = createBatches(
    [
      {
        id: 1,
        title: "First title",
        sourceUrl: "https://www.example.com/first",
        content: "First paragraph.",
        wordCount: 2,
        minutes: 1,
        position: 0,
      },
      {
        id: 2,
        title: "Second title",
        sourceUrl: "https://example.org/second",
        content: "Second paragraph.",
        wordCount: 2,
        minutes: 1,
        position: 1,
      },
    ],
    200,
  );

  assert.ok(batch);

  const html = renderBatchHtml(batch);

  assert.doesNotMatch(html, /articles,\s*\d[\d,]* words,\s*about/i);
  assert.doesNotMatch(html, /Estimated reading time:/i);
  assert.match(html, /<h2>First title<\/h2>/);
  assert.doesNotMatch(html, /<h2>\s*1\.\s*First title<\/h2>/);
});

test("renderBatchHtml shows source links as bare domains", () => {
  const [batch] = createBatches(
    [
      {
        id: 1,
        title: "Domain test",
        sourceUrl: "https://www.example.com/path?q=1",
        content: "Content here.",
        wordCount: 2,
        minutes: 1,
        position: 0,
      },
    ],
    200,
  );

  assert.ok(batch);

  const html = renderBatchHtml(batch);

  assert.match(html, />example\.com<\/a>/);
  assert.doesNotMatch(html, />https:\/\/www\.example\.com\/path\?q=1<\/a>/);
});

test("renderBatchHtml marks Danish batches with lang metadata", () => {
  const [batch] = createBatches(
    [
      {
        id: 1,
        title: "Dansk artikel",
        sourceUrl: "https://example.dk/artikel",
        content: "Det er en artikel om dansk sprog og kultur.",
        wordCount: 9,
        minutes: 1,
        position: 0,
      },
    ],
    200,
  );

  assert.ok(batch);

  const html = renderBatchHtml(batch);

  assert.match(html, /<html lang="da">/);
  assert.match(html, /content="da"/);
});
