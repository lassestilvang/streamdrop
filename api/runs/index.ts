import { resolveConfig } from "../_lib/config.js";
import { json, methodNotAllowed, toErrorResponse } from "../_lib/http.js";
import { enqueueQueueRun } from "../_lib/service.js";

export async function POST(request: Request): Promise<Response> {
  try {
    const config = resolveConfig(request.url);
    const run = await enqueueQueueRun(config);

    return json(
      {
        run,
        links: {
          status: `/api/runs/${run.id}`,
          process: `/api/runs/${run.id}/process`,
          html: `/api/runs/${run.id}/html?batch=1`,
        },
      },
      { status: 202 },
    );
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
