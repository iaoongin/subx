const yaml = require('js-yaml');
const BaseParser = require('./base');

/**
 * YAML 格式解析器
 * 用于解析 Clash 风格的 YAML 订阅配置
 * 支持从 YAML 配置中提取代理节点信息
 */
class YAMLParser extends BaseParser {
    /**
     * 解析 YAML 格式的订阅内容
     * @param {string} content - YAML 格式的文本内容
     * @returns {Array} 标准化节点对象数组
     */
    parse(content) {
        try {
            // 解析 YAML 内容
            const config = yaml.load(content);

            if (!config || typeof config !== 'object') {
                console.error('YAML 解析失败：无效的配置格式');
                return [];
            }

            // 提取代理节点列表
            const proxies = config.proxies || config.Proxy || [];

            if (!Array.isArray(proxies)) {
                console.error('YAML 配置中没有找到有效的代理列表');
                return [];
            }

            // 解析每个代理节点
            const nodes = [];
            for (const proxy of proxies) {
                const node = this.parseProxyNode(proxy);
                if (node && this.validate(node)) {
                    nodes.push(node);
                }
            }

            return nodes;
        } catch (error) {
            console.error('解析 YAML 配置失败:', error.message);
            return [];
        }
    }

    /**
     * 解析单个代理节点
     * @param {object} proxy - YAML 中的代理配置对象
     * @returns {object|null} 标准化节点对象
     */
    parseProxyNode(proxy) {
        if (!proxy || typeof proxy !== 'object') {
            return null;
        }

        // 获取节点类型（统一转换为小写）
        const type = (proxy.type || '').toLowerCase();

        // 根据不同类型解析节点
        switch (type) {
            case 'ss':
            case 'shadowsocks':
                return this.parseShadowsocks(proxy);
            case 'vmess':
                return this.parseVMess(proxy);
            case 'trojan':
                return this.parseTrojan(proxy);
            case 'vless':
                return this.parseVLESS(proxy);
            case 'hysteria2':
            case 'hy2':
                return this.parseHysteria2(proxy);
            default:
                console.warn(`不支持的代理类型: ${type}`);
                return null;
        }
    }

    /**
     * 解析 Shadowsocks 节点
     * @param {object} proxy - 代理配置
     * @returns {object} 标准化节点对象
     */
    parseShadowsocks(proxy) {
        const node = this.createNode();
        node.type = 'ss';
        node.name = proxy.name || 'SS节点';
        node.server = proxy.server;
        node.port = parseInt(proxy.port, 10);
        node.password = proxy.password;
        node.method = proxy.cipher || proxy.method || 'aes-256-gcm';
        node.udp = proxy.udp !== false;

        // 插件配置
        if (proxy.plugin) {
            node.plugin = proxy.plugin;
            node.plugin_opts = proxy['plugin-opts'] || {};
        }

        return node;
    }

    /**
     * 解析 VMess 节点
     * @param {object} proxy - 代理配置
     * @returns {object} 标准化节点对象
     */
    parseVMess(proxy) {
        const node = this.createNode();
        node.type = 'vmess';
        node.name = proxy.name || 'VMess节点';
        node.server = proxy.server;
        node.port = parseInt(proxy.port, 10);
        node.uuid = proxy.uuid;
        node.alterId = parseInt(proxy.alterId || proxy['alter-id'] || 0, 10);
        node.cipher = proxy.cipher || 'auto';
        node.network = proxy.network || 'tcp';
        node.udp = proxy.udp !== false;

        // TLS 配置
        node.tls = proxy.tls === true || proxy.tls === 'true';
        if (node.tls) {
            node.sni = proxy.sni || proxy.servername || '';
            node.skip_cert_verify = proxy['skip-cert-verify'] === true;
            if (proxy.alpn) {
                node.alpn = Array.isArray(proxy.alpn) ? proxy.alpn : [proxy.alpn];
            }
        }

        // 传输层配置
        if (node.network === 'ws') {
            node.ws_opts.path = proxy['ws-opts']?.path || proxy['ws-path'] || '/';
            const headers = proxy['ws-opts']?.headers || {};
            if (proxy['ws-headers'] || headers.Host) {
                node.ws_opts.headers = proxy['ws-headers'] || headers;
            }
        } else if (node.network === 'h2' || node.network === 'http') {
            const h2Opts = proxy['h2-opts'] || {};
            node.h2_opts.path = h2Opts.path || '/';
            node.h2_opts.host = h2Opts.host || [];
        } else if (node.network === 'grpc') {
            const grpcOpts = proxy['grpc-opts'] || {};
            node.grpc_opts.service_name = grpcOpts['grpc-service-name'] || '';
        }

        return node;
    }

    /**
     * 解析 Trojan 节点
     * @param {object} proxy - 代理配置
     * @returns {object} 标准化节点对象
     */
    parseTrojan(proxy) {
        const node = this.createNode();
        node.type = 'trojan';
        node.name = proxy.name || 'Trojan节点';
        node.server = proxy.server;
        node.port = parseInt(proxy.port, 10);
        node.password = proxy.password;
        node.network = proxy.network || 'tcp';
        node.udp = proxy.udp !== false;

        // TLS 配置（Trojan 默认使用 TLS）
        node.tls = true;
        node.sni = proxy.sni || proxy.server;
        node.skip_cert_verify = proxy['skip-cert-verify'] === true;
        if (proxy.alpn) {
            node.alpn = Array.isArray(proxy.alpn) ? proxy.alpn : [proxy.alpn];
        }

        // WebSocket 配置
        if (node.network === 'ws') {
            const wsOpts = proxy['ws-opts'] || {};
            node.ws_opts.path = wsOpts.path || '/';
            if (wsOpts.headers) {
                node.ws_opts.headers = wsOpts.headers;
            }
        } else if (node.network === 'grpc') {
            const grpcOpts = proxy['grpc-opts'] || {};
            node.grpc_opts.service_name = grpcOpts['grpc-service-name'] || '';
        }

        return node;
    }

    /**
     * 解析 VLESS 节点
     * @param {object} proxy - 代理配置
     * @returns {object} 标准化节点对象
     */
    parseVLESS(proxy) {
        const node = this.createNode();
        node.type = 'vless';
        node.name = proxy.name || 'VLESS节点';
        node.server = proxy.server;
        node.port = parseInt(proxy.port, 10);
        node.uuid = proxy.uuid;
        node.flow = proxy.flow || '';
        node.network = proxy.network || 'tcp';
        node.udp = proxy.udp !== false;

        // TLS 配置
        node.tls = proxy.tls === true || proxy.tls === 'true';
        if (node.tls) {
            node.sni = proxy.sni || proxy.servername || '';
            node.skip_cert_verify = proxy['skip-cert-verify'] === true;
            if (proxy.alpn) {
                node.alpn = Array.isArray(proxy.alpn) ? proxy.alpn : [proxy.alpn];
            }
        }

        // 传输层配置
        if (node.network === 'ws') {
            const wsOpts = proxy['ws-opts'] || {};
            node.ws_opts.path = wsOpts.path || '/';
            if (wsOpts.headers) {
                node.ws_opts.headers = wsOpts.headers;
            }
        } else if (node.network === 'h2' || node.network === 'http') {
            const h2Opts = proxy['h2-opts'] || {};
            node.h2_opts.path = h2Opts.path || '/';
            node.h2_opts.host = h2Opts.host || [];
        } else if (node.network === 'grpc') {
            const grpcOpts = proxy['grpc-opts'] || {};
            node.grpc_opts.service_name = grpcOpts['grpc-service-name'] || '';
        }

        return node;
    }

    /**
     * 解析 Hysteria2 节点
     * @param {object} proxy - 代理配置
     * @returns {object} 标准化节点对象
     */
    parseHysteria2(proxy) {
        const node = this.createNode();
        node.type = 'hysteria2';
        node.name = proxy.name || 'Hysteria2节点';
        node.server = proxy.server;
        node.port = parseInt(proxy.port, 10);
        node.password = proxy.password || '';
        node.udp = proxy.udp !== false;

        // TLS 配置
        node.tls = true;
        node.sni = proxy.sni || proxy.server;
        node.skip_cert_verify = proxy['skip-cert-verify'] === true;
        if (proxy.alpn) {
            node.alpn = Array.isArray(proxy.alpn) ? proxy.alpn : [proxy.alpn];
        }

        // 混淆配置
        if (proxy.obfs) {
            node.hysteria2_opts.obfs = proxy.obfs;
            if (proxy['obfs-password']) {
                node.hysteria2_opts.obfs_password = proxy['obfs-password'];
            }
        }

        return node;
    }

    /**
     * 验证节点数据
     * @param {object} node - 节点对象
     * @returns {boolean} 是否有效
     */
    validate(node) {
        if (!super.validate(node)) {
            return false;
        }

        // 验证端口范围
        if (node.port < 1 || node.port > 65535) {
            return false;
        }

        // 根据类型验证必要字段
        switch (node.type) {
            case 'ss':
                return !!node.password && !!node.method;
            case 'vmess':
            case 'vless':
                return !!node.uuid;
            case 'trojan':
                return !!node.password;
            case 'hysteria2':
                return true; // password is optional for hysteria2
            default:
                return false;
        }
    }
}

module.exports = YAMLParser;