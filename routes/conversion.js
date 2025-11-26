const express = require("express");
const router = express.Router();
const {
    detectSubscriptionFormat,
    ADD,
    fetchInBatches,
    getConverterConfig,
} = require("../services/converter");
const { base64Encode } = require("../utils/encoding");

/**
 * 创建订阅转换路由
 * @param {object} db - 数据库实例
 * @returns {Router} Express 路由器
 */
function createConversionRoutes(db) {
    // 默认订阅数据（为空，将从数据库动态获取）
    let MainData = "";

    router.get("/:path", async (req, res) => {
        try {
            const token = req.query.token || "";
            const pathToken = req.params.path;

            // 从数据库动态获取配置
            const config = await db.getConfig();

            // 使用环境变量覆盖配置数据库值
            const currentToken = process.env.TOKEN || config.token;
            const currentBotToken = process.env.TGTOKEN || config.botToken;
            const currentChatID = process.env.TGID || config.chatId;
            const currentTG = process.env.TG ? Number(process.env.TG) : config.tg;
            const currentFileName = process.env.SUBNAME || config.fileName;
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
            console.log("订阅格式: ", 订阅格式);

            // 从数据库获取活跃的订阅地址
            let 订阅转换URL;
            try {
                const activeUrls = await db.getActiveSubscriptionUrls();
                if (activeUrls.length === 0) {
                    // 如果数据库中没有活跃订阅，使用默认数据
                    console.log("数据库中没有活跃订阅，使用默认数据");
                    订阅转换URL = await ADD(MainData);
                } else {
                    console.log("从数据库获取到", activeUrls.length, "个活跃订阅");
                    订阅转换URL = activeUrls;
                    console.log("订阅转换URL: ", 订阅转换URL);
                }
            } catch (dbError) {
                console.error("数据库查询失败，使用默认数据:", dbError);
                订阅转换URL = await ADD(MainData);
            }
            let 订阅转换URLs = 订阅转换URL.join("|");
            console.log("订阅转换URLs: ", 订阅转换URLs);

            let 编码后的订阅URLs = encodeURIComponent(订阅转换URLs);

            let subContent = "";
            const { subProtocol, subConverter } = getConverterConfig();

            if (订阅格式 === "ss") {
                // 协议数组
                const 协议列表 = ["ss", "ssr", "v2ray", "trojan"];
                let 合并内容 = await fetchInBatches(协议列表, 编码后的订阅URLs);
                // 最终 Base64 编码
                subContent = base64Encode(合并内容.trim());
            } else {
                let subConverterUrl = `${subProtocol}://${subConverter}/sub?target=${订阅格式}&url=${编码后的订阅URLs}&emoji=true&list=false&tfo=false&scv=true&fdn=false&sort=false&new_name=true`;
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

            res.set({
                "content-type": "text/plain; charset=utf-8",
                "Profile-Update-Interval": currentSUBUpdateTime.toString(),
            });

            res.send(subContent);
        } catch (error) {
            console.error("错误:", error);
            res.status(500).send("服务器内部错误");
        }
    });

    return router;
}

module.exports = createConversionRoutes;
