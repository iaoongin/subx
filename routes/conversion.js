const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const {
    detectSubscriptionFormat,
    ADD,
    fetchInBatches,
    getConverterConfig,
} = require("../services/converter");
const { applyExtensionScriptToContent, getExtensionScript, normalizeScript } = require("../services/extension-script");
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
     * @param {object} group - 分组对象
     * @param {string} format - 订阅格式
     * @param {string} mode - 转换模式
     * @param {number} ttl - 缓存有效期（小时）
     */
    async function refreshInBackground(cacheKey, group, format, mode, ttl) {
        try {
            console.log(`后台刷新缓存: ${cacheKey}`);
            cache.markRefreshing(cacheKey, true);

            // 执行订阅转换
            const content = await fetchSubscriptionContent(group, format, mode);

            // 更新缓存
            cache.set(cacheKey, content, format, ttl);
            console.log(`后台刷新完成: ${cacheKey}`);
        } catch (error) {
            console.error(`后台刷新失败: ${cacheKey}`, error);
        } finally {
            cache.markRefreshing(cacheKey, false);
        }
    }

    /**
     * 获取订阅内容（按分组）
     * @param {object} group - 分组对象
     * @param {string} format - 订阅格式
     * @param {string} mode - 转换模式
     * @returns {Promise<string>} 订阅内容
     */
    async function fetchSubscriptionContent(group, format, mode) {
        const conversionStart = Date.now();
        const maskedToken = group.token ? `${group.token.slice(0, 4)}***` : "empty";
        console.log(
            `[conversion-start] group=${group.name}, token=${maskedToken}, format=${format}, mode=${mode || "auto"}`
        );

        // 从数据库获取该分组下活跃的订阅和全局配置
        let activeUrls;
        let activeSubscriptions;
        let config;

        try {
            activeSubscriptions = await db.getActiveSubscriptionsByGroup(group.id);
            config = await db.getConfig();

            if (activeSubscriptions.length === 0) {
                console.log("数据库中没有活跃订阅，使用默认数据");
                activeUrls = await ADD(MainData);
            } else {
                activeUrls = expandSubscriptionUrls(activeSubscriptions);
                console.log("从数据库获取到", activeSubscriptions.length, "个活跃订阅，展开为", activeUrls.length, "条链接");
            }
        } catch (dbError) {
            console.error("数据库查询失败，使用默认数据:", dbError);
            activeUrls = await ADD(MainData);
            config = {
                conversionMode: 'remote',
                fallbackEnabled: true,
                nativeConverterEnabled: true,
                fileName: "SubX",
            };
        }

        // 确定转换模式：URL参数 > 环境变量 > 配置 > 默认值
        const conversionMode = mode ||
                               process.env.CONVERSION_MODE ||
                               config.conversionMode ||
                               'remote';

        console.log(`转换模式: ${conversionMode}`);
        const extensionScript = getExtensionScript();

        let subContent;

        // 原生转换
        if (conversionMode === 'native' && config.nativeConverterEnabled) {
            try {
                console.log('使用原生转换器');
                const NativeConverter = require('../services/native');
                const converter = new NativeConverter();
                subContent = await converter.convert(activeUrls, format);
            } catch (error) {
                console.error('原生转换失败:', error);

                // 降级到远程转换
                if (config.fallbackEnabled) {
                    console.warn('降级到远程转换器（fallbackEnabled=true）');
                    subContent = await convertWithRemote(activeUrls, format, config);
                } else {
                    throw error;
                }
            }
        } else {
            // 远程转换
            subContent = await convertWithRemote(activeUrls, format, config);
        }

        subContent = applyExtensionScriptToContent(
            extensionScript,
            subContent,
            format,
            config.fileName || "SubX",
        );

        const durationMs = Date.now() - conversionStart;
        console.log(
            `[conversion-end] format=${format}, mode=${conversionMode}, durationMs=${durationMs}`
        );
        return subContent;
    }

    /**
     * 使用远程转换器转换订阅
     * @param {Array<string>} subscriptionUrls - 订阅URL列表
     * @param {string} format - 订阅格式
     * @param {object} config - 配置对象
     * @returns {Promise<string>} 订阅内容
     */
    async function convertWithRemote(subscriptionUrls, format, config) {
        let 订阅转换URLs = subscriptionUrls.join("|");
        let 编码后的订阅URLs = encodeURIComponent(订阅转换URLs);

        const { subProtocol, subConverter } = getConverterConfig();

        if (format === "ss") {
            // 协议数组
            const 协议列表 = ["ss", "ssr", "v2ray", "trojan"];
            let 合并内容 = await fetchInBatches(协议列表, 编码后的订阅URLs);
            // 最终 Base64 编码
            return base64Encode(合并内容.trim());
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
            return await response.text();
        }
    }

    function expandSubscriptionUrls(subscriptions) {
        const urls = [];
        for (const sub of subscriptions) {
            if (!sub || !sub.url) continue;
            if (sub.type === "list" || sub.type === "node") {
                const parts = sub.url
                    .split(/[\r\n,;]+/)
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0);
                urls.push(...parts);
            } else {
                urls.push(sub.url);
            }
        }
        return urls;
    }

    router.get("/:path", async (req, res) => {
        const requestStart = Date.now();
        const requestId = `${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;

        try {
            const pathToken = req.params.path;
            const forceRefresh = req.query.refresh === 'true';
            const mode = req.query.mode; // 获取转换模式参数

            console.log(
                `[request-start][${requestId}] path=${req.params.path}, refresh=${forceRefresh}, mode=${mode || "auto"}`
            );

            // 从数据库动态获取配置
            const config = await db.getConfig();
            const currentSUBUpdateTime = config.subUpdateTime;

            // 按分组 token 查找分组，兼容旧的 config.token
            let group = await db.getGroupByToken(pathToken);

            // 兼容旧逻辑：query 参数中的 token
            if (!group) {
                const queryToken = req.query.token || "";
                if (queryToken) {
                    group = await db.getGroupByToken(queryToken);
                }
            }

            if (!group) {
                res
                    .status(403)
                    .type("text/plain; charset=utf-8")
                    .set("Profile-Update-Interval", currentSUBUpdateTime.toString());
                return res.send("oh no!");
            }

            const userAgentHeader = (req.headers["user-agent"] || "").toLowerCase();
            const 订阅格式 = detectSubscriptionFormat(userAgentHeader, req.query);
            const extensionScript = getExtensionScript();
            const extensionScriptHash = crypto
                .createHash("sha1")
                .update(normalizeScript(extensionScript))
                .digest("hex")
                .slice(0, 12);

            // 生成缓存key（包含分组 id 和 mode 参数）
            const cacheKey = cache.generateKey(group.token, 订阅格式, mode, extensionScriptHash);
            console.log(`生成缓存Key: ${cacheKey} (group=${group.name}, token=${group.token}, format=${订阅格式}, mode=${mode}, script=${extensionScriptHash})`);

            // 打印缓存统计
            const stats = cache.getStats();
            console.log(`当前缓存状态: 总数=${stats.size}, keys=${stats.keys.join(', ')}`);

            // 如果不是强制刷新，尝试从缓存获取
            if (!forceRefresh) {
                const cached = cache.get(cacheKey);
                console.log(`缓存查询结果: ${cached ? '命中' : '未命中'}`);
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
                    console.log(
                        `[request-end][${requestId}] source=cache, cache=${isValid ? "HIT" : "STALE"}, durationMs=${Date.now() - requestStart}`
                    );

                    // 如果缓存过期且未在刷新中，后台异步刷新
                    if (!isValid && !cached.refreshing) {
                        // 异步刷新，不阻塞响应
                        refreshInBackground(cacheKey, group, 订阅格式, mode, currentSUBUpdateTime);
                    }

                    return;
                }
            }

            // 强制刷新或无缓存：同步获取
            if (forceRefresh) {
                console.log(`强制刷新: 全量清空缓存, cacheKey=${cacheKey}`);
                cache.clear();
            } else {
                console.log(`缓存未命中: ${cacheKey}`);
            }

            const subContent = await fetchSubscriptionContent(group, 订阅格式, mode);

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
            console.log(
                `[request-end][${requestId}] source=upstream, cache=${forceRefresh ? "REFRESH" : "MISS"}, durationMs=${Date.now() - requestStart}`
            );
        } catch (error) {
            console.error(`[request-failed][${requestId}]`, error);
            res.status(500).send("服务器内部错误");
        }
    });

    return router;
}

module.exports = createConversionRoutes;
