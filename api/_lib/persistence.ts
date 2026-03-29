import { createHash, randomUUID } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";

import { getDatabase } from "../../db/client.js";
import { queueRunArticles, queueRunBatches, queueRunSkips, queueRuns } from "../../db/schema.js";
import { AppError, isAppError } from "./errors.js";
import type {
  GenerateQueueResult,
  PublicConfig,
  QueueBatch,
  QueueRunError,
  QueueRunRecord,
  QueueRunStatus,
  RaindropItem,
  SkippedArticle,
} from "./types.js";

interface PersistSucceededRunInput {
  runId: string;
  generatedAt: string;
  config: PublicConfig;
  fetchedItems: RaindropItem[];
  batches: Array<QueueBatch & { html: string }>;
  skipped: SkippedArticle[];
  result: GenerateQueueResult;
}

const STATUS_QUEUED: QueueRunStatus = "queued";
const STATUS_RUNNING: QueueRunStatus = "running";
const STATUS_SUCCEEDED: QueueRunStatus = "succeeded";
const STATUS_FAILED: QueueRunStatus = "failed";

export async function createQueuedRun(config: PublicConfig): Promise<QueueRunRecord> {
  const db = requireDatabase();
  const id = randomUUID();

  await db.insert(queueRuns).values({
    id,
    status: STATUS_QUEUED,
    configHash: hashConfig(config),
    configJson: config,
  });

  const run = await getRunRecord(id);

  if (!run) {
    throw new AppError(500, "RUN_CREATE_FAILED", "Queued run was not persisted.");
  }

  return run;
}

export async function createRunningRun(id: string, config: PublicConfig): Promise<void> {
  const db = getDatabase();

  if (!db) {
    return;
  }

  const now = new Date();

  await db.insert(queueRuns).values({
    id,
    status: STATUS_RUNNING,
    startedAt: now,
    configHash: hashConfig(config),
    configJson: config,
  });
}

export async function markRunRunning(runId: string): Promise<void> {
  const db = requireDatabase();
  const [run] = await db
    .select({
      id: queueRuns.id,
      status: queueRuns.status,
    })
    .from(queueRuns)
    .where(eq(queueRuns.id, runId))
    .limit(1);

  if (!run) {
    throw new AppError(404, "RUN_NOT_FOUND", "Run not found.");
  }

  if (run.status === STATUS_SUCCEEDED) {
    throw new AppError(409, "RUN_ALREADY_COMPLETED", "Run has already completed successfully.");
  }

  if (run.status === STATUS_RUNNING) {
    throw new AppError(409, "RUN_ALREADY_RUNNING", "Run is already running.");
  }

  await db
    .update(queueRuns)
    .set({
      status: STATUS_RUNNING,
      startedAt: new Date(),
      completedAt: null,
      generatedAt: null,
      sourceSignature: null,
      resultJson: null,
      errorJson: null,
      fetchedCount: null,
      extractedCount: null,
      skippedCount: null,
      batchCount: null,
      wordCount: null,
      estimatedMinutes: null,
    })
    .where(eq(queueRuns.id, runId));
}

export async function persistSucceededRun(input: PersistSucceededRunInput): Promise<void> {
  const db = getDatabase();

  if (!db) {
    return;
  }

  const generatedAt = new Date(input.generatedAt);
  const configHash = hashConfig(input.config);
  const sourceSignature = hashSourceSignature(input.fetchedItems);

  await db.transaction(async (tx) => {
    await tx
      .update(queueRuns)
      .set({
        status: STATUS_SUCCEEDED,
        completedAt: generatedAt,
        generatedAt,
        configHash,
        sourceSignature,
        configJson: input.config,
        resultJson: input.result,
        errorJson: null,
        fetchedCount: input.result.totals.fetched,
        extractedCount: input.result.totals.extracted,
        skippedCount: input.result.totals.skipped,
        batchCount: input.result.totals.batches,
        wordCount: input.result.totals.words,
        estimatedMinutes: input.result.totals.estimatedMinutes,
      })
      .where(eq(queueRuns.id, input.runId));

    await clearRunArtifacts(tx, input.runId);

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

export async function persistFailedRun(runId: string, error: unknown): Promise<void> {
  const db = getDatabase();

  if (!db) {
    return;
  }

  await db
    .update(queueRuns)
    .set({
      status: STATUS_FAILED,
      completedAt: new Date(),
      generatedAt: null,
      sourceSignature: null,
      resultJson: null,
      errorJson: normalizeRunError(error),
      fetchedCount: null,
      extractedCount: null,
      skippedCount: null,
      batchCount: null,
      wordCount: null,
      estimatedMinutes: null,
    })
    .where(eq(queueRuns.id, runId));
}

export async function getRunRecord(runId: string): Promise<QueueRunRecord | null> {
  const db = requireDatabase();
  const [row] = await db
    .select()
    .from(queueRuns)
    .where(eq(queueRuns.id, runId))
    .limit(1);

  return row ? mapRunRecord(row) : null;
}

export async function getLatestSucceededRun(config: PublicConfig): Promise<QueueRunRecord | null> {
  const db = requireDatabase();
  const [row] = await db
    .select()
    .from(queueRuns)
    .where(and(eq(queueRuns.configHash, hashConfig(config)), eq(queueRuns.status, STATUS_SUCCEEDED)))
    .orderBy(desc(queueRuns.createdAt))
    .limit(1);

  return row ? mapRunRecord(row) : null;
}

export async function getRunBatchHtml(runId: string, batchIndex: number): Promise<string | null> {
  const db = requireDatabase();
  const [row] = await db
    .select({
      html: queueRunBatches.html,
    })
    .from(queueRunBatches)
    .where(and(eq(queueRunBatches.runId, runId), eq(queueRunBatches.batchIndex, batchIndex)))
    .limit(1);

  return row?.html ?? null;
}

export async function getLatestSucceededBatchHtml(
  config: PublicConfig,
  batchIndex: number,
): Promise<{ runId: string; html: string } | null> {
  const run = await getLatestSucceededRun(config);

  if (!run) {
    return null;
  }

  const html = await getRunBatchHtml(run.id, batchIndex);

  if (!html) {
    return null;
  }

  return {
    runId: run.id,
    html,
  };
}

export async function getRunConfig(runId: string): Promise<PublicConfig | null> {
  const db = requireDatabase();
  const [row] = await db
    .select({
      configJson: queueRuns.configJson,
    })
    .from(queueRuns)
    .where(eq(queueRuns.id, runId))
    .limit(1);

  return row?.configJson ?? null;
}

async function clearRunArtifacts(
  tx: NonNullable<ReturnType<typeof getDatabase>>["transaction"] extends (
    callback: (trx: infer T) => Promise<unknown>,
  ) => Promise<unknown>
    ? T
    : never,
  runId: string,
): Promise<void> {
  await tx.delete(queueRunArticles).where(eq(queueRunArticles.runId, runId));
  await tx.delete(queueRunBatches).where(eq(queueRunBatches.runId, runId));
  await tx.delete(queueRunSkips).where(eq(queueRunSkips.runId, runId));
}

function mapRunRecord(row: typeof queueRuns.$inferSelect): QueueRunRecord {
  const totals =
    row.fetchedCount !== null &&
    row.extractedCount !== null &&
    row.skippedCount !== null &&
    row.batchCount !== null &&
    row.wordCount !== null &&
    row.estimatedMinutes !== null
      ? {
          fetched: row.fetchedCount,
          extracted: row.extractedCount,
          skipped: row.skippedCount,
          batches: row.batchCount,
          words: row.wordCount,
          estimatedMinutes: row.estimatedMinutes,
        }
      : null;

  return {
    id: row.id,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    generatedAt: row.generatedAt ? row.generatedAt.toISOString() : null,
    config: row.configJson,
    totals,
    error: row.errorJson ?? null,
    result: row.resultJson ?? null,
  };
}

function normalizeRunError(error: unknown): QueueRunError {
  if (isAppError(error)) {
    return {
      code: error.code,
      message: error.message,
      ...(error.details !== undefined ? { details: error.details } : {}),
    };
  }

  if (error instanceof Error) {
    return {
      code: "INTERNAL_ERROR",
      message: error.message,
    };
  }

  return {
    code: "INTERNAL_ERROR",
    message: "Unexpected error while processing the run.",
  };
}

function requireDatabase() {
  const db = getDatabase();

  if (!db) {
    throw new AppError(
      500,
      "DATABASE_NOT_CONFIGURED",
      "DATABASE_URL is required for persisted queue operations.",
    );
  }

  return db;
}

function hashConfig(config: PublicConfig): string {
  return hashValue(config);
}

function hashSourceSignature(items: RaindropItem[]): string {
  return hashValue(
    items.map((item) => ({
      id: item.id,
      link: item.link,
      created: item.created ?? null,
    })),
  );
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
