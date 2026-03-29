import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import type {
  GenerateQueueResult,
  PublicConfig,
  QueueRunError,
  QueueRunStatus,
} from "../api/_lib/types.js";

export const queueRuns = pgTable(
  "queue_runs",
  {
    id: text("id").primaryKey(),
    status: text("status").$type<QueueRunStatus>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    configHash: text("config_hash").notNull(),
    sourceSignature: text("source_signature"),
    configJson: jsonb("config_json").$type<PublicConfig>().notNull(),
    resultJson: jsonb("result_json").$type<GenerateQueueResult>(),
    errorJson: jsonb("error_json").$type<QueueRunError>(),
    fetchedCount: integer("fetched_count"),
    extractedCount: integer("extracted_count"),
    skippedCount: integer("skipped_count"),
    batchCount: integer("batch_count"),
    wordCount: integer("word_count"),
    estimatedMinutes: integer("estimated_minutes"),
  },
  (table) => [
    index("queue_runs_created_at_idx").on(table.createdAt),
    index("queue_runs_config_hash_idx").on(table.configHash),
    index("queue_runs_source_signature_idx").on(table.sourceSignature),
    index("queue_runs_status_idx").on(table.status),
  ],
);

export const queueRunBatches = pgTable(
  "queue_run_batches",
  {
    runId: text("run_id")
      .notNull()
      .references(() => queueRuns.id, { onDelete: "cascade" }),
    batchIndex: integer("batch_index").notNull(),
    articleCount: integer("article_count").notNull(),
    wordCount: integer("word_count").notNull(),
    estimatedMinutes: integer("estimated_minutes").notNull(),
    html: text("html").notNull(),
  },
  (table) => [
    primaryKey({
      name: "queue_run_batches_pk",
      columns: [table.runId, table.batchIndex],
    }),
  ],
);

export const queueRunArticles = pgTable(
  "queue_run_articles",
  {
    runId: text("run_id")
      .notNull()
      .references(() => queueRuns.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    batchIndex: integer("batch_index").notNull(),
    raindropId: bigint("raindrop_id", { mode: "number" }).notNull(),
    sourceUrl: text("source_url").notNull(),
    title: text("title").notNull(),
    sourceCreatedAt: timestamp("source_created_at", { withTimezone: true }),
    wordCount: integer("word_count").notNull(),
    estimatedMinutes: integer("estimated_minutes").notNull(),
    contentHash: text("content_hash").notNull(),
  },
  (table) => [
    primaryKey({
      name: "queue_run_articles_pk",
      columns: [table.runId, table.position],
    }),
    index("queue_run_articles_raindrop_id_idx").on(table.raindropId),
    index("queue_run_articles_source_url_idx").on(table.sourceUrl),
  ],
);

export const queueRunSkips = pgTable(
  "queue_run_skips",
  {
    runId: text("run_id")
      .notNull()
      .references(() => queueRuns.id, { onDelete: "cascade" }),
    skipIndex: integer("skip_index").notNull(),
    sourceUrl: text("source_url").notNull(),
    title: text("title").notNull(),
    reason: text("reason").notNull(),
  },
  (table) => [
    primaryKey({
      name: "queue_run_skips_pk",
      columns: [table.runId, table.skipIndex],
    }),
  ],
);
