import { createSessionCookie, createUser } from "./_lib/auth.js";
import { AppError } from "./_lib/errors.js";
import { json, methodNotAllowed, toErrorResponse } from "./_lib/http.js";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
    };
    const username = body.username?.trim() ?? "";
    const password = body.password?.trim() ?? "";

    if (!username || !password) {
      throw new AppError(400, "INVALID_SIGNUP", "Username and password are required.");
    }

    const user = await createUser(username, password);

    return json(
      {
        authenticated: true,
        userId: user.userId,
        username: user.username,
      },
      {
        status: 201,
        headers: {
          "set-cookie": await createSessionCookie(user),
        },
      },
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
