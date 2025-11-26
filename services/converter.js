const { fetchWithRetry } = require('../utils/network');
const { base64Decode, base64Encode } = require('../utils/encoding');

// 默认服务配置（非敏感信息）
let subConverter = "subc.00321.xyz";
let subConfig =
    "https://raw.githubusercontent.com/cmliu/ACL4SSR/main/Clash/config/ACL4SSR_Online_MultiCountry.ini";
let subProtocol = "https";

/**
 * 批量拉取订阅数据并合并
 * @param {Array<string>} 协议列表 - 订阅协议列表
 * @param {string} 编码后的订阅URLs - URL编码后的订阅地址
 * @returns {Promise<string>} 合并后的订阅内容
 */
async function fetchInBatches(协议列表, 编码后的订阅URLs) {
    // 构造所有请求的 Promise 数组
    const fetchPromises = 协议列表.map(async (协议) => {
        let url = `${subProtocol}://${subConverter}/sub?target=${协议}&url=${编码后的订阅URLs}&emoji=true&list=false&tfo=false&scv=true&fdn=false&sort=false&new_name=true`;
        console.log("subConverterUrl: ", url);

        try {
            const resp = await fetchWithRetry(url, {
                headers: { "User-Agent": "Node-fetch", Accept: "*/*" },
            }, 3, 30000);
            let text = await resp.text();
            return base64Decode(text.trim());
        } catch (err) {
            console.error("请求异常（所有重试均失败）:", err.message);
            return ""; // 出错返回空字符串，避免 Promise.all 拒绝
        }
    });

    // 等待所有请求完成
    const results = await Promise.all(fetchPromises);

    // 合并所有结果，之间用换行隔开
    return results.join("\n") + "\n";
}

/**
 * 解析订阅地址
 * @param {string} envAdd - 订阅地址字符串
 * @returns {Promise<Array<string>>} 订阅地址数组
 */
async function ADD(envAdd) {
    let addText = envAdd.replace(/[\t"'|\r\n]+/g, "\n").replace(/\n+/g, "\n");
    if (addText.charAt(0) === "\n") addText = addText.slice(1);
    if (addText.charAt(addText.length - 1) === "\n")
        addText = addText.slice(0, addText.length - 1);
    const add = addText.split("\n");
    console.log("节点列表:", add);
    return add;
}

/**
 * 根据 User-Agent 检测订阅格式
 * @param {string} userAgentHeader - User-Agent 请求头
 * @param {object} query - 查询参数
 * @returns {string} 订阅格式
 */
function detectSubscriptionFormat(userAgentHeader, query) {
    userAgentHeader = userAgentHeader.toLowerCase();

    if (
        userAgentHeader.includes("null") ||
        userAgentHeader.includes("subconverter") ||
        userAgentHeader.includes("nekobox") ||
        userAgentHeader.includes("cf-workers-sub")
    ) {
        return "ss";
    } else if (
        userAgentHeader.includes("clash") ||
        ("clash" in query && !userAgentHeader.includes("subconverter"))
    ) {
        return "clash";
    } else if (
        userAgentHeader.includes("sing-box") ||
        userAgentHeader.includes("singbox") ||
        (("sb" in query || "singbox" in query) &&
            !userAgentHeader.includes("subconverter"))
    ) {
        return "singbox";
    } else if (
        userAgentHeader.includes("surge") ||
        ("surge" in query && !userAgentHeader.includes("subconverter"))
    ) {
        return "surge";
    } else if (
        userAgentHeader.includes("quantumult%20x") ||
        ("quanx" in query && !userAgentHeader.includes("subconverter"))
    ) {
        return "quanx";
    } else if (
        userAgentHeader.includes("loon") ||
        ("loon" in query && !userAgentHeader.includes("subconverter"))
    ) {
        return "loon";
    }

    return "ss";
}

/**
 * 设置订阅转换器配置
 * @param {string} converter - 转换器地址
 * @param {string} config - 配置地址
 */
function setConverterConfig(converter, config) {
    if (converter) {
        if (converter.startsWith("http://")) {
            subConverter = converter.split("//")[1];
            subProtocol = "http";
        } else {
            subConverter = converter.split("//")[1] || converter;
            subProtocol = "https";
        }
    }
    if (config) {
        subConfig = config;
    }
}

/**
 * 获取当前订阅转换器配置
 * @returns {object} 转换器配置
 */
function getConverterConfig() {
    return {
        subConverter,
        subConfig,
        subProtocol,
    };
}

module.exports = {
    fetchInBatches,
    ADD,
    detectSubscriptionFormat,
    setConverterConfig,
    getConverterConfig,
};
