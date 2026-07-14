/**
 * 创建读取运行时配置的身份验证中间件。
 * @param {object} db - 数据库实例
 * @returns {object} 认证中间件和配置检查函数
 */
function createAuthMiddleware(db) {
    async function isLoginDisabled() {
        const config = await db.getConfig();
        return config.loginDisabled === true;
    }

    async function requireAuth(req, res, next) {
        if (await isLoginDisabled()) {
            return next();
        }

        if (req.session && req.session.authenticated) {
            return next();
        }

        return res.status(401).json({ error: "需要身份验证" });
    }

    async function checkAuthForAdmin(req, res, next) {
        // 排除登录相关路由和订阅转换路由
        const publicPaths = ["/login", "/api/auth/login", "/api/auth/status"];
        const isSubscriptionRoute =
            /^\/[^/]+$/.test(req.path) && req.path !== "/admin";

        if (publicPaths.includes(req.path) || isSubscriptionRoute) {
            return next();
        }

        // 管理相关路由需要身份验证
        if (req.path.startsWith("/admin") || req.path.startsWith("/api/")) {
            return requireAuth(req, res, next);
        }

        return next();
    }

    return { checkAuthForAdmin, isLoginDisabled, requireAuth };
}

module.exports = { createAuthMiddleware };
