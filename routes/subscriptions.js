const express = require("express");
const router = express.Router();
const {
    createEmptyUserinfo,
    isActiveSubscription,
    getCachedUsage,
    setCachedUsage,
    fetchSubscriptionUsage,
    refreshUsageInBackground,
} = require("../services/subscription-usage");
const { getSubscriptionNodeCount } = require("../services/subscription-node-count");

function getFetchErrorReason(error) {
    const reason = error instanceof Error ? error.message : String(error || "");
    return reason || "请求失败";
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
    // Usage info (batch) - 支持 groupId 和 ids 参数
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

            const groupId = req.query.groupId;

            // 根据 groupId 或 ids 获取目标订阅
            let targetSubscriptions;
            if (groupId) {
                // 按分组关联过滤
                const groupSubs = await db.getSubscriptionsByGroup(groupId);
                targetSubscriptions =
                    idSet.size > 0
                        ? groupSubs.filter((sub) => idSet.has(Number(sub.id)))
                        : groupSubs;
            } else {
                const subscriptions = await db.getAllSubscriptions();
                targetSubscriptions =
                    idSet.size > 0
                        ? subscriptions.filter((sub) => idSet.has(Number(sub.id)))
                        : subscriptions;
            }

            const results = await Promise.all(
                targetSubscriptions.map(async (sub) => {
                    const isList = sub.type === "node" || sub.type === "list";
                    const isActive = isActiveSubscription(sub);

                    if (!isActive) {
                        return {
                            id: sub.id,
                            userinfo: createEmptyUserinfo(),
                            skipped: true,
                            skipReason: "inactive",
                            updatedAt: 0,
                            isStale: false,
                        };
                    }

                    if (isList) {
                        return {
                            id: sub.id,
                            userinfo: createEmptyUserinfo(),
                            skipped: true,
                            skipReason: "node_list",
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
                            errorReason: getFetchErrorReason(error),
                            };
                        }
                        return {
                            id: sub.id,
                            userinfo: createEmptyUserinfo(),
                            updatedAt: Date.now(),
                            isStale: true,
                            fromCache: false,
                            error: "fetch_failed",
                            errorReason: getFetchErrorReason(error),
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

    router.get("/api/subscriptions/node-counts", async (req, res) => {
        try {
            const idParam = typeof req.query.ids === "string" ? req.query.ids : "";
            const idSet = new Set(
                idParam
                    .split(",")
                    .map((id) => Number(id.trim()))
                    .filter((id) => Number.isFinite(id))
            );
            const groupId = req.query.groupId;
            const subscriptions = groupId
                ? await db.getSubscriptionsByGroup(groupId)
                : await db.getAllSubscriptions();
            const targets = subscriptions.filter(
                (sub) => idSet.has(Number(sub.id)) && isActiveSubscription(sub) && sub.type !== "list" && sub.type !== "node"
            );

            const results = await Promise.all(
                targets.map(async (sub) => {
                    try {
                        return { id: sub.id, count: await getSubscriptionNodeCount(sub) };
                    } catch (error) {
                        console.error("Failed to count subscription nodes", sub.url, error);
                        return {
                            id: sub.id,
                            count: null,
                            error: "fetch_failed",
                            errorReason: getFetchErrorReason(error),
                        };
                    }
                })
            );

            res.json({ data: results });
        } catch (error) {
            console.error("Failed to count subscription nodes:", error);
            res.status(500).json({ error: "Failed to count subscription nodes" });
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
