import assert from "node:assert/strict";
import test from "node:test";

import {
  clearSessionCookie,
  createSessionCookie,
  getSession,
  isAuthenticated,
  validateCredentials,
} from "../api/_lib/auth.js";

const AUTH_ENV = {
  APP_USERNAME: "operator",
  APP_PASSWORD: "secret-pass",
  SESSION_SECRET: "session-secret",
};

test("validateCredentials checks configured single-user credentials", () => {
  return Promise.all([
    validateCredentials("operator", "secret-pass", AUTH_ENV),
    validateCredentials("operator", "wrong", AUTH_ENV),
  ]).then(([valid, invalid]) => {
    assert.deepEqual(valid, {
      userId: "legacy-single-user",
      username: "operator",
    });
    assert.equal(invalid, null);
  });
});

test("session cookies authenticate requests", async () => {
  const cookie = await createSessionCookie(
    {
      userId: "legacy-single-user",
      username: "operator",
    },
    AUTH_ENV,
  );
  const request = new Request("https://example.com/api/health", {
    headers: {
      cookie,
    },
  });

  assert.equal(await isAuthenticated(request, AUTH_ENV), true);
  assert.deepEqual(await getSession(request, AUTH_ENV), {
    authenticated: true,
    userId: "legacy-single-user",
    username: "operator",
  });
});

test("clearSessionCookie expires the session immediately", () => {
  assert.match(clearSessionCookie(AUTH_ENV), /Max-Age=0/);
});
