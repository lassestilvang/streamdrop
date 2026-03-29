import { AppError } from "./errors.js";
import type { AppConfig, PublicConfig } from "./types.js";

const DEFAULTS = {
  collectionId: 0,
  search: "",
  sort: "-created",
  nested: true,
  maxArticles: 20,
  maxMinutes: 45,
  wordsPerMinute: 180,
  extractionConcurrency: 4,
  fetchTimeoutMs: 12000,
  maxHtmlBytes: 750000,
} as const;

const LIMITS = {
  maxArticles: { min: 1, max: 100 },
  maxMinutes: { min: 5, max: 240 },
  wordsPerMinute: { min: 80, max: 320 },
  extractionConcurrency: { min: 1, max: 8 },
  fetchTimeoutMs: { min: 1000, max: 30000 },
  maxHtmlBytes: { min: 100000, max: 2000000 },
} as const;

const ALLOWED_SORTS = new Set([
  "-created",
  "created",
  "score",
  "-sort",
  "title",
  "-title",
  "domain",
  "-domain",
]);

export function resolveConfig(requestUrl: string, env: NodeJS.ProcessEnv = process.env): AppConfig {
  const url = new URL(requestUrl);

  const token = readRequiredString(env.RAINDROP_TOKEN, "RAINDROP_TOKEN");

  const config: AppConfig = {
    token,
    collectionId: readInteger(
      url.searchParams.get("collectionId"),
      env.RAINDROP_COLLECTION_ID,
      DEFAULTS.collectionId,
      "collectionId",
    ),
    search: readString(url.searchParams.get("search"), env.RAINDROP_SEARCH, DEFAULTS.search),
    sort: readSort(url.searchParams.get("sort"), env.RAINDROP_SORT, DEFAULTS.sort),
    nested: readBoolean(url.searchParams.get("nested"), env.RAINDROP_NESTED, DEFAULTS.nested),
    maxArticles: readBoundedInteger(
      url.searchParams.get("maxArticles"),
      env.MAX_ARTICLES,
      DEFAULTS.maxArticles,
      LIMITS.maxArticles,
      "maxArticles",
    ),
    maxMinutes: readBoundedInteger(
      url.searchParams.get("maxMinutes"),
      env.MAX_MINUTES,
      DEFAULTS.maxMinutes,
      LIMITS.maxMinutes,
      "maxMinutes",
    ),
    wordsPerMinute: readBoundedInteger(
      url.searchParams.get("wordsPerMinute"),
      env.WORDS_PER_MINUTE,
      DEFAULTS.wordsPerMinute,
      LIMITS.wordsPerMinute,
      "wordsPerMinute",
    ),
    extractionConcurrency: readBoundedInteger(
      url.searchParams.get("concurrency"),
      env.EXTRACTION_CONCURRENCY,
      DEFAULTS.extractionConcurrency,
      LIMITS.extractionConcurrency,
      "concurrency",
    ),
    fetchTimeoutMs: readBoundedInteger(
      url.searchParams.get("timeoutMs"),
      env.FETCH_TIMEOUT_MS,
      DEFAULTS.fetchTimeoutMs,
      LIMITS.fetchTimeoutMs,
      "timeoutMs",
    ),
    maxHtmlBytes: readBoundedInteger(
      url.searchParams.get("maxHtmlBytes"),
      env.MAX_HTML_BYTES,
      DEFAULTS.maxHtmlBytes,
      LIMITS.maxHtmlBytes,
      "maxHtmlBytes",
    ),
    maxWords: 0,
    perPage: 0,
  };

  config.maxWords = config.maxMinutes * config.wordsPerMinute;
  config.perPage = Math.min(config.maxArticles, 50);

  return config;
}

export function getPublicConfig(config: AppConfig): PublicConfig {
  return {
    collectionId: config.collectionId,
    search: config.search,
    sort: config.sort,
    nested: config.nested,
    maxArticles: config.maxArticles,
    maxMinutes: config.maxMinutes,
    wordsPerMinute: config.wordsPerMinute,
    extractionConcurrency: config.extractionConcurrency,
    fetchTimeoutMs: config.fetchTimeoutMs,
    maxHtmlBytes: config.maxHtmlBytes,
  };
}

function readRequiredString(value: string | undefined, name: string): string {
  if (!value || !value.trim()) {
    throw new AppError(
      500,
      "CONFIG_MISSING",
      `Missing required environment variable: ${name}.`,
    );
  }

  return value.trim();
}

function readString(
  requestValue: string | null,
  envValue: string | undefined,
  fallback: string,
): string {
  if (requestValue !== null) {
    return requestValue.trim();
  }

  if (typeof envValue === "string") {
    return envValue.trim();
  }

  return fallback;
}

function readInteger(
  requestValue: string | null,
  envValue: string | undefined,
  fallback: number,
  field: string,
): number {
  const value = requestValue ?? envValue;

  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed)) {
    throw new AppError(400, "INVALID_QUERY", `Invalid integer for ${field}.`);
  }

  return parsed;
}

function readBoundedInteger(
  requestValue: string | null,
  envValue: string | undefined,
  fallback: number,
  range: { min: number; max: number },
  field: string,
): number {
  const parsed = readInteger(requestValue, envValue, fallback, field);

  if (parsed < range.min || parsed > range.max) {
    throw new AppError(
      400,
      "INVALID_QUERY",
      `${field} must be between ${range.min} and ${range.max}.`,
    );
  }

  return parsed;
}

function readBoolean(
  requestValue: string | null,
  envValue: string | undefined,
  fallback: boolean,
): boolean {
  const value = requestValue ?? envValue;

  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value).toLowerCase();

  if (normalized === "true" || normalized === "1") {
    return true;
  }

  if (normalized === "false" || normalized === "0") {
    return false;
  }

  throw new AppError(400, "INVALID_QUERY", "nested must be true or false.");
}

function readSort(
  requestValue: string | null,
  envValue: string | undefined,
  fallback: string,
): string {
  const value = readString(requestValue, envValue, fallback);

  if (!ALLOWED_SORTS.has(value)) {
    throw new AppError(400, "INVALID_QUERY", "Unsupported sort value.");
  }

  return value;
}
