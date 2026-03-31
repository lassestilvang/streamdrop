import assert from "node:assert/strict";
import test from "node:test";

import { clearSessionCookie } from "../api/_lib/auth.js";

test("clearSessionCookie expires the session immediately", () => {
  assert.match(clearSessionCookie(), /Max-Age=0/);
});
