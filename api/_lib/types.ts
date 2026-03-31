export interface AppConfig {
  userId?: string;
  token: string;
  collectionId: number;
  processedCollectionId: number | null;
  includeSummaries: boolean;
  search: string;
  sort: string;
  nested: boolean;
  maxArticles: number;
  maxMinutes: number;
  wordsPerMinute: number;
  extractionConcurrency: number;
  fetchTimeoutMs: number;
  maxHtmlBytes: number;
  maxWords: number;
  perPage: number;
}

export interface PublicConfig {
  collectionId: number;
  includeSummaries: boolean;
  search: string;
  sort: string;
  nested: boolean;
  maxArticles: number;
  maxMinutes: number;
  wordsPerMinute: number;
  extractionConcurrency: number;
  fetchTimeoutMs: number;
  maxHtmlBytes: number;
}

export type QueueRunStatus = "queued" | "running" | "succeeded" | "failed";

export interface QueueRunError {
  code: string;
  message: string;
  details?: unknown;
}

export interface RaindropItem {
  id: number;
  title: string;
  link: string;
  collectionId: number;
  created?: string;
  position?: number;
}

export interface ExtractedArticle {
  id: number;
  title: string;
  sourceUrl: string;
  collectionId: number;
  created?: string;
  summary?: string;
  content: string;
  wordCount: number;
  minutes: number;
  position: number;
}

export interface SkippedArticle {
  url: string;
  title: string;
  reason: string;
}

export interface QueueArticleSummary {
  title: string;
  sourceUrl: string;
  summary?: string;
  wordCount: number;
  estimatedMinutes: number;
}

export interface QueueBatchArticle extends ExtractedArticle {}

export interface QueueBatch {
  index: number;
  articleCount: number;
  wordCount: number;
  minutes: number;
  articles: QueueBatchArticle[];
}

export interface QueueBatchResult {
  index: number;
  articleCount: number;
  wordCount: number;
  estimatedMinutes: number;
  articles: QueueArticleSummary[];
  html: string;
}

export interface ProcessedArticleMoveFailure {
  id: number;
  title: string;
  sourceCollectionId: number | null;
  error: string;
}

export interface ProcessedArticleMoveSummary {
  destinationCollectionId: number;
  attempted: number;
  moved: number;
  failed: number;
  failures: ProcessedArticleMoveFailure[];
}

export interface GenerateQueueResult {
  runId: string;
  generatedAt: string;
  config: PublicConfig;
  totals: {
    fetched: number;
    extracted: number;
    skipped: number;
    batches: number;
    words: number;
    estimatedMinutes: number;
  };
  batches: QueueBatchResult[];
  skipped: SkippedArticle[];
  processed: ProcessedArticleMoveSummary | null;
}

export interface QueueRunRecord {
  id: string;
  status: QueueRunStatus;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  generatedAt: string | null;
  config: PublicConfig;
  totals:
    | {
        fetched: number;
        extracted: number;
        skipped: number;
        batches: number;
        words: number;
        estimatedMinutes: number;
      }
    | null;
  error: QueueRunError | null;
  result: GenerateQueueResult | null;
}

export interface QueueRunSummaryRecord extends Omit<QueueRunRecord, "result"> {
  result: null;
}
