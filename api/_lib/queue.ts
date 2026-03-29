import type { ExtractedArticle, QueueBatch } from "./types.js";

export function createBatches(
  articles: ExtractedArticle[],
  maxWords: number,
  wordsPerMinute = 180,
): QueueBatch[] {
  const batches: Omit<QueueBatch, "index">[] = [];
  let currentBatch: ExtractedArticle[] = [];
  let currentWords = 0;

  for (const article of articles) {
    const articleWords = article.wordCount;

    if (currentBatch.length > 0 && currentWords + articleWords > maxWords) {
      batches.push(finalizeBatch(currentBatch, wordsPerMinute));
      currentBatch = [];
      currentWords = 0;
    }

    currentBatch.push(article);
    currentWords += articleWords;

    if (currentBatch.length === 1 && articleWords >= maxWords) {
      batches.push(finalizeBatch(currentBatch, wordsPerMinute));
      currentBatch = [];
      currentWords = 0;
    }
  }

  if (currentBatch.length > 0) {
    batches.push(finalizeBatch(currentBatch, wordsPerMinute));
  }

  return batches.map((batch, index) => ({
    ...batch,
    index: index + 1,
  }));
}

export function renderBatchHtml(batch: QueueBatch): string {
  const articleCountLabel = batch.articleCount === 1 ? "article" : "articles";
  let body = "";

  for (const [index, article] of batch.articles.entries()) {
    const paragraphs = article.content
      .split(/\n{2,}/)
      .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
      .join("\n");

    body += `
      <section class="article">
        <div class="separator">Next article</div>
        <h2>${index + 1}. ${escapeHtml(article.title)}</h2>
        <p class="meta">
          Estimated reading time: ${formatMinutes(article.minutes)}
          <br />
          Source: <a href="${escapeAttribute(article.sourceUrl)}">${escapeHtml(article.sourceUrl)}</a>
        </p>
        ${paragraphs}
      </section>
    `;
  }

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Listening Queue ${batch.index}</title>
    <style>
      :root {
        color-scheme: light;
      }
      body {
        margin: 0 auto;
        max-width: 860px;
        padding: 32px 20px 56px;
        font-family: Georgia, "Times New Roman", serif;
        line-height: 1.7;
        color: #1e1e1e;
        background: #fcfbf7;
      }
      h1, h2 {
        line-height: 1.2;
        font-family: "Iowan Old Style", "Palatino Linotype", serif;
      }
      .summary, .meta {
        color: #4f4a45;
      }
      .separator {
        margin: 36px 0 16px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 12px;
        color: #7f7568;
      }
      .article + .article {
        border-top: 1px solid #d9d2c7;
        padding-top: 28px;
      }
      a {
        color: #805a1c;
      }
    </style>
  </head>
  <body>
    <header>
      <h1>Listening Queue ${batch.index}</h1>
      <p class="summary">
        ${batch.articleCount} ${articleCountLabel},
        ${batch.wordCount.toLocaleString()} words,
        about ${formatMinutes(batch.minutes)}.
      </p>
    </header>
    ${body}
  </body>
</html>`;
}

function finalizeBatch(
  articles: ExtractedArticle[],
  wordsPerMinute: number,
): Omit<QueueBatch, "index"> {
  const decoratedArticles = articles.map((article) => ({
    ...article,
    minutes: article.minutes ?? article.wordCount / wordsPerMinute,
  }));

  const wordCount = decoratedArticles.reduce((total, article) => total + article.wordCount, 0);
  const minutes = decoratedArticles.reduce((total, article) => total + article.minutes, 0);

  return {
    articleCount: decoratedArticles.length,
    wordCount,
    minutes,
    articles: decoratedArticles,
  };
}

function formatMinutes(minutes: number): string {
  return `${Math.max(1, Math.round(minutes))} min`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}
