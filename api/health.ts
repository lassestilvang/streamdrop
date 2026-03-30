import { requireAuth } from "./_lib/auth.js";
import { getPublicConfig, resolveConfig } from "./_lib/config.js";
import { json, methodNotAllowed, toErrorResponse } from "./_lib/http.js";

export function GET(request: Request): Response {
  try {
    requireAuth(request);
  } catch (error) {
    return toErrorResponse(error);
  }

  let configuration:
    | {
      ok: true;
      databaseConfigured: boolean;
      processedCollectionConfigured: boolean;
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
    | {
        ok: false;
        code: string;
        message: string;
      };

  try {
    const config = resolveConfig(request.url);
    const defaults = getPublicConfig(config);
    configuration = {
      ok: true,
      databaseConfigured: Boolean(process.env.DATABASE_URL),
      processedCollectionConfigured: Boolean(config.processedCollectionId),
      ...defaults,
    };
  } catch (error) {
    configuration = {
      ok: false,
      code:
        error instanceof Error && "code" in error && typeof error.code === "string"
          ? error.code
          : "CONFIG_INVALID",
      message: error instanceof Error ? error.message : "Invalid configuration.",
    };
  }

  return json({
    ok: configuration.ok,
    service: "streamdrop",
    timestamp: new Date().toISOString(),
    configuration,
  });
}

const handler = {
  fetch(request: Request): Response {
    if (request.method === "GET") {
      return GET(request);
    }

    return methodNotAllowed(["GET"]);
  },
};

export default handler;
