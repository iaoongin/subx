/**
 * 订阅源拉取器
 * 负责从订阅 URL 拉取内容并解析节点
 */
const {
    ShadowsocksParser,
    VMessParser,
    TrojanParser,
    VLESSParser,
    Hysteria2Parser,
    YAMLParser
} = require('./parsers');

class SubscriptionFetcher {
    constructor() {
        this.parsers = {
            ss: new ShadowsocksParser(),
            vmess: new VMessParser(),
            trojan: new TrojanParser(),
            vless: new VLESSParser(),
            hysteria2: new Hysteria2Parser()
        };
        this.parserList = Object.values(this.parsers);
        this.yamlParser = new YAMLParser();
    }

    /**
     * 拉取订阅源
     * @param {string} url - 订阅 URL
     * @returns {Promise<object>} { url, nodes, failures, format, success, error }
     */
    async fetch(url) {
        const result = { url, nodes: [], failures: [], format: null, success: false, error: null, attempts: [] };
        try {
            // 直接节点链接（非 http/https）无需拉取，直接解析
            const isDirectNode =
                /^(vmess|vless|ss|trojan|hysteria2):\/\//i.test(url) &&
                !/^https?:\/\//i.test(url);
            if (isDirectNode) {
                result.format = "uri";
                const parsed = this.parseSubscription(url, result.format);
                result.nodes = parsed.nodes || [];
                result.failures = parsed.failures || [];
                result.success = true;
                return result;
            }

            const { response, attempts } = await this.fetchWithRetry(url, 3);
            result.attempts = attempts;
            const content = await response.text();

            result.format = this.detectFormat(content);
            const parsed = this.parseSubscription(content, result.format);
            result.nodes = parsed.nodes || [];
            result.failures = parsed.failures || [];
            result.success = true;
        } catch (error) {
            result.error = error.message;
            result.attempts = error.attempts || [];
        }
        return result;
    }

    /**
     * 带重试的拉取
     * @param {string} url - 订阅 URL
     * @param {number} retries - 重试次数
     * @returns {Promise<Response>} 响应对象
     */
    async fetchWithRetry(url, retries = 3) {
        let lastError;
        const attempts = [];

        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    timeout: 15000
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                return { response, attempts };
            } catch (error) {
                lastError = error;
                attempts.push(`尝试 ${i + 1}/${retries}: ${error.message}`);

                if (i < retries - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
                }
            }
        }

        const err = new Error(lastError.message);
        err.attempts = attempts;
        throw err;
    }

    /**
     * 检测订阅格式
     * @param {string} content - 订阅内容
     * @returns {string} 格式类型: 'base64' | 'yaml' | 'json' | 'uri'
     */
    detectFormat(content) {
        const trimmed = content.trim();

        // 检测 YAML
        if (trimmed.startsWith('proxies:') || trimmed.includes('- name:')) {
            return 'yaml';
        }

        // 检测 JSON
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
                JSON.parse(trimmed);
                return 'json';
            } catch {
                // 不是有效的 JSON
            }
        }

        // 检测 URI 格式 (以协议开头)
        if (/^(vmess|vless|ss|trojan):\/\//i.test(trimmed)) {
            return 'uri';
        }

        // 默认尝试 Base64
        return 'base64';
    }

    /**
     * 解析订阅内容
     * @param {string} content - 订阅内容
     * @param {string} format - 格式类型
     * @returns {Array} 节点列表
     */
    parseSubscription(content, format) {
        if (format === 'base64') {
            return this.parseBase64(content);
        } else if (format === 'uri') {
            return this.parseUri(content);
        } else if (format === 'yaml') {
            return this.parseYaml(content);
        } else if (format === 'json') {
            console.warn('JSON 格式暂不支持原生解析');
            return { nodes: [], failures: [] };
        }

        return { nodes: [], failures: [] };
    }

    /**
     * 解析 Base64 编码的订阅
     * @param {string} content - Base64 内容
     * @returns {Array} 节点列表
     */
    parseBase64(content) {
        try {
            // Base64 解码
            const decoded = Buffer.from(content.trim(), 'base64').toString('utf8');
            return this.parseUri(decoded);
        } catch (error) {
            console.error('Base64 解码失败:', error.message);
            return { nodes: [], failures: [] };
        }
    }

    /**
     * 解析 URI 格式的订阅
     * @param {string} content - URI 内容
     * @returns {Array} 节点列表
     */
    parseUri(content) {
        const nodes = [];
        const lines = content.split('\n');
        const failures = [];

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            const protoMatch = trimmedLine.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//);
            const protocol = protoMatch ? protoMatch[1].toLowerCase() : '';

            // 优先使用协议对应解析器
            let parsed = false;
            let parseReason = '';

            const parser = protocol ? this.parsers[protocol] : null;
            if (parser) {
                if (typeof parser.resetLastError === 'function') {
                    parser.resetLastError();
                }
                const node = parser.parse(trimmedLine);
                if (node) {
                    nodes.push(node);
                    parsed = true;
                } else if (typeof parser.getLastError === 'function') {
                    parseReason = parser.getLastError();
                }
            } else {
                for (const p of this.parserList) {
                    const node = p.parse(trimmedLine);
                    if (node) {
                        nodes.push(node);
                        parsed = true;
                        break;
                    }
                }
            }

            // 未识别或解析失败的记录
            if (!parsed) {
                const preview = trimmedLine.length > 120 ? trimmedLine.slice(0, 120) + '...' : trimmedLine;
                failures.push({
                    protocol: protocol || 'unknown',
                    preview,
                    reason: parseReason || (protocol ? '解析器未识别该节点格式' : '无协议前缀，无法识别')
                });
            }
        }

        return { nodes, failures };
    }

    /**
     * 解析 YAML 格式的订阅
     * @param {string} content - YAML 内容
     * @returns {Array} 节点列表
     */
    parseYaml(content) {
        try {
            const nodes = this.yamlParser.parse(content);
            return { nodes: nodes || [], failures: [] };
        } catch (error) {
            console.error('YAML 解析失败:', error.message);
            return { nodes: [], failures: [] };
        }
    }
}

module.exports = SubscriptionFetcher;
