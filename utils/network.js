const os = require('os');

/**
 * 带超时和重试的 fetch 函数
 * @param {string} url - 请求的 URL
 * @param {object} options - fetch 选项
 * @param {number} retries - 重试次数，默认为 3
 * @param {number} timeout - 超时时间（毫秒），默认为 30000
 * @returns {Promise<Response>} fetch 响应
 */
async function fetchWithRetry(url, options = {}, retries = 3, timeout = 30000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            // 创建超时控制器
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const resp = await fetch(url, {
                ...options,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);
            return resp;
        } catch (err) {
            console.error(`请求失败 (尝试 ${attempt}/${retries}):`, err.message);

            // 如果是最后一次尝试，抛出错误
            if (attempt === retries) {
                throw err;
            }

            // 等待一段时间后重试 (指数退避)
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
            console.log(`等待 ${delay}ms 后重试...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

/**
 * 获取本机所有网卡的 IPv4 地址
 * @param {number} port - 端口号
 * @returns {Array<string>} IP 地址数组，格式为 http://ip:port
 */
function getLocalIPAddresses(port) {
    const networkInterfaces = os.networkInterfaces();
    const addresses = [];

    // 获取所有网卡的IPv4地址
    Object.keys(networkInterfaces).forEach((interfaceName) => {
        const interfaces = networkInterfaces[interfaceName];
        interfaces.forEach((iface) => {
            // 只显示IPv4地址且非内部地址
            if (iface.family === 'IPv4' && !iface.internal) {
                // 排除链路本地地址 (169.254.x.x)
                if (!iface.address.startsWith('169.254')) {
                    addresses.push(iface.address);
                }
            }
        });
    });

    // 优先级排序: 192.168 > 10 > 172 > 其他
    const getScore = (ip) => {
        if (ip.startsWith('192.168.')) return 4;
        if (ip.startsWith('10.')) return 3;
        if (ip.startsWith('172.')) return 2;
        return 1;
    };

    addresses.sort((a, b) => getScore(b) - getScore(a));

    // 如果存在高优先级的常用局域网地址 (192.168.x.x 或 10.x.x.x)，则只显示这些
    // 这样可以过滤掉 Docker/WSL 等虚拟网卡的地址 (通常是 172.x.x.x) 和其他 VPN 地址
    const highPriority = addresses.filter(ip => getScore(ip) >= 3);

    const finalAddresses = highPriority.length > 0 ? highPriority : addresses;

    return finalAddresses.map(ip => `http://${ip}:${port}`);
}

module.exports = {
    fetchWithRetry,
    getLocalIPAddresses,
};
