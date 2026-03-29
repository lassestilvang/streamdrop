import http, { type IncomingMessage, type ServerResponse } from "node:http";

import { loadLocalEnv } from "./load-env.js";
import { GET as generate } from "../api/generate.js";
import { GET as health } from "../api/health.js";
import latestQueueHandler from "../api/queue/latest/index.js";
import latestQueueHtmlHandler from "../api/queue/latest/html.js";
import runsHandler from "../api/runs/index.js";
import runHandler from "../api/runs/[runId]/index.js";
import runHtmlHandler from "../api/runs/[runId]/html.js";
import runProcessHandler from "../api/runs/[runId]/process.js";

loadLocalEnv();

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
  console.log(`Latest queue:   http://localhost:${PORT}/api/queue/latest`);
  console.log(`Runs API:       http://localhost:${PORT}/api/runs`);
});

async function routeRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === "/api/generate") {
    return generate(request);
  }

  if (url.pathname === "/api/health") {
    return health(request);
  }

  if (url.pathname === "/api/queue/latest") {
    return latestQueueHandler.fetch(request);
  }

  if (url.pathname === "/api/queue/latest/html") {
    return latestQueueHtmlHandler.fetch(request);
  }

  if (url.pathname === "/api/runs") {
    return runsHandler.fetch(request);
  }

  if (/^\/api\/runs\/[^/]+\/process$/.test(url.pathname)) {
    return runProcessHandler.fetch(request);
  }

  if (/^\/api\/runs\/[^/]+\/html$/.test(url.pathname)) {
    return runHtmlHandler.fetch(request);
  }

  if (/^\/api\/runs\/[^/]+$/.test(url.pathname)) {
    return runHandler.fetch(request);
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
