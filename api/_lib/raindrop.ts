import { fetchJson } from "./http.js";
import type {
  AppConfig,
  ExtractedArticle,
  ProcessedArticleMoveSummary,
  RaindropItem,
} from "./types.js";

const RAINDROP_API_BASE = "https://api.raindrop.io/rest/v1";
const USER_AGENT = "streamdrop/1.0 (+https://vercel.com)";
const TAG_SEARCH_SHORTHAND_PATTERN = /(^|\s)(-?)tag:(?:"([^"\r\n]+)"|([^\s]+))/gi;

interface RaindropApiResponse {
  items?: Array<{
    _id: number;
    title?: string;
    link?: string;
    created?: string;
    collection?: {
      $id?: number;
    };
  }>;
}

interface BulkUpdateResponse {
  result?: boolean;
  modified?: number;
}

export async function fetchRaindrops(config: AppConfig): Promise<RaindropItem[]> {
  const items: RaindropItem[] = [];
  const seenLinks = new Set<string>();
  let page = 0;

  while (items.length < config.maxArticles) {
    const url = new URL(
      `${RAINDROP_API_BASE}/raindrops/${encodeURIComponent(config.collectionId)}`,
    );

    url.searchParams.set("page", String(page));
    url.searchParams.set("perpage", String(config.perPage));
    url.searchParams.set("sort", config.sort);
    url.searchParams.set("nested", String(config.nested));

    const search = normalizeSearchForRaindrop(config.search);

    if (search) {
      url.searchParams.set("search", search);
    }

    const payload = await fetchJson<RaindropApiResponse>(url.toString(), {
      timeoutMs: config.fetchTimeoutMs,
      headers: {
        authorization: `Bearer ${config.token}`,
        accept: "application/json",
        "user-agent": USER_AGENT,
      },
    });

    const pageItems = Array.isArray(payload.items) ? payload.items : [];

    for (const item of pageItems) {
      if (!item.link || seenLinks.has(item.link)) {
        continue;
      }

      items.push({
        id: item._id,
        title: item.title || item.link,
        link: item.link,
        collectionId: item.collection?.$id ?? config.collectionId,
        ...(item.created ? { created: item.created } : {}),
      });
      seenLinks.add(item.link);

      if (items.length >= config.maxArticles) {
        break;
      }
    }

    if (pageItems.length < config.perPage) {
      break;
    }

    page += 1;
  }

  return items;
}

export async function moveProcessedRaindrops(
  articles: ExtractedArticle[],
  config: AppConfig,
): Promise<ProcessedArticleMoveSummary | null> {
  if (!config.processedCollectionId || articles.length === 0) {
    return null;
  }

  const destinationCollectionId = config.processedCollectionId;
  const groupedBySourceCollection = new Map<number, ExtractedArticle[]>();
  const failures: ProcessedArticleMoveSummary["failures"] = [];
  let moved = 0;

  for (const article of articles) {
    if (article.collectionId === destinationCollectionId) {
      moved += 1;
      continue;
    }

    if (!Number.isInteger(article.collectionId) || article.collectionId < 1) {
      failures.push({
        id: article.id,
        title: article.title,
        sourceCollectionId: null,
        error: "Source collection was unavailable for move.",
      });
      continue;
    }

    const collectionArticles = groupedBySourceCollection.get(article.collectionId) || [];
    collectionArticles.push(article);
    groupedBySourceCollection.set(article.collectionId, collectionArticles);
  }

  for (const [sourceCollectionId, collectionArticles] of groupedBySourceCollection) {
    try {
      const payload = await fetchJson<BulkUpdateResponse>(
        `${RAINDROP_API_BASE}/raindrops/${encodeURIComponent(sourceCollectionId)}`,
        {
          timeoutMs: config.fetchTimeoutMs,
          method: "PUT",
          headers: {
            authorization: `Bearer ${config.token}`,
            accept: "application/json",
            "user-agent": USER_AGENT,
          },
          body: {
            ids: collectionArticles.map((article) => article.id),
            collection: {
              $id: destinationCollectionId,
            },
          },
        },
      );

      if (payload.result === false) {
        throw new Error("Raindrop rejected the move request.");
      }

      const modifiedCount =
        typeof payload.modified === "number" ? payload.modified : collectionArticles.length;

      moved += Math.min(modifiedCount, collectionArticles.length);

      if (modifiedCount < collectionArticles.length) {
        for (const article of collectionArticles.slice(modifiedCount)) {
          failures.push({
            id: article.id,
            title: article.title,
            sourceCollectionId,
            error: "Raindrop did not report the article as moved.",
          });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected move failure";

      for (const article of collectionArticles) {
        failures.push({
          id: article.id,
          title: article.title,
          sourceCollectionId,
          error: message,
        });
      }
    }
  }

  return {
    destinationCollectionId,
    attempted: articles.length,
    moved,
    failed: failures.length,
    failures,
  };
}

function normalizeSearchForRaindrop(search: string): string {
  if (!search) {
    return "";
  }

  return search.replace(
    TAG_SEARCH_SHORTHAND_PATTERN,
    (_match, prefix: string, negation: string, quotedTag: string, bareTag: string) => {
      const tag = (quotedTag || bareTag || "").trim();
      const token = /\s/.test(tag) ? `#"${tag}"` : `#${tag}`;
      return `${prefix}${negation}${token}`;
    },
  );
}
