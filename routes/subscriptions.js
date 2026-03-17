const express = require("express");
const router = express.Router();

const USAGE_TTL_MS = 3 * 60 * 1000;
const USAGE_TIMEOUT_MS = 8000;
const usageCache = new Map();

function createEmptyUserinfo() {
    return { upload: 0, download: 0, total: 0, expire: 0 };
}

function parseUserinfoHeader(infoStr) {
    const userinfo = createEmptyUserinfo();
    if (!infoStr) return userinfo;

    infoStr.split(";").forEach((pair) => {
        const [key, value] = pair.split("=").map((s) => s.trim());
        if (["upload", "download", "total", "expire"].includes(key)) {
            userinfo[key] = Number(value) || 0;
        }
    });

    return userinfo;
}

function getCachedUsage(sub) {
    const key = String(sub.id);
    const cached = usageCache.get(key);
    if (!cached) return null;
    if (cached.url !== sub.url) return null;
    return cached;
}

function setCachedUsage(sub, userinfo) {
    const now = Date.now();
    const key = String(sub.id);
    usageCache.set(key, {
        url: sub.url,
        userinfo,
        updatedAt: now,
        expiresAt: now + USAGE_TTL_MS,
        refreshing: false,
    });
}

function markRefreshing(sub, refreshing) {
    const key = String(sub.id);
    const cached = usageCache.get(key);
    if (!cached) return;
    cached.refreshing = refreshing;
    usageCache.set(key, cached);
}

async function fetchSubscriptionUsage(sub) {
    if (!sub.url) return createEmptyUserinfo();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), USAGE_TIMEOUT_MS);

    try {
        const resp = await fetch(sub.url, {
            headers: { "User-Agent": "Clash Verge" },
            signal: controller.signal,
        });

        if (!resp.ok) {
            throw new Error(`status ${resp.status}`);
        }

        const infoStr = resp.headers.get("subscription-userinfo");
        return parseUserinfoHeader(infoStr);
    } finally {
        clearTimeout(timeout);
    }
}

function refreshUsageInBackground(sub) {
    const cached = getCachedUsage(sub);
    if (!cached || cached.refreshing) return;

    markRefreshing(sub, true);
    fetchSubscriptionUsage(sub)
        .then((userinfo) => {
            setCachedUsage(sub, userinfo);
        })
        .catch((error) => {
            console.error("Background usage refresh failed", sub.url, error);
        })
        .finally(() => {
            markRefreshing(sub, false);
        });
}

/**
 * 创建订阅管理相关路由
 * @param {object} db - 数据库实例
 * @returns {Router} Express 路由器
 */
function createSubscriptionRoutes(db) {
    // 获取所有订阅地址
    router.get("/api/subscriptions", async (req, res) => {
        try {
            const subscriptions = await db.getAllSubscriptions();
            res.json(subscriptions);
        } catch (error) {
            console.error("Failed to fetch subscriptions:", error);
            res.status(500).json({ error: "Failed to fetch subscriptions" });
        }
    });
    // Usage info (batch)
    router.get("/api/subscriptions/usage", async (req, res) => {
        try {
            const refresh =
                req.query.refresh === "1" ||
                req.query.refresh === "true" ||
                req.query.refresh === "yes";

            const idParam = typeof req.query.ids === "string" ? req.query.ids : "";
            const idSet = new Set(
                idParam
                    .split(",")
                    .map((id) => Number(id.trim()))
                    .filter((id) => Number.isFinite(id))
            );

            const subscriptions = await db.getAllSubscriptions();
            const targetSubscriptions =
                idSet.size > 0
                    ? subscriptions.filter((sub) => idSet.has(Number(sub.id)))
                    : subscriptions;

            const results = await Promise.all(
                targetSubscriptions.map(async (sub) => {
                    const isList = sub.type === "node" || sub.type === "list";
                    if (isList) {
                        return {
                            id: sub.id,
                            userinfo: createEmptyUserinfo(),
                            skipped: true,
                            updatedAt: 0,
                            isStale: false,
                        };
                    }

                    const cached = getCachedUsage(sub);
                    const now = Date.now();

                    if (!refresh && cached && now < cached.expiresAt) {
                        return {
                            id: sub.id,
                            userinfo: cached.userinfo,
                            updatedAt: cached.updatedAt,
                            isStale: false,
                            fromCache: true,
                        };
                    }

                    if (!refresh && cached && now >= cached.expiresAt) {
                        refreshUsageInBackground(sub);
                        return {
                            id: sub.id,
                            userinfo: cached.userinfo,
                            updatedAt: cached.updatedAt,
                            isStale: true,
                            fromCache: true,
                        };
                    }

                    try {
                        const userinfo = await fetchSubscriptionUsage(sub);
                        setCachedUsage(sub, userinfo);
                        return {
                            id: sub.id,
                            userinfo,
                            updatedAt: Date.now(),
                            isStale: false,
                            fromCache: false,
                        };
                    } catch (error) {
                        console.error("Failed to fetch usage", sub.url, error);
                        if (cached) {
                            return {
                                id: sub.id,
                                userinfo: cached.userinfo,
                                updatedAt: cached.updatedAt,
                                isStale: true,
                                fromCache: true,
                                error: "fetch_failed",
                            };
                        }
                        return {
                            id: sub.id,
                            userinfo: createEmptyUserinfo(),
                            updatedAt: Date.now(),
                            isStale: true,
                            fromCache: false,
                            error: "fetch_failed",
                        };
                    }
                })
            );

            res.json({ data: results });
        } catch (error) {
            console.error("Failed to fetch usage info:", error);
            res.status(500).json({ error: "Failed to fetch usage info" });
        }
    });

    // Add subscription
    router.post("/api/subscriptions", async (req, res) => {
        try {
            const { name, url, description, type } = req.body;

            if (!name || !url) {
                return res.status(400).json({ error: "订阅名称和链接不能为空" });
            }

            const result = await db.addSubscription(name, url, description || "", type || "subscription");
            res.json({ message: "订阅添加成功", data: result });
        } catch (error) {
            console.error("添加订阅失败:", error);
            if (error.message.includes("UNIQUE constraint failed")) {
                res.status(400).json({ error: "该订阅链接已存在" });
            } else {
                res.status(500).json({ error: "添加订阅失败" });
            }
        }
    });

    // 更新订阅
    router.put("/api/subscriptions/:id", async (req, res) => {
        try {
            const { id } = req.params;
            const { name, url, description, active, type } = req.body;

            if (!name || !url) {
                return res.status(400).json({ error: "订阅名称和链接不能为空" });
            }

            const result = await db.updateSubscription(
                id,
                name,
                url,
                description || "",
                type || "subscription",
                active
            );

            if (result.changes === 0) {
                return res.status(404).json({ error: "订阅不存在" });
            }

            res.json({ message: "订阅更新成功" });
        } catch (error) {
            console.error("更新订阅失败:", error);
            if (error.message.includes("UNIQUE constraint failed")) {
                res.status(400).json({ error: "该订阅链接已存在" });
            } else {
                res.status(500).json({ error: "更新订阅失败" });
            }
        }
    });

    // 删除订阅
    router.delete("/api/subscriptions/:id", async (req, res) => {
        try {
            const { id } = req.params;
            const result = await db.deleteSubscription(id);

            if (result.changes === 0) {
                return res.status(404).json({ error: "订阅不存在" });
            }

            res.json({ message: "订阅删除成功" });
        } catch (error) {
            console.error("删除订阅失败:", error);
            res.status(500).json({ error: "删除订阅失败" });
        }
    });

    // 切换订阅状态
    router.post("/api/subscriptions/:id/toggle", async (req, res) => {
        try {
            const { id } = req.params;
            const result = await db.toggleSubscription(id);

            if (result.changes === 0) {
                return res.status(404).json({ error: "订阅不存在" });
            }

            res.json({ message: "订阅状态更新成功" });
        } catch (error) {
            console.error("切换订阅状态失败:", error);
            res.status(500).json({ error: "切换订阅状态失败" });
        }
    });

    return router;
}

module.exports = createSubscriptionRoutes;
