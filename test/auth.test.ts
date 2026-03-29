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
  assert.equal(validateCredentials("operator", "secret-pass", AUTH_ENV), true);
  assert.equal(validateCredentials("operator", "wrong", AUTH_ENV), false);
});

test("session cookies authenticate requests", () => {
  const cookie = createSessionCookie(AUTH_ENV);
  const request = new Request("https://example.com/api/health", {
    headers: {
      cookie,
    },
  });

  assert.equal(isAuthenticated(request, AUTH_ENV), true);
  assert.deepEqual(getSession(request, AUTH_ENV), {
    authenticated: true,
    username: "operator",
  });
});

test("clearSessionCookie expires the session immediately", () => {
  assert.match(clearSessionCookie(AUTH_ENV), /Max-Age=0/);
});
