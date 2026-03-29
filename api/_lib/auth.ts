import { createHmac, timingSafeEqual } from "node:crypto";

import { AppError } from "./errors.js";

const SESSION_COOKIE = "streamdrop_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30;
const DEFAULT_USERNAME = "streamdrop";
const DEFAULT_PASSWORD = "streamdrop";
const DEFAULT_SECRET = "streamdrop-single-user-session";

interface SessionPayload {
  username: string;
  expiresAt: number;
}

interface AuthSettings {
  username: string;
  password: string;
  secret: string;
}

export function requireAuth(request: Request, env: NodeJS.ProcessEnv = process.env): void {
  if (!isAuthenticated(request, env)) {
    throw new AppError(401, "AUTH_REQUIRED", "Authentication required.");
  }
}

export function isAuthenticated(
  request: Request,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(readSessionPayload(request, env));
}

export function getSession(request: Request, env: NodeJS.ProcessEnv = process.env) {
  const payload = readSessionPayload(request, env);

  return {
    authenticated: Boolean(payload),
    username: payload?.username ?? null,
  };
}

export function validateCredentials(
  username: string,
  password: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const settings = getAuthSettings(env);

  return safeEqual(username, settings.username) && safeEqual(password, settings.password);
}

export function createSessionCookie(env: NodeJS.ProcessEnv = process.env): string {
  const settings = getAuthSettings(env);
  const payload: SessionPayload = {
    username: settings.username,
    expiresAt: Date.now() + SESSION_DURATION_SECONDS * 1000,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signValue(encodedPayload, settings.secret);
  const secure = env.NODE_ENV === "production" ? "; Secure" : "";

  return `${SESSION_COOKIE}=${encodedPayload}.${signature}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DURATION_SECONDS}${secure}`;
}

export function clearSessionCookie(env: NodeJS.ProcessEnv = process.env): string {
  const secure = env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

function readSessionPayload(
  request: Request,
  env: NodeJS.ProcessEnv,
): SessionPayload | null {
  const token = readCookie(request.headers.get("cookie"), SESSION_COOKIE);

  if (!token) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const settings = getAuthSettings(env);

  if (!safeEqual(signature, signValue(encodedPayload, settings.secret))) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as SessionPayload;

    if (
      payload.username !== settings.username ||
      !Number.isInteger(payload.expiresAt) ||
      payload.expiresAt <= Date.now()
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function getAuthSettings(env: NodeJS.ProcessEnv): AuthSettings {
  const username = (env.APP_USERNAME || DEFAULT_USERNAME).trim();
  const password = (env.APP_PASSWORD || DEFAULT_PASSWORD).trim();
  const secret = (env.SESSION_SECRET || `${username}:${password}:${DEFAULT_SECRET}`).trim();

  return {
    username,
    password,
    secret,
  };
}

function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) {
    return null;
  }

  for (const entry of cookieHeader.split(";")) {
    const [key, ...rest] = entry.trim().split("=");

    if (key === name) {
      return rest.join("=");
    }
  }

  return null;
}

function signValue(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
