import {
  clearSessionCookie,
  createSessionCookie,
  getSession,
  validateCredentials,
} from "./_lib/auth.js";
import { AppError } from "./_lib/errors.js";
import { json, methodNotAllowed, toErrorResponse } from "./_lib/http.js";

export function GET(request: Request): Response {
  return json(getSession(request));
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
    };
    const username = body.username?.trim() ?? "";
    const password = body.password?.trim() ?? "";

    if (!username || !password) {
      throw new AppError(400, "INVALID_LOGIN", "Username and password are required.");
    }

    if (!validateCredentials(username, password)) {
      throw new AppError(401, "INVALID_LOGIN", "Invalid username or password.");
    }

    return json(
      {
        authenticated: true,
        username,
      },
      {
        headers: {
          "set-cookie": createSessionCookie(),
        },
      },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

export function DELETE(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "set-cookie": clearSessionCookie(),
      "cache-control": "no-store",
    },
  });
}

const handler = {
  fetch(request: Request): Promise<Response> | Response {
    if (request.method === "GET") {
      return GET(request);
    }

    if (request.method === "POST") {
      return POST(request);
    }

    if (request.method === "DELETE") {
      return DELETE();
    }

    return methodNotAllowed(["GET", "POST", "DELETE"]);
  },
};

export default handler;
