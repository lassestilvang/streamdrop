import { getPublicConfig, resolveConfig } from "../../_lib/config.js";
import { getLatestSucceededBatchHtml } from "../../_lib/persistence.js";
import { html, methodNotAllowed, toErrorResponse } from "../../_lib/http.js";
import { readBatchIndex } from "../../_lib/routes.js";

export async function GET(request: Request): Promise<Response> {
  try {
    const config = resolveConfig(request.url);
    const batchIndex = readBatchIndex(request.url);
    const batch = await getLatestSucceededBatchHtml(getPublicConfig(config), batchIndex);

    if (!batch) {
      return new Response(
        JSON.stringify(
          {
            error: {
              code: "BATCH_NOT_FOUND",
              message: "Stored batch not found for the requested configuration.",
            },
          },
          null,
          2,
        ),
        {
          status: 404,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
          },
        },
      );
    }

    return html(batch.html, {
      headers: {
        "x-run-id": batch.runId,
      },
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
