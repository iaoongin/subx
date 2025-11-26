/**
 * 身份验证中间件
 * 检查用户是否已通过身份验证
 */
function requireAuth(req, res, next) {
    if (req.session && req.session.authenticated) {
        return next();
    } else {
        return res.status(401).json({ error: "需要身份验证" });
    }
}

/**
 * 检查是否需要身份验证的中间件（排除订阅转换路由）
 * 根据请求路径决定是否需要身份验证
 */
function checkAuthForAdmin(req, res, next) {
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

    next();
}

module.exports = {
    requireAuth,
    checkAuthForAdmin,
};
