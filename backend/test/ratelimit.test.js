// ratelimit.test.js
// Exercises the in-memory rate limiter middleware directly with fake
// Express req/res objects, no server needed.

import { test } from "node:test";
import assert from "node:assert/strict";
import { rateLimit } from "../src/ratelimit.js";

function fakeReqRes(ip) {
  const req = { ip, socket: {} };
  const res = {
    statusCode: null,
    headers: {},
    body: null,
    set(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return { req, res };
}

test("allows requests under the limit", () => {
  const ip = `test-client-${Math.random()}`;
  let nextCalled = 0;
  for (let i = 0; i < 20; i++) {
    const { req, res } = fakeReqRes(ip);
    rateLimit(req, res, () => nextCalled++);
    assert.equal(res.statusCode, null, `request ${i + 1} should not be rate-limited`);
  }
  assert.equal(nextCalled, 20);
});

test("blocks the 21st request within the same window", () => {
  const ip = `test-client-${Math.random()}`;
  for (let i = 0; i < 20; i++) {
    const { req, res } = fakeReqRes(ip);
    rateLimit(req, res, () => {});
  }
  const { req, res } = fakeReqRes(ip);
  let nextCalled = false;
  rateLimit(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 429);
  assert.ok(res.headers["Retry-After"]);
});

test("tracks different clients independently", () => {
  const ipA = `client-a-${Math.random()}`;
  const ipB = `client-b-${Math.random()}`;
  for (let i = 0; i < 20; i++) {
    const { req, res } = fakeReqRes(ipA);
    rateLimit(req, res, () => {});
  }
  // Client A is now at the limit; client B should still be allowed.
  const { req, res } = fakeReqRes(ipB);
  let nextCalled = false;
  rateLimit(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, null);
});
