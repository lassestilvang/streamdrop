import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_PUBLIC_HTML_TTL_SECONDS = 60 * 60 * 24 * 30;
const DEFAULT_PUBLIC_HTML_SECRET = "streamdrop-public-html";

export function createPublicBatchToken(
  runId: string,
  batchIndex: number,
  env: NodeJS.ProcessEnv = process.env,
): { expiresAt: string; token: string } {
  const ttlSeconds = readTtlSeconds(env);
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  return {
    expiresAt,
    token: signPayload(runId, batchIndex, expiresAt, env),
  };
}

export function verifyPublicBatchToken(
  runId: string,
  batchIndex: number,
  expiresAt: string | null,
  token: string | null,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!expiresAt || !token) {
    return false;
  }

  const expiresAtMs = Date.parse(expiresAt);

  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    return false;
  }

  return safeEqual(token, signPayload(runId, batchIndex, expiresAt, env));
}

function signPayload(
  runId: string,
  batchIndex: number,
  expiresAt: string,
  env: NodeJS.ProcessEnv,
): string {
  return createHmac("sha256", getPublicHtmlSecret(env))
    .update(`${runId}:${batchIndex}:${expiresAt}`)
    .digest("base64url");
}

function getPublicHtmlSecret(env: NodeJS.ProcessEnv): string {
  return (
    env.HTML_LINK_SIGNING_SECRET ||
    env.PUBLIC_HTML_LINK_SECRET ||
    env.SESSION_SECRET ||
    env.APP_PASSWORD ||
    DEFAULT_PUBLIC_HTML_SECRET
  ).trim();
}

function readTtlSeconds(env: NodeJS.ProcessEnv): number {
  const rawValue = env.HTML_LINK_TTL_SECONDS || env.PUBLIC_HTML_LINK_TTL_SECONDS;

  if (!rawValue) {
    return DEFAULT_PUBLIC_HTML_TTL_SECONDS;
  }

  const parsed = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(parsed) || parsed < 60) {
    return DEFAULT_PUBLIC_HTML_TTL_SECONDS;
  }

  return parsed;
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
