import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

import type { AppConfig, ExtractedArticle, RaindropItem, SkippedArticle } from "./types.js";

const ALLOWED_CONTENT_TYPES = ["text/html", "application/xhtml+xml"];
const USER_AGENT = "streamdrop/1.0 (+https://vercel.com)";

interface ExtractionSuccess {
  ok: true;
  article: ExtractedArticle;
}

interface ExtractionFailure {
  ok: false;
  reason: string;
}

type ExtractionResult = ExtractionSuccess | ExtractionFailure;

export async function extractArticles(
  items: RaindropItem[],
  config: AppConfig,
): Promise<{ extracted: ExtractedArticle[]; skipped: SkippedArticle[] }> {
  const extracted: ExtractedArticle[] = [];
  const skipped: SkippedArticle[] = [];

  await mapWithConcurrency(items, config.extractionConcurrency, async (item, position) => {
    const result = await extractArticle({ ...item, position }, config);

    if (result.ok) {
      extracted.push(result.article);
    } else {
      skipped.push({
        url: item.link,
        title: item.title,
        reason: result.reason,
      });
    }
  });

  extracted.sort((left, right) => left.position - right.position);
  skipped.sort((left, right) => left.title.localeCompare(right.title));

  return { extracted, skipped };
}

async function extractArticle(item: RaindropItem, config: AppConfig): Promise<ExtractionResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.fetchTimeoutMs);

  try {
    const response = await fetch(item.link, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": USER_AGENT,
      },
      redirect: "follow",
      signal: controller.signal,
    });

    if (!response.ok) {
      return { ok: false, reason: `Upstream returned ${response.status}` };
    }

    const contentType = response.headers.get("content-type") || "";

    if (
      contentType &&
      !ALLOWED_CONTENT_TYPES.some((allowedType) => contentType.includes(allowedType))
    ) {
      return { ok: false, reason: `Unsupported content-type: ${contentType}` };
    }

    const html = await readLimitedText(response, config.maxHtmlBytes);
    const dom = new JSDOM(html, { url: item.link });
    const article = new Readability(dom.window.document).parse();

    if (!article?.textContent?.trim()) {
      return { ok: false, reason: "Readability could not extract article text" };
    }

    const content = normalizeText(article.textContent);

    if (!content) {
      return { ok: false, reason: "Extracted article text was empty after normalization" };
    }

    const wordCount = estimateWords(content);

    return {
      ok: true,
      article: {
        id: item.id,
        title: article.title?.trim() || item.title,
        sourceUrl: item.link,
        ...(item.created ? { created: item.created } : {}),
        content,
        wordCount,
        minutes: wordCount / config.wordsPerMinute,
        position: item.position ?? 0,
      },
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, reason: `Timed out after ${config.fetchTimeoutMs}ms` };
    }

    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Unexpected extraction failure",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let cursor = 0;

  const workerCount = Math.min(concurrency, items.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < items.length) {
      const current = cursor;
      cursor += 1;
      await mapper(items[current] as T, current);
    }
  });

  await Promise.all(workers);
}

async function readLimitedText(response: Response, maxBytes: number): Promise<string> {
  const declaredLength = Number.parseInt(response.headers.get("content-length") || "", 10);

  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error(`Document exceeded byte limit of ${maxBytes}`);
  }

  if (!response.body) {
    const text = await response.text();

    if (Buffer.byteLength(text, "utf8") > maxBytes) {
      throw new Error(`Document exceeded byte limit of ${maxBytes}`);
    }

    return text;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    totalBytes += value.byteLength;

    if (totalBytes > maxBytes) {
      throw new Error(`Document exceeded byte limit of ${maxBytes}`);
    }

    chunks.push(value);
  }

  const merged = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(merged);
}

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n\n");
}

function estimateWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
