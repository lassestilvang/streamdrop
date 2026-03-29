import { requireAuth } from "../../_lib/auth.js";
import { AppError } from "../../_lib/errors.js";
import { json, methodNotAllowed, toErrorResponse } from "../../_lib/http.js";
import { getRunBatchHtml, getRunRecord } from "../../_lib/persistence.js";
import { createPublicBatchToken } from "../../_lib/public-html.js";
import { parseRunIdFromPath, readBatchIndex } from "../../_lib/routes.js";

export async function GET(request: Request): Promise<Response> {
  try {
    requireAuth(request);
    const runId = parseRunIdFromPath(request.url);
    const batchIndex = readBatchIndex(request.url);
    const run = await getRunRecord(runId);

    if (!run) {
      throw new AppError(404, "RUN_NOT_FOUND", "Run not found.");
    }

    if (run.status !== "succeeded") {
      throw new AppError(409, "RUN_NOT_READY", "Run is not yet available for HTML retrieval.");
    }

    const batchHtml = await getRunBatchHtml(runId, batchIndex);

    if (!batchHtml) {
      throw new AppError(404, "BATCH_NOT_FOUND", "Batch not found for the requested run.");
    }

    const { expiresAt, token } = createPublicBatchToken(runId, batchIndex);
    const requestUrl = new URL(request.url);
    const publicUrl = new URL(`/api/runs/${encodeURIComponent(runId)}/html`, requestUrl.origin);

    publicUrl.searchParams.set("batch", String(batchIndex));
    publicUrl.searchParams.set("expires", expiresAt);
    publicUrl.searchParams.set("token", token);

    return json({
      publicUrl: publicUrl.toString(),
      expiresAt,
    });
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
