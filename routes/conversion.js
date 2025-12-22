const express = require("express");
const router = express.Router();
const {
    detectSubscriptionFormat,
    ADD,
    fetchInBatches,
    getConverterConfig,
} = require("../services/converter");
const { base64Encode } = require("../utils/encoding");
const cache = require("../services/cache");

/**
 * 创建订阅转换路由
 * @param {object} db - 数据库实例
 * @returns {Router} Express 路由器
 */
function createConversionRoutes(db) {
    // 默认订阅数据（为空，将从数据库动态获取）
    let MainData = "";

    /**
     * 后台异步刷新缓存
     * @param {string} cacheKey - 缓存key
     * @param {string} token - 用户token
     * @param {string} format - 订阅格式
     * @param {number} ttl - 缓存有效期（小时）
     */
    async function refreshInBackground(cacheKey, token, format, ttl) {
        try {
            console.log(`后台刷新缓存: ${cacheKey}`);
            cache.markRefreshing(cacheKey, true);

            // 执行订阅转换
            const content = await fetchSubscriptionContent(token, format);

            // 更新缓存
            cache.set(cacheKey, content, format, ttl);
            console.log(`后台刷新完成: ${cacheKey}`);
        } catch (error) {
            console.error(`后台刷新失败: ${cacheKey}`, error.message);
        } finally {
            cache.markRefreshing(cacheKey, false);
        }
    }

    /**
     * 获取订阅内容
     * @param {string} token - 用户token
     * @param {string} format - 订阅格式
     * @returns {Promise<string>} 订阅内容
     */
    async function fetchSubscriptionContent(token, format) {
        // 从数据库获取活跃的订阅地址
        let 订阅转换URL;
        try {
            const activeUrls = await db.getActiveSubscriptionUrls();
            if (activeUrls.length === 0) {
                console.log("数据库中没有活跃订阅，使用默认数据");
                订阅转换URL = await ADD(MainData);
            } else {
                console.log("从数据库获取到", activeUrls.length, "个活跃订阅");
                订阅转换URL = activeUrls;
            }
        } catch (dbError) {
            console.error("数据库查询失败，使用默认数据:", dbError);
            订阅转换URL = await ADD(MainData);
        }

        let 订阅转换URLs = 订阅转换URL.join("|");
        let 编码后的订阅URLs = encodeURIComponent(订阅转换URLs);

        let subContent = "";
        const { subProtocol, subConverter } = getConverterConfig();

        if (format === "ss") {
            // 协议数组
            const 协议列表 = ["ss", "ssr", "v2ray", "trojan"];
            let 合并内容 = await fetchInBatches(协议列表, 编码后的订阅URLs);
            // 最终 Base64 编码
            subContent = base64Encode(合并内容.trim());
        } else {
            let subConverterUrl = `${subProtocol}://${subConverter}/sub?target=${format}&url=${编码后的订阅URLs}&emoji=true&list=false&tfo=false&scv=true&fdn=false&sort=false&new_name=true`;
            console.log("subConverterUrl: ", subConverterUrl);
            const response = await fetch(subConverterUrl, {
                headers: {
                    "User-Agent": "Node-fetch",
                    Accept: "*/*",
                },
                redirect: "manual",
            });
            subContent = await response.text();
        }

        return subContent;
    }

    router.get("/:path", async (req, res) => {
        try {
            const token = req.query.token || "";
            const pathToken = req.params.path;
            const forceRefresh = req.query.refresh === 'true';

            // 从数据库动态获取配置
            const config = await db.getConfig();

            // 使用环境变量覆盖配置数据库值
            const currentToken = process.env.TOKEN || config.token;
            const currentSUBUpdateTime = config.subUpdateTime;

            if (token !== currentToken && pathToken !== currentToken) {
                res
                    .status(403)
                    .type("text/plain; charset=utf-8")
                    .set("Profile-Update-Interval", currentSUBUpdateTime.toString());
                return res.send("oh no!");
            }

            const userAgentHeader = (req.headers["user-agent"] || "").toLowerCase();
            const 订阅格式 = detectSubscriptionFormat(userAgentHeader, req.query);

            // 生成缓存key
            const cacheKey = cache.generateKey(currentToken, 订阅格式);

            // 如果不是强制刷新，尝试从缓存获取
            if (!forceRefresh) {
                const cached = cache.get(cacheKey);
                if (cached) {
                    const isValid = cache.isValid(cached);
                    const cacheAge = cache.getCacheAge(cached);

                    console.log(`缓存命中: ${cacheKey}, isValid=${isValid}, age=${cacheAge}`);

                    // 立即返回缓存（即使过期）
                    res.set({
                        "content-type": "text/plain; charset=utf-8",
                        "Profile-Update-Interval": currentSUBUpdateTime.toString(),
                        "X-Cache": isValid ? "HIT" : "STALE",
                        "X-Cache-Age": cacheAge.toString(),
                    });
                    res.send(cached.content);

                    // 如果缓存过期且未在刷新中，后台异步刷新
                    if (!isValid && !cached.refreshing) {
                        // 异步刷新，不阻塞响应
                        refreshInBackground(cacheKey, currentToken, 订阅格式, currentSUBUpdateTime);
                    }

                    return;
                }
            }

            // 强制刷新或无缓存：同步获取
            if (forceRefresh) {
                console.log(`强制刷新: ${cacheKey}`);
                cache.delete(cacheKey);
            } else {
                console.log(`缓存未命中: ${cacheKey}`);
            }

            const subContent = await fetchSubscriptionContent(currentToken, 订阅格式);

            // 更新缓存
            cache.set(cacheKey, subContent, 订阅格式, currentSUBUpdateTime);

            console.log(`准备发送响应: forceRefresh=${forceRefresh}, cacheKey=${cacheKey}`);
            res.set({
                "content-type": "text/plain; charset=utf-8",
                "Profile-Update-Interval": currentSUBUpdateTime.toString(),
                "X-Cache": forceRefresh ? "REFRESH" : "MISS",
                "X-Cache-Age": "0",
            });
            console.log("Headers set:", res.getHeaders());

            res.send(subContent);
        } catch (error) {
            console.error("错误:", error);
            res.status(500).send("服务器内部错误");
        }
    });

    return router;
}

module.exports = createConversionRoutes;
