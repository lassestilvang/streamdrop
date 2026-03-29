import { getPublicConfig } from "./config.js";
import { extractArticles } from "./extract.js";
import { createBatches, renderBatchHtml } from "./queue.js";
import { fetchRaindrops } from "./raindrop.js";
import type { AppConfig, GenerateQueueResult } from "./types.js";

export async function generateQueue(config: AppConfig): Promise<GenerateQueueResult> {
  const raindrops = await fetchRaindrops(config);
  const { extracted, skipped } = await extractArticles(raindrops, config);
  const batches = createBatches(extracted, config.maxWords, config.wordsPerMinute).map((batch) => ({
    ...batch,
    html: renderBatchHtml(batch),
  }));

  const totalWords = extracted.reduce((total, article) => total + article.wordCount, 0);

  return {
    generatedAt: new Date().toISOString(),
    config: getPublicConfig(config),
    totals: {
      fetched: raindrops.length,
      extracted: extracted.length,
      skipped: skipped.length,
      batches: batches.length,
      words: totalWords,
      estimatedMinutes: Math.round(totalWords / config.wordsPerMinute),
    },
    batches: batches.map((batch) => ({
      index: batch.index,
      articleCount: batch.articleCount,
      wordCount: batch.wordCount,
      estimatedMinutes: Math.round(batch.minutes),
      articles: batch.articles.map((article) => ({
        title: article.title,
        sourceUrl: article.sourceUrl,
        wordCount: article.wordCount,
        estimatedMinutes: Math.round(article.minutes),
      })),
      html: batch.html,
    })),
    skipped,
  };
}
