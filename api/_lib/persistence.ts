import { createHash } from "node:crypto";

import { getDatabase } from "../../db/client.js";
import { queueRunArticles, queueRunBatches, queueRunSkips, queueRuns } from "../../db/schema.js";
import type {
  GenerateQueueResult,
  PublicConfig,
  QueueBatch,
  RaindropItem,
  SkippedArticle,
} from "./types.js";

interface PersistQueueRunInput {
  runId: string;
  generatedAt: string;
  config: PublicConfig;
  fetchedItems: RaindropItem[];
  batches: Array<QueueBatch & { html: string }>;
  skipped: SkippedArticle[];
  result: GenerateQueueResult;
}

const RUN_STATUS_SUCCEEDED = "succeeded";

export async function persistQueueRun(input: PersistQueueRunInput): Promise<void> {
  const db = getDatabase();

  if (!db) {
    return;
  }

  const generatedAt = new Date(input.generatedAt);
  const configHash = hashValue(input.config);
  const sourceSignature = hashValue(
    input.fetchedItems.map((item) => ({
      id: item.id,
      link: item.link,
      created: item.created ?? null,
    })),
  );

  await db.transaction(async (tx) => {
    await tx.insert(queueRuns).values({
      id: input.runId,
      status: RUN_STATUS_SUCCEEDED,
      generatedAt,
      configHash,
      sourceSignature,
      configJson: input.config,
      resultJson: input.result,
      fetchedCount: input.result.totals.fetched,
      extractedCount: input.result.totals.extracted,
      skippedCount: input.result.totals.skipped,
      batchCount: input.result.totals.batches,
      wordCount: input.result.totals.words,
      estimatedMinutes: input.result.totals.estimatedMinutes,
    });

    if (input.batches.length > 0) {
      await tx.insert(queueRunBatches).values(
        input.batches.map((batch) => ({
          runId: input.runId,
          batchIndex: batch.index,
          articleCount: batch.articleCount,
          wordCount: batch.wordCount,
          estimatedMinutes: Math.max(1, Math.round(batch.minutes)),
          html: batch.html,
        })),
      );

      await tx.insert(queueRunArticles).values(
        input.batches.flatMap((batch) =>
          batch.articles.map((article) => ({
            runId: input.runId,
            position: article.position,
            batchIndex: batch.index,
            raindropId: article.id,
            sourceUrl: article.sourceUrl,
            title: article.title,
            sourceCreatedAt: article.created ? new Date(article.created) : null,
            wordCount: article.wordCount,
            estimatedMinutes: Math.max(1, Math.round(article.minutes)),
            contentHash: hashText(article.content),
          })),
        ),
      );
    }

    if (input.skipped.length > 0) {
      await tx.insert(queueRunSkips).values(
        input.skipped.map((article, index) => ({
          runId: input.runId,
          skipIndex: index + 1,
          sourceUrl: article.url,
          title: article.title,
          reason: article.reason,
        })),
      );
    }
  });
}

function hashText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function hashValue(value: unknown): string {
  return hashText(stableStringify(value));
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, sortValue(nestedValue)]),
    );
  }

  return value;
}
