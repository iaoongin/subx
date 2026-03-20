const express = require("express");
const router = express.Router();

/**
 * 创建分组管理路由
 * @param {object} db - 数据库实例
 * @returns {Router} Express 路由器
 */
function createGroupRoutes(db) {
  // 获取所有分组
  router.get("/api/groups", async (req, res) => {
    try {
      const groups = await db.getGroups();
      res.json(groups);
    } catch (error) {
      console.error("获取分组列表失败:", error);
      res.status(500).json({ error: "获取分组列表失败" });
    }
  });

  // 添加分组
  router.post("/api/groups", async (req, res) => {
    try {
      const { name, token } = req.body;

      if (!name || !token) {
        return res.status(400).json({ error: "分组名称和 Token 不能为空" });
      }

      const group = await db.addGroup(name, token);
      res.json({ message: "分组创建成功", data: group });
    } catch (error) {
      console.error("创建分组失败:", error);
      if (error.message.includes("Token")) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "创建分组失败" });
      }
    }
  });

  // 更新分组
  router.put("/api/groups/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { name, token } = req.body;

      if (!name || !token) {
        return res.status(400).json({ error: "分组名称和 Token 不能为空" });
      }

      const result = await db.updateGroup(id, name, token);
      if (result.changes === 0) {
        return res.status(404).json({ error: "分组不存在" });
      }

      res.json({ message: "分组更新成功", data: result.group });
    } catch (error) {
      console.error("更新分组失败:", error);
      if (error.message.includes("Token")) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "更新分组失败" });
      }
    }
  });

  // 删除分组
  router.delete("/api/groups/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const result = await db.deleteGroup(id);

      if (result.changes === 0) {
        return res.status(404).json({ error: "分组不存在" });
      }

      res.json({ message: "分组删除成功" });
    } catch (error) {
      console.error("删除分组失败:", error);
      res.status(500).json({ error: "删除分组失败" });
    }
  });

  // 获取分组下的订阅列表
  router.get("/api/groups/:id/subscriptions", async (req, res) => {
    try {
      const { id } = req.params;
      const subscriptions = await db.getSubscriptionsByGroup(id);
      res.json(subscriptions);
    } catch (error) {
      console.error("获取分组订阅失败:", error);
      res.status(500).json({ error: "获取分组订阅失败" });
    }
  });

  // 绑定订阅到分组
  router.post("/api/groups/:id/subscriptions", async (req, res) => {
    try {
      const { id } = req.params;
      const { subscriptionId } = req.body;

      if (!subscriptionId) {
        return res.status(400).json({ error: "订阅 ID 不能为空" });
      }

      await db.attachSubscriptionToGroup(id, subscriptionId);
      res.json({ message: "订阅关联成功" });
    } catch (error) {
      console.error("关联订阅失败:", error);
      if (
        error.message.includes("不存在") ||
        error.message.includes("已关联")
      ) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "关联订阅失败" });
      }
    }
  });

  // 从分组中解绑订阅
  router.delete(
    "/api/groups/:id/subscriptions/:subscriptionId",
    async (req, res) => {
      try {
        const { id, subscriptionId } = req.params;
        const result = await db.detachSubscriptionFromGroup(id, subscriptionId);

        if (result.changes === 0) {
          return res.status(404).json({ error: "关联关系不存在" });
        }

        res.json({ message: "订阅解绑成功" });
      } catch (error) {
        console.error("解绑订阅失败:", error);
        res.status(500).json({ error: "解绑订阅失败" });
      }
    }
  );

  return router;
}

module.exports = createGroupRoutes;
