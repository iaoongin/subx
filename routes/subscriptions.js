const express = require("express");
const router = express.Router();

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
            // 实时拉取每个订阅的流量信息，接口为订阅的 url 字段
            const result = await Promise.all(
                subscriptions.map(async (sub) => {
                    let userinfo = { upload: 0, download: 0, total: 0, expire: 0 };
                    // 如果是单节点类型，直接跳过流量查询
                    if (sub.type === 'node') {
                        return { ...sub, userinfo };
                    }

                    try {
                        if (sub.url) {
                            const resp = await fetch(sub.url, {
                                headers: { "User-Agent": "Clash" },
                            });
                            if (resp.ok) {
                                // 从响应头获取 subscription-userinfo
                                const infoStr = resp.headers.get("subscription-userinfo");
                                if (infoStr) {
                                    // 解析格式：upload=...; download=...; total=...; expire=...
                                    infoStr.split(";").forEach((pair) => {
                                        const [key, value] = pair.split("=").map((s) => s.trim());
                                        if (["upload", "download", "total", "expire"].includes(key)) {
                                            userinfo[key] = Number(value) || 0;
                                        }
                                    });
                                }
                            }
                        }
                    } catch (e) {
                        console.error("拉取流量信息失败", sub.url, e);
                    }
                    return { ...sub, userinfo };
                })
            );
            res.json(result);
        } catch (error) {
            console.error("获取订阅列表失败:", error);
            res.status(500).json({ error: "获取订阅列表失败" });
        }
    });

    // 添加新订阅
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
                active !== undefined ? active : 1
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
