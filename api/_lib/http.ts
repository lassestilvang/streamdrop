import { AppError, isAppError } from "./errors.js";

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");

  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers,
  });
}

export function html(document: string, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "no-store");

  return new Response(document, {
    ...init,
    headers,
  });
}

export function methodNotAllowed(allowedMethods: string[]): Response {
  return json(
    {
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: `Method not allowed. Use ${allowedMethods.join(", ")}.`,
      },
    },
    {
      status: 405,
      headers: {
        allow: allowedMethods.join(", "),
      },
    },
  );
}

export function toErrorResponse(error: unknown): Response {
  if (isAppError(error)) {
    return json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.status },
    );
  }

  console.error("Unhandled error", error);

  return json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Unexpected error while handling the request.",
      },
    },
    { status: 500 },
  );
}

export async function fetchJson<T>(
  url: string,
  { timeoutMs, headers = {} }: { timeoutMs: number; headers?: HeadersInit },
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      let details: unknown;

      try {
        details = await response.json();
      } catch {
        details = await response.text();
      }

      throw new AppError(
        response.status === 401 ? 500 : 502,
        response.status === 401 ? "RAINDROP_AUTH_FAILED" : "RAINDROP_FETCH_FAILED",
        response.status === 401
          ? "Raindrop rejected the token configured for this deployment."
          : "Raindrop returned an unexpected response.",
        { status: response.status, url, upstream: details },
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new AppError(
        504,
        "UPSTREAM_TIMEOUT",
        "Timed out while waiting for an upstream service.",
        { url, timeoutMs },
      );
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
