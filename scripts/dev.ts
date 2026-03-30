import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";

import { loadLocalEnv } from "./load-env.js";
import { GET as generate } from "../api/generate.js";
import { GET as health } from "../api/health.js";
import latestQueueHandler from "../api/queue/latest/index.js";
import latestQueueHtmlHandler from "../api/queue/latest/html.js";
import runsHandler from "../api/runs/index.js";
import runHandler from "../api/runs/[runId]/index.js";
import runHtmlHandler from "../api/runs/[runId]/html.js";
import runHtmlLinkHandler from "../api/runs/[runId]/html-link.js";
import runProcessHandler from "../api/runs/[runId]/process.js";
import sessionHandler from "../api/session.js";
import usersHandler from "../api/users.js";

loadLocalEnv();

const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const INDEX_HTML_URL = new URL("../index.html", import.meta.url);
const APP_CSS_URL = new URL("../web/app.css", import.meta.url);
const APP_JS_URL = new URL("../web/app.js", import.meta.url);

const server = http.createServer(async (req, res) => {
  try {
    const request = await toWebRequest(req);
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

  if (url.pathname === "/" || url.pathname === "/index.html") {
    return serveStaticFile(INDEX_HTML_URL, "text/html; charset=utf-8");
  }

  if (url.pathname === "/web/app.css") {
    return serveStaticFile(APP_CSS_URL, "text/css; charset=utf-8");
  }

  if (url.pathname === "/web/app.js") {
    return serveStaticFile(APP_JS_URL, "text/javascript; charset=utf-8");
  }

  if (url.pathname === "/api/generate") {
    return generate(request);
  }

  if (url.pathname === "/api/health") {
    return health(request);
  }

  if (url.pathname === "/api/session") {
    return sessionHandler.fetch(request);
  }

  if (url.pathname === "/api/users") {
    return usersHandler.fetch(request);
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

  if (/^\/api\/runs\/[^/]+\/html-link$/.test(url.pathname)) {
    return runHtmlLinkHandler.fetch(request);
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

async function toWebRequest(req: IncomingMessage): Promise<Request> {
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
  const body =
    req.method && req.method !== "GET" && req.method !== "HEAD"
      ? await readRequestBody(req)
      : undefined;

  return new Request(url, {
    method: req.method || "GET",
    headers,
    ...(body ? { body: new Uint8Array(body) } : {}),
  });
}

async function readRequestBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

async function sendResponse(res: ServerResponse, response: Response): Promise<void> {
  const headers = Object.fromEntries(response.headers.entries());
  const body = Buffer.from(await response.arrayBuffer());

  res.writeHead(response.status, headers);
  res.end(body);
}

async function serveStaticFile(fileUrl: URL, contentType: string): Promise<Response> {
  const body = await readFile(fileUrl);

  return new Response(body, {
    headers: {
      "content-type": contentType,
      "cache-control": "no-store",
    },
  });
}
