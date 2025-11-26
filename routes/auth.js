const express = require("express");
const path = require("path");
const router = express.Router();

/**
 * 创建认证相关路由
 * @param {object} db - 数据库实例
 * @param {function} requireAuth - 认证中间件
 * @returns {Router} Express 路由器
 */
function createAuthRoutes(db, requireAuth) {
    // 登录 API
    router.post("/api/auth/login", async (req, res) => {
        try {
            const { password } = req.body;

            if (!password) {
                return res.status(400).json({ error: "请输入密码" });
            }

            const config = await db.getConfig();

            if (password === config.adminPassword) {
                req.session.authenticated = true;
                req.session.loginTime = new Date().toISOString();
                res.json({ message: "登录成功" });
            } else {
                res.status(401).json({ error: "密码错误" });
            }
        } catch (error) {
            console.error("登录失败:", error);
            res.status(500).json({ error: "服务器错误" });
        }
    });

    // 检查登录状态
    router.get("/api/auth/status", (req, res) => {
        if (req.session && req.session.authenticated) {
            res.json({
                authenticated: true,
                loginTime: req.session.loginTime,
            });
        } else {
            res.status(401).json({ authenticated: false });
        }
    });

    // 登出
    router.post("/api/auth/logout", (req, res) => {
        req.session.destroy((err) => {
            if (err) {
                console.error("登出失败:", err);
                return res.status(500).json({ error: "登出失败" });
            }
            res.json({ message: "登出成功" });
        });
    });

    // 登录页面路由
    router.get("/login", (req, res) => {
        res.sendFile(path.join(__dirname, "..", "public", "login.html"));
    });

    // 管理页面路由（需要身份验证）
    router.get("/admin", requireAuth, (req, res) => {
        res.sendFile(path.join(__dirname, "..", "public", "index.html"));
    });

    // 默认路由重定向到登录页面
    router.get("/", (req, res) => {
        if (req.session && req.session.authenticated) {
            res.redirect("/admin");
        } else {
            res.redirect("/login");
        }
    });

    return router;
}

module.exports = createAuthRoutes;
