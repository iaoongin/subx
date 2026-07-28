const USAGE_TTL_MS = 3 * 60 * 1000;
const USAGE_TIMEOUT_MS = 8000;
const usageCache = new Map();

function createEmptyUserinfo() {
  return { upload: 0, download: 0, total: 0, expire: 0 };
}

function isActiveSubscription(sub) {
  return sub.active === 1 || sub.active === true || sub.active === "1";
}

function parseUserinfoHeader(infoStr) {
  const userinfo = createEmptyUserinfo();
  if (!infoStr) return userinfo;

  infoStr.split(";").forEach((pair) => {
    const [key, value] = pair.split("=").map((item) => item.trim());
    if (["upload", "download", "total", "expire"].includes(key)) {
      userinfo[key] = Number(value) || 0;
    }
  });

  return userinfo;
}

function getCachedUsage(sub) {
  const cached = usageCache.get(String(sub.id));
  if (!cached || cached.url !== sub.url) return null;
  return cached;
}

function setCachedUsage(sub, userinfo) {
  const now = Date.now();
  usageCache.set(String(sub.id), {
    url: sub.url,
    userinfo,
    updatedAt: now,
    expiresAt: now + USAGE_TTL_MS,
    refreshing: false,
  });
}

function markRefreshing(sub, refreshing) {
  const cached = getCachedUsage(sub);
  if (!cached) return;
  cached.refreshing = refreshing;
  usageCache.set(String(sub.id), cached);
}

async function fetchSubscriptionUsage(sub) {
  if (!sub.url) return createEmptyUserinfo();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), USAGE_TIMEOUT_MS);
  try {
    const response = await fetch(sub.url, {
      headers: { "User-Agent": "Clash Verge" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`status ${response.status}`);
    return parseUserinfoHeader(response.headers.get("subscription-userinfo"));
  } finally {
    clearTimeout(timeout);
  }
}

function refreshUsageInBackground(sub) {
  const cached = getCachedUsage(sub);
  if (!cached || cached.refreshing) return;

  markRefreshing(sub, true);
  fetchSubscriptionUsage(sub)
    .then((userinfo) => setCachedUsage(sub, userinfo))
    .catch((error) => console.error("Background usage refresh failed", sub.url, error))
    .finally(() => markRefreshing(sub, false));
}

async function getCurrentSubscriptionUsage(sub) {
  const cached = getCachedUsage(sub);
  if (cached && Date.now() < cached.expiresAt) return cached.userinfo;

  try {
    const userinfo = await fetchSubscriptionUsage(sub);
    setCachedUsage(sub, userinfo);
    return userinfo;
  } catch (error) {
    if (cached) return cached.userinfo;
    throw error;
  }
}

function isSubscriptionExhausted(userinfo) {
  const total = Number(userinfo?.total) || 0;
  const used = (Number(userinfo?.upload) || 0) + (Number(userinfo?.download) || 0);
  return total > 0 && used >= total;
}

module.exports = {
  createEmptyUserinfo,
  isActiveSubscription,
  getCachedUsage,
  setCachedUsage,
  fetchSubscriptionUsage,
  refreshUsageInBackground,
  getCurrentSubscriptionUsage,
  isSubscriptionExhausted,
};
