const assert = require("node:assert/strict");
const test = require("node:test");

const { createAuthMiddleware } = require("../middleware/auth");

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
    },
  };
}

test("allows admin access when loginDisabled is enabled", async () => {
  const db = {
    getConfig: async () => ({ loginDisabled: true }),
  };
  const { requireAuth } = createAuthMiddleware(db);
  const response = createResponse();
  let nextCalled = false;

  await requireAuth({ session: {} }, response, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(response.statusCode, 200);
});

test("requires a session when loginDisabled is disabled", async () => {
  const db = {
    getConfig: async () => ({ loginDisabled: false }),
  };
  const { requireAuth } = createAuthMiddleware(db);
  const response = createResponse();

  await requireAuth({ session: {} }, response, () => {});

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.body, { error: "需要身份验证" });
});
