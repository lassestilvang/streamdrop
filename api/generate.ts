import { requireAuth } from "./_lib/auth.js";
import { resolveConfig } from "./_lib/config.js";
import { json, methodNotAllowed, toErrorResponse } from "./_lib/http.js";
import { generateQueue } from "./_lib/service.js";

export async function GET(request: Request): Promise<Response> {
  try {
    requireAuth(request);
    const config = resolveConfig(request.url);
    const payload = await generateQueue(config);
    return json(payload);
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
