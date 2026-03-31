import type { AppConfig, ExtractedArticle } from "./types.js";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_GEMINI_MODEL = "gemini-3-flash-preview";
const DEFAULT_SUMMARY_MAX_CHARACTERS = 240;
const DEFAULT_SUMMARY_INPUT_CHARACTERS = 12000;
const SUMMARY_CONCURRENCY = 2;
const USER_AGENT = "streamdrop/1.0 (+https://vercel.com)";

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

export async function maybeSummarizeArticles(
  articles: ExtractedArticle[],
  config: AppConfig,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ExtractedArticle[]> {
  if (!config.includeSummaries || articles.length === 0) {
    return articles;
  }

  const apiKey = env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    return articles;
  }

  const summarizedArticles = [...articles];
  const model = (env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL).trim() || DEFAULT_GEMINI_MODEL;

  await mapWithConcurrency(summarizedArticles, SUMMARY_CONCURRENCY, async (article, index) => {
    const summary = await summarizeArticle(article, apiKey, model, config.fetchTimeoutMs);

    if (!summary) {
      return;
    }

    summarizedArticles[index] = {
      ...article,
      summary,
    };
  });

  return summarizedArticles;
}

async function summarizeArticle(
  article: ExtractedArticle,
  apiKey: string,
  model: string,
  timeoutMs: number,
): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const excerpt = article.content.slice(0, DEFAULT_SUMMARY_INPUT_CHARACTERS);
    const response = await fetch(`${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": USER_AGENT,
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [
            {
              text: "You write concise article summaries for text-to-speech listening queues.",
            },
          ],
        },
        contents: [
          {
            parts: [
              {
                text:
                  `Summarize this article in plain text for a listener. ` +
                  `Use at most two sentences and no more than ${DEFAULT_SUMMARY_MAX_CHARACTERS} characters. ` +
                  `Do not include markdown, bullets, or a \"Summary:\" label.\n\n` +
                  `Title: ${article.title}\n\n` +
                  `Article:\n${excerpt}`,
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 120,
          responseMimeType: "text/plain",
          temperature: 0.2,
          thinkingConfig: {
            thinkingLevel: "low",
          },
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as GeminiGenerateContentResponse;
    return normalizeSummary(extractResponseText(payload), DEFAULT_SUMMARY_MAX_CHARACTERS);
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractResponseText(payload: GeminiGenerateContentResponse): string {
  return (
    payload.candidates
      ?.flatMap((candidate) => candidate.content?.parts || [])
      .map((part) => part.text || "")
      .join(" ")
      .trim() || ""
  );
}

function normalizeSummary(value: string, maxCharacters: number): string | null {
  const normalized = value
    .replace(/\s+/g, " ")
    .replace(/^summary:\s*/i, "")
    .replace(/^[-*•]\s*/, "")
    .trim();

  if (!normalized) {
    return null;
  }

  if (normalized.length <= maxCharacters) {
    return normalized;
  }

  const cutoff = normalized.lastIndexOf(" ", maxCharacters - 3);
  const truncated = normalized.slice(0, cutoff > 0 ? cutoff : maxCharacters - 3).trimEnd();
  return `${truncated}...`;
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
