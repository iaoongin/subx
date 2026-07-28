const SubscriptionFetcher = require("./native/fetcher");

const NODE_COUNT_TTL_MS = 3 * 60 * 1000;
const nodeCountCache = new Map();
const fetcher = new SubscriptionFetcher();

async function getSubscriptionNodeCount(sub) {
  const cached = nodeCountCache.get(String(sub.id));
  if (cached && cached.url === sub.url && Date.now() < cached.expiresAt) {
    return cached.count;
  }

  const result = await fetcher.fetch(sub.url);
  if (!result.success) {
    throw new Error(result.error || "failed to fetch subscription");
  }

  const count = result.nodes.length;
  nodeCountCache.set(String(sub.id), {
    url: sub.url,
    count,
    expiresAt: Date.now() + NODE_COUNT_TTL_MS,
  });
  return count;
}

module.exports = { getSubscriptionNodeCount };
