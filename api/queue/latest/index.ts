import { requireAuth } from "../../_lib/auth.js";
import { getPublicConfig, resolveConfig } from "../../_lib/config.js";
import { getLatestSucceededRun } from "../../_lib/persistence.js";
import { json, methodNotAllowed, toErrorResponse } from "../../_lib/http.js";

export async function GET(request: Request): Promise<Response> {
  try {
    requireAuth(request);
    const config = resolveConfig(request.url);
    const run = await getLatestSucceededRun(getPublicConfig(config));

    if (!run || !run.result) {
      return json(
        {
          error: {
            code: "RUN_NOT_FOUND",
            message: "No stored successful run matched the requested configuration.",
          },
        },
        { status: 404 },
      );
    }

    return json(run.result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

const handler = {
  fetch(request: Request): Promise<Response> | Response {
    if (request.method === "GET") {
      return GET(request);
    }

    return methodNotAllowed(["GET"]);
  },
};

export default handler;
