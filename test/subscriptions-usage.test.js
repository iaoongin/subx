const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const express = require("express");

const createSubscriptionRoutes = require("../routes/subscriptions");
const {
  getCurrentSubscriptionUsage,
  isSubscriptionExhausted,
} = require("../services/subscription-usage");
const { getSubscriptionNodeCount } = require("../services/subscription-node-count");

test("node count parses a direct node subscription", async () => {
  const count = await getSubscriptionNodeCount({
    id: "direct-node-count",
    url: "trojan://password@example.com:443#Test",
  });

  assert.equal(count, 1);
});

test("usage exhaustion requires a declared total and includes upload plus download", async (t) => {
  const originalFetch = global.fetch;
  global.fetch = async () => new Response("", {
    status: 200,
    headers: {
      "subscription-userinfo": "upload=40; download=60; total=100",
    },
  });
  t.after(() => {
    global.fetch = originalFetch;
  });

  const userinfo = await getCurrentSubscriptionUsage({
    id: "exhaustion-test",
    url: "https://usage.example/sub",
  });

  assert.equal(isSubscriptionExhausted(userinfo), true);
  assert.equal(isSubscriptionExhausted({ upload: 100, download: 0, total: 0 }), false);
});

test("usage refresh skips disabled subscriptions", async (t) => {
  const originalFetch = global.fetch;
  const fetchedUrls = [];
  global.fetch = async (url) => {
    fetchedUrls.push(url);
    if (url === "https://failed.example/sub") {
      throw new Error("connection failed");
    }
    return new Response("", {
      status: 200,
      headers: {
        "subscription-userinfo": "upload=10; download=20; total=100",
      },
    });
  };

  const subscriptions = [
    { id: 1, url: "https://enabled.example/sub", type: "subscription", active: 1 },
    { id: 2, url: "https://disabled.example/sub", type: "subscription", active: 0 },
    { id: 3, url: "https://failed.example/sub", type: "subscription", active: 1 },
  ];
  const app = express();
  app.use(
    createSubscriptionRoutes({
      getAllSubscriptions: async () => subscriptions,
      getSubscriptionsByGroup: async () => subscriptions,
    })
  );

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    global.fetch = originalFetch;
    server.close();
  });

  const { port } = server.address();
  const response = await originalFetch(
    `http://127.0.0.1:${port}/api/subscriptions/usage?refresh=1&ids=1,2,3`
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(fetchedUrls, [
    "https://enabled.example/sub",
    "https://failed.example/sub",
  ]);
  assert.deepEqual(body.data[1], {
    id: 2,
    userinfo: { upload: 0, download: 0, total: 0, expire: 0 },
    skipped: true,
    skipReason: "inactive",
    updatedAt: 0,
    isStale: false,
  });
  assert.equal(body.data[2].id, 3);
  assert.equal(body.data[2].error, "fetch_failed");
  assert.equal(body.data[2].isStale, true);
});
