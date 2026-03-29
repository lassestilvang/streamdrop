import http, { type IncomingMessage, type ServerResponse } from "node:http";

import { GET as generate } from "../api/generate.js";
import { GET as health } from "../api/health.js";

const PORT = Number.parseInt(process.env.PORT || "3000", 10);

const server = http.createServer(async (req, res) => {
  try {
    const request = toWebRequest(req);
    const response = await routeRequest(request);
    await sendResponse(res, response);
  } catch (error) {
    console.error("Local dev server failed", error);
    res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
    res.end(
      JSON.stringify(
        {
          error: {
            code: "DEV_SERVER_ERROR",
            message: "Unexpected error in local development server.",
          },
        },
        null,
        2,
      ),
    );
  }
});

server.listen(PORT, () => {
  console.log(`Streamdrop dev server listening on http://localhost:${PORT}`);
  console.log(`Generate queue: http://localhost:${PORT}/api/generate`);
  console.log(`Health check:   http://localhost:${PORT}/api/health`);
});

async function routeRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === "/api/generate") {
    return generate(request);
  }

  if (url.pathname === "/api/health") {
    return health(request);
  }

  return new Response(
    JSON.stringify(
      {
        error: {
          code: "NOT_FOUND",
          message: "Route not found.",
        },
      },
      null,
      2,
    ),
    {
      status: 404,
      headers: {
        "content-type": "application/json; charset=utf-8",
      },
    },
  );
}

function toWebRequest(req: IncomingMessage): Request {
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(key, item);
      }
    } else if (value !== undefined) {
      headers.set(key, value);
    }
  }

  const host = req.headers.host || `localhost:${PORT}`;
  const url = new URL(req.url || "/", `http://${host}`);

  return new Request(url, {
    method: req.method || "GET",
    headers,
  });
}

async function sendResponse(res: ServerResponse, response: Response): Promise<void> {
  const headers = Object.fromEntries(response.headers.entries());
  const body = Buffer.from(await response.arrayBuffer());

  res.writeHead(response.status, headers);
  res.end(body);
}
