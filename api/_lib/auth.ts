import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

import { eq } from "drizzle-orm";

import { getDatabase } from "../../db/client.js";
import { userSessions, userSettings, users } from "../../db/schema.js";
import { AppError } from "./errors.js";

const SESSION_COOKIE = "streamdrop_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30;
const DEFAULT_USERNAME = "streamdrop";
const DEFAULT_PASSWORD = "streamdrop";
const DEFAULT_SECRET = "streamdrop-single-user-session";

interface LegacySessionPayload {
  username: string;
  expiresAt: number;
}

interface AuthSettings {
  username: string;
  password: string;
  secret: string;
}

interface SessionRecord {
  userId: string;
  username: string;
}

export interface SessionState {
  authenticated: boolean;
  userId: string | null;
  username: string | null;
}

export async function requireAuth(
  request: Request,
  env: NodeJS.ProcessEnv = process.env,
): Promise<SessionRecord> {
  const session = await getSession(request, env);

  if (!session.authenticated || !session.userId || !session.username) {
    throw new AppError(401, "AUTH_REQUIRED", "Authentication required.");
  }

  return {
    userId: session.userId,
    username: session.username,
  };
}

export async function isAuthenticated(
  request: Request,
  env: NodeJS.ProcessEnv = process.env,
): Promise<boolean> {
  return Boolean((await readSessionRecord(request, env))?.userId);
}

export async function getSession(
  request: Request,
  env: NodeJS.ProcessEnv = process.env,
): Promise<SessionState> {
  const payload = await readSessionRecord(request, env);

  return {
    authenticated: Boolean(payload),
    userId: payload?.userId ?? null,
    username: payload?.username ?? null,
  };
}

export async function validateCredentials(
  username: string,
  password: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<SessionRecord | null> {
  const normalizedUsername = normalizeUsername(username);
  const db = getDatabase();

  if (!db) {
    const settings = getAuthSettings(env);

    if (
      safeEqual(normalizedUsername, normalizeUsername(settings.username)) &&
      safeEqual(password, settings.password)
    ) {
      return {
        userId: "legacy-single-user",
        username: settings.username,
      };
    }

    return null;
  }

  await maybeBootstrapLegacyUser(env);

  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.username, normalizedUsername))
    .limit(1);

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return null;
  }

  return {
    userId: user.id,
    username: user.username,
  };
}

export async function createUser(
  username: string,
  password: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<SessionRecord> {
  const db = getDatabase();

  if (!db) {
    throw new AppError(
      500,
      "DATABASE_NOT_CONFIGURED",
      "DATABASE_URL is required to create managed users.",
    );
  }

  await maybeBootstrapLegacyUser(env);

  const normalizedUsername = normalizeUsername(username);

  if (!normalizedUsername || !password.trim()) {
    throw new AppError(400, "INVALID_SIGNUP", "Username and password are required.");
  }

  const [existingUser] = await db
    .select({
      id: users.id,
    })
    .from(users)
    .where(eq(users.username, normalizedUsername))
    .limit(1);

  if (existingUser) {
    throw new AppError(409, "USERNAME_TAKEN", "That username is already in use.");
  }

  const userId = randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      id: userId,
      username: normalizedUsername,
      passwordHash: hashPassword(password),
      role: "member",
    });

    await tx.insert(userSettings).values({
      userId,
    });
  });

  return {
    userId,
    username: normalizedUsername,
  };
}

export async function createSessionCookie(
  session: SessionRecord,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  const db = getDatabase();

  if (!db || session.userId === "legacy-single-user") {
    return createLegacySessionCookie(session.username, env);
  }

  const token = randomBytes(32).toString("base64url");
  const secure = env.NODE_ENV === "production" ? "; Secure" : "";

  await db.insert(userSessions).values({
    id: randomUUID(),
    userId: session.userId,
    tokenHash: hashSessionToken(token),
    expiresAt: new Date(Date.now() + SESSION_DURATION_SECONDS * 1000),
  });

  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DURATION_SECONDS}${secure}`;
}

export async function destroySession(
  request: Request,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const db = getDatabase();

  if (!db) {
    return;
  }

  const token = readCookie(request.headers.get("cookie"), SESSION_COOKIE);

  if (!token) {
    return;
  }

  await db.delete(userSessions).where(eq(userSessions.tokenHash, hashSessionToken(token)));
}

export function clearSessionCookie(env: NodeJS.ProcessEnv = process.env): string {
  const secure = env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

async function readSessionRecord(
  request: Request,
  env: NodeJS.ProcessEnv,
): Promise<SessionRecord | null> {
  const db = getDatabase();

  if (!db) {
    const payload = readLegacySessionPayload(request, env);

    if (!payload) {
      return null;
    }

    return {
      userId: "legacy-single-user",
      username: payload.username,
    };
  }

  const token = readCookie(request.headers.get("cookie"), SESSION_COOKIE);

  if (!token) {
    return null;
  }

  const [session] = await db
    .select({
      userId: userSessions.userId,
      username: users.username,
      expiresAt: userSessions.expiresAt,
    })
    .from(userSessions)
    .innerJoin(users, eq(userSessions.userId, users.id))
    .where(eq(userSessions.tokenHash, hashSessionToken(token)))
    .limit(1);

  if (!session || session.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  return {
    userId: session.userId,
    username: session.username,
  };
}

function readLegacySessionPayload(
  request: Request,
  env: NodeJS.ProcessEnv,
): LegacySessionPayload | null {
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
    ) as LegacySessionPayload;

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

function createLegacySessionCookie(
  username: string,
  env: NodeJS.ProcessEnv,
): string {
  const settings = getAuthSettings(env);
  const payload: LegacySessionPayload = {
    username,
    expiresAt: Date.now() + SESSION_DURATION_SECONDS * 1000,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signValue(encodedPayload, settings.secret);
  const secure = env.NODE_ENV === "production" ? "; Secure" : "";

  return `${SESSION_COOKIE}=${encodedPayload}.${signature}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DURATION_SECONDS}${secure}`;
}

async function maybeBootstrapLegacyUser(env: NodeJS.ProcessEnv): Promise<void> {
  const db = getDatabase();

  if (!db) {
    return;
  }

  const [existingUser] = await db
    .select({
      id: users.id,
    })
    .from(users)
    .limit(1);

  if (existingUser) {
    return;
  }

  const settings = getAuthSettings(env);
  const userId = randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      id: userId,
      username: normalizeUsername(settings.username),
      passwordHash: hashPassword(settings.password),
      role: "owner",
    });

    await tx.insert(userSettings).values({
      userId,
      collectionId: Number.parseInt(env.RAINDROP_COLLECTION_ID || "0", 10) || 0,
      processedCollectionId: parseOptionalInteger(env.RAINDROP_PROCESSED_COLLECTION_ID),
      search: env.RAINDROP_SEARCH || "",
      sort: env.RAINDROP_SORT || "-created",
      nested: readBooleanEnv(env.RAINDROP_NESTED, true),
      maxArticles: Number.parseInt(env.MAX_ARTICLES || "20", 10) || 20,
      maxMinutes: Number.parseInt(env.MAX_MINUTES || "45", 10) || 45,
      wordsPerMinute: Number.parseInt(env.WORDS_PER_MINUTE || "180", 10) || 180,
      extractionConcurrency: Number.parseInt(env.EXTRACTION_CONCURRENCY || "4", 10) || 4,
      fetchTimeoutMs: Number.parseInt(env.FETCH_TIMEOUT_MS || "12000", 10) || 12000,
      maxHtmlBytes: Number.parseInt(env.MAX_HTML_BYTES || "750000", 10) || 750000,
      raindropToken: env.RAINDROP_TOKEN || null,
    });
  });
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

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${derivedKey}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [algorithm, salt, expectedHash] = storedHash.split(":");

  if (algorithm !== "scrypt" || !salt || !expectedHash) {
    return false;
  }

  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return safeEqual(derivedKey, expectedHash);
}

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function parseOptionalInteger(value: string | undefined): number | null {
  if (!value || !value.trim()) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function readBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (!value || !value.trim()) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "true" || normalized === "1") {
    return true;
  }

  if (normalized === "false" || normalized === "0") {
    return false;
  }

  return fallback;
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
