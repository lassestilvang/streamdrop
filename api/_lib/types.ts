export interface AppConfig {
  token: string;
  collectionId: number;
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

export interface RaindropItem {
  id: number;
  title: string;
  link: string;
  created?: string;
  position?: number;
}

export interface ExtractedArticle {
  id: number;
  title: string;
  sourceUrl: string;
  created?: string;
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
}
