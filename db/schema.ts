import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import type {
  GenerateQueueResult,
  PublicConfig,
  QueueRunError,
  QueueRunStatus,
} from "../api/_lib/types.js";

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("users_username_idx").on(table.username)],
);

export const userSessions = pgTable(
  "user_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_sessions_token_hash_idx").on(table.tokenHash),
    index("user_sessions_user_id_idx").on(table.userId),
    index("user_sessions_expires_at_idx").on(table.expiresAt),
  ],
);

export const userSettings = pgTable(
  "user_settings",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    raindropToken: text("raindrop_token"),
    collectionId: integer("collection_id").notNull().default(0),
    processedCollectionId: integer("processed_collection_id"),
    search: text("search").notNull().default(""),
    sort: text("sort").notNull().default("-created"),
    nested: boolean("nested").notNull().default(true),
    maxArticles: integer("max_articles").notNull().default(20),
    maxMinutes: integer("max_minutes").notNull().default(45),
    wordsPerMinute: integer("words_per_minute").notNull().default(180),
    extractionConcurrency: integer("extraction_concurrency").notNull().default(4),
    fetchTimeoutMs: integer("fetch_timeout_ms").notNull().default(12000),
    maxHtmlBytes: integer("max_html_bytes").notNull().default(750000),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("user_settings_collection_id_idx").on(table.collectionId)],
);

export const queueRuns = pgTable(
  "queue_runs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
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
    index("queue_runs_user_id_idx").on(table.userId),
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
