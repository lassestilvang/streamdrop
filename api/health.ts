import { resolveConfig } from "./_lib/config.js";
import { json, methodNotAllowed } from "./_lib/http.js";

export function GET(request: Request): Response {
  let configuration:
    | {
      ok: true;
      collectionId: number;
      databaseConfigured: boolean;
      maxArticles: number;
      maxMinutes: number;
      extractionConcurrency: number;
      }
    | {
        ok: false;
        code: string;
        message: string;
      };

  try {
    const config = resolveConfig(request.url);
    configuration = {
      ok: true,
      collectionId: config.collectionId,
      databaseConfigured: Boolean(process.env.DATABASE_URL),
      maxArticles: config.maxArticles,
      maxMinutes: config.maxMinutes,
      extractionConcurrency: config.extractionConcurrency,
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
