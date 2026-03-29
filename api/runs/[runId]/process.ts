import { requireAuth } from "../../_lib/auth.js";
import { json, methodNotAllowed, toErrorResponse } from "../../_lib/http.js";
import { parseRunIdFromPath } from "../../_lib/routes.js";
import { processQueuedRun } from "../../_lib/service.js";

export async function POST(request: Request): Promise<Response> {
  try {
    requireAuth(request);
    const runId = parseRunIdFromPath(request.url);
    const run = await processQueuedRun(runId);
    return json({ run });
  } catch (error) {
    return toErrorResponse(error);
  }
}

const handler = {
  fetch(request: Request): Promise<Response> | Response {
    if (request.method === "POST") {
      return POST(request);
    }

    return methodNotAllowed(["POST"]);
  },
};

export default handler;
