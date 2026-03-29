import { AppError } from "../../_lib/errors.js";
import { json, methodNotAllowed, toErrorResponse } from "../../_lib/http.js";
import { getRunRecord } from "../../_lib/persistence.js";
import { parseRunIdFromPath } from "../../_lib/routes.js";

export async function GET(request: Request): Promise<Response> {
  try {
    const runId = parseRunIdFromPath(request.url);
    const run = await getRunRecord(runId);

    if (!run) {
      throw new AppError(404, "RUN_NOT_FOUND", "Run not found.");
    }

    return json({ run });
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
