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
  persistProcessedMoveResult,
  persistSucceededRun,
} from "./persistence.js";
import { createBatches, renderBatchHtml } from "./queue.js";
import { fetchRaindrops, moveProcessedRaindrops } from "./raindrop.js";
import { maybeSummarizeArticles } from "./summaries.js";
import { AppError } from "./errors.js";
import type {
  AppConfig,
  GenerateQueueResult,
  ProcessedArticleMoveSummary,
  PublicConfig,
  QueueRunRecord,
} from "./types.js";

export async function generateQueue(config: AppConfig): Promise<GenerateQueueResult> {
  const runId = randomUUID();
  const publicConfig = getPublicConfig(config);

  await createRunningRun(runId, publicConfig, config.userId);

  try {
    const result = await executeQueueRun(runId, config, publicConfig);
    return result;
  } catch (error) {
    await bestEffortPersistFailure(runId, error);
    throw error;
  }
}

export async function enqueueQueueRun(config: AppConfig): Promise<QueueRunRecord> {
  return createQueuedRun(getPublicConfig(config), config.userId);
}

export async function processQueuedRun(runId: string, userId?: string): Promise<QueueRunRecord> {
  const storedConfig = await getRunConfig(runId, userId);

  if (!storedConfig) {
    throw new AppError(404, "RUN_NOT_FOUND", "Run not found.");
  }

  await markRunRunning(runId, userId);

  try {
    const config = restoreConfig(storedConfig, process.env, userId);
    await executeQueueRun(runId, config, storedConfig);
  } catch (error) {
    await bestEffortPersistFailure(runId, error);
    throw error;
  }

  const run = await getRunRecord(runId, userId);

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
  const summarizedArticles = await bestEffortSummarizeArticles(extracted, config);
  const generatedAt = new Date().toISOString();
  const batches = createBatches(summarizedArticles, config.maxWords, config.wordsPerMinute).map(
    (batch) => ({
      ...batch,
      html: renderBatchHtml(batch),
    }),
  );
  const totalWords = summarizedArticles.reduce((total, article) => total + article.wordCount, 0);
  const result: GenerateQueueResult = {
    runId,
    generatedAt,
    config: publicConfig,
    totals: {
      fetched: raindrops.length,
      extracted: summarizedArticles.length,
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
        ...(article.summary ? { summary: article.summary } : {}),
        wordCount: article.wordCount,
        estimatedMinutes: Math.round(article.minutes),
      })),
      html: batch.html,
    })),
    skipped,
    processed: null,
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

  if (config.processedCollectionId) {
    const processed = await moveProcessedRaindropsSafely(summarizedArticles, config);
    result.processed = processed;

    if (processed) {
      await bestEffortPersistProcessedMoveResult(runId, processed);
    }
  }

  return result;
}

async function bestEffortSummarizeArticles(
  extracted: Parameters<typeof maybeSummarizeArticles>[0],
  config: AppConfig,
): Promise<Parameters<typeof maybeSummarizeArticles>[0]> {
  try {
    return await maybeSummarizeArticles(extracted, config);
  } catch {
    return extracted;
  }
}

async function bestEffortPersistFailure(runId: string, error: unknown): Promise<void> {
  try {
    await persistFailedRun(runId, error);
  } catch (persistenceError) {
    console.error("Failed to persist run failure", persistenceError);
  }
}

async function bestEffortPersistProcessedMoveResult(
  runId: string,
  processed: ProcessedArticleMoveSummary,
): Promise<void> {
  try {
    await persistProcessedMoveResult(runId, processed);
  } catch (persistenceError) {
    console.error("Failed to persist processed move result", persistenceError);
  }
}

async function moveProcessedRaindropsSafely(
  extracted: Parameters<typeof moveProcessedRaindrops>[0],
  config: AppConfig,
): Promise<ProcessedArticleMoveSummary | null> {
  try {
    return await moveProcessedRaindrops(extracted, config);
  } catch (error) {
    if (!config.processedCollectionId || extracted.length === 0) {
      return null;
    }

    return {
      destinationCollectionId: config.processedCollectionId,
      attempted: extracted.length,
      moved: 0,
      failed: extracted.length,
      failures: extracted.map((article) => ({
        id: article.id,
        title: article.title,
        sourceCollectionId: article.collectionId,
        error: error instanceof Error ? error.message : "Unexpected move failure",
      })),
    };
  }
}
