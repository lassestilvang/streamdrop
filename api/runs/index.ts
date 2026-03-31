import { requireAuth } from "../_lib/auth.js";
import { resolveConfig } from "../_lib/config.js";
import { json, methodNotAllowed, toErrorResponse } from "../_lib/http.js";
import { getRunRecord, listRecentRuns } from "../_lib/persistence.js";
import { readLimit } from "../_lib/routes.js";
import { generateQueue } from "../_lib/service.js";

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await requireAuth(request);
    const runs = await listRecentRuns(readLimit(request.url), session.userId);
    return json({ runs });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await requireAuth(request);
    const config = resolveConfig(request.url);
    config.userId = session.userId;
    
    const result = await generateQueue(config);
    const run = await getRunRecord(result.runId, session.userId);

    if (!run) {
      throw new Error("Synchronous run could not be loaded from database.");
    }

    return json(
      {
        run,
        links: {
          status: `/api/runs/${run.id}`,
          html: `/api/runs/${run.id}/html?batch=1`,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

const handler = {
  fetch(request: Request): Promise<Response> | Response {
    if (request.method === "GET") {
      return GET(request);
    }

    if (request.method === "POST") {
      return POST(request);
    }

    return methodNotAllowed(["GET", "POST"]);
  },
};

export default handler;
