import {
  clearSessionCookie,
  createSessionCookie,
  destroySession,
  getSession,
  validateCredentials,
} from "./_lib/auth.js";
import { AppError } from "./_lib/errors.js";
import { json, methodNotAllowed, toErrorResponse } from "./_lib/http.js";

export async function GET(request: Request): Promise<Response> {
  return json(await getSession(request));
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

    const session = await validateCredentials(username, password);

    if (!session) {
      throw new AppError(401, "INVALID_LOGIN", "Invalid username or password.");
    }

    return json(
      {
        authenticated: true,
        userId: session.userId,
        username: session.username,
      },
      {
        headers: {
          "set-cookie": await createSessionCookie(session),
        },
      },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  await destroySession(request);

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
      return DELETE(request);
    }

    return methodNotAllowed(["GET", "POST", "DELETE"]);
  },
};

export default handler;
