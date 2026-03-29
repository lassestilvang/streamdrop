import { fetchJson } from "./http.js";
import type { AppConfig, RaindropItem } from "./types.js";

const RAINDROP_API_BASE = "https://api.raindrop.io/rest/v1";
const USER_AGENT = "streamdrop/1.0 (+https://vercel.com)";

interface RaindropApiResponse {
  items?: Array<{
    _id: number;
    title?: string;
    link?: string;
    created?: string;
  }>;
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

    if (config.search) {
      url.searchParams.set("search", config.search);
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
