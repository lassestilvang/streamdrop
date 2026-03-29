import { randomUUID } from "node:crypto";

import { getPublicConfig, restoreConfig } from "./config.js";
import { extractArticles } from "./extract.js";
import {
  createQueuedRun,
  createRunningRun,
  getRunConfig,
  getRunRecord,
  markRunRunning,
  persistFailedRun,
  persistSucceededRun,
} from "./persistence.js";
import { createBatches, renderBatchHtml } from "./queue.js";
import { fetchRaindrops } from "./raindrop.js";
import { AppError } from "./errors.js";
import type { AppConfig, GenerateQueueResult, PublicConfig, QueueRunRecord } from "./types.js";

export async function generateQueue(config: AppConfig): Promise<GenerateQueueResult> {
  const runId = randomUUID();
  const publicConfig = getPublicConfig(config);

  await createRunningRun(runId, publicConfig);

  try {
    const result = await executeQueueRun(runId, config, publicConfig);
    return result;
  } catch (error) {
    await bestEffortPersistFailure(runId, error);
    throw error;
  }
}

export async function enqueueQueueRun(config: AppConfig): Promise<QueueRunRecord> {
  return createQueuedRun(getPublicConfig(config));
}

export async function processQueuedRun(runId: string): Promise<QueueRunRecord> {
  const storedConfig = await getRunConfig(runId);

  if (!storedConfig) {
    throw new AppError(404, "RUN_NOT_FOUND", "Run not found.");
  }

  await markRunRunning(runId);

  try {
    const config = restoreConfig(storedConfig);
    await executeQueueRun(runId, config, storedConfig);
  } catch (error) {
    await bestEffortPersistFailure(runId, error);
    throw error;
  }

  const run = await getRunRecord(runId);

  if (!run) {
    throw new AppError(500, "RUN_NOT_FOUND", "Processed run could not be reloaded.");
  }

  return run;
}

async function executeQueueRun(
  runId: string,
  config: AppConfig,
  publicConfig: PublicConfig,
): Promise<GenerateQueueResult> {
  const raindrops = await fetchRaindrops(config);
  const { extracted, skipped } = await extractArticles(raindrops, config);
  const generatedAt = new Date().toISOString();
  const batches = createBatches(extracted, config.maxWords, config.wordsPerMinute).map((batch) => ({
    ...batch,
    html: renderBatchHtml(batch),
  }));
  const totalWords = extracted.reduce((total, article) => total + article.wordCount, 0);
  const result: GenerateQueueResult = {
    runId,
    generatedAt,
    config: publicConfig,
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

  await persistSucceededRun({
    runId,
    generatedAt,
    config: publicConfig,
    fetchedItems: raindrops,
    batches,
    skipped,
    result,
  });

  return result;
}

async function bestEffortPersistFailure(runId: string, error: unknown): Promise<void> {
  try {
    await persistFailedRun(runId, error);
  } catch (persistenceError) {
    console.error("Failed to persist run failure", persistenceError);
  }
}
