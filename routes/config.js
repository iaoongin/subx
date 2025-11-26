const express = require("express");
const router = express.Router();

/**
 * 创建配置管理相关路由
 * @param {object} db - 数据库实例
 * @returns {Router} Express 路由器
 */
function createConfigRoutes(db) {
    // 获取所有配置
    router.get("/api/config", async (req, res) => {
        try {
            const config = await db.getConfig();
            res.json(config);
        } catch (error) {
            console.error("获取配置失败:", error);
            res.status(500).json({ error: "获取配置失败" });
        }
    });

    // 更新配置
    router.put("/api/config", async (req, res) => {
        try {
            const newConfig = req.body;
            const result = await db.updateConfig(newConfig);
            res.json({ message: "配置更新成功", config: result.config });
        } catch (error) {
            console.error("更新配置失败:", error);
            res.status(500).json({ error: "更新配置失败" });
        }
    });

    // 获取特定配置项
    router.get("/api/config/:key", async (req, res) => {
        try {
            const { key } = req.params;
            const value = await db.getConfigValue(key);
            res.json({ key, value });
        } catch (error) {
            console.error("获取配置项失败:", error);
            res.status(500).json({ error: "获取配置项失败" });
        }
    });

    // 设置特定配置项
    router.put("/api/config/:key", async (req, res) => {
        try {
            const { key } = req.params;
            const { value } = req.body;
            await db.setConfigValue(key, value);
            res.json({ message: "配置项更新成功", key, value });
        } catch (error) {
            console.error("设置配置项失败:", error);
            res.status(500).json({ error: "设置配置项失败" });
        }
    });

    // 重置配置为默认值
    router.post("/api/config/reset", async (req, res) => {
        try {
            const result = await db.resetConfig();
            res.json({ message: "配置重置成功", config: result.config });
        } catch (error) {
            console.error("重置配置失败:", error);
            res.status(500).json({ error: "重置配置失败" });
        }
    });

    return router;
}

module.exports = createConfigRoutes;
