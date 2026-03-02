const BaseParser = require('./base');

/**
 * Trojan 协议解析器
 * 支持格式: trojan://password@server:port?params#name
 */
class TrojanParser extends BaseParser {
    /**
     * 解析 Trojan URI
     * @param {string} uri - Trojan URI
     * @returns {object|null} 标准化节点对象
     */
    parse(uri) {
        try {
            if (!uri.startsWith('trojan://')) {
                return null;
            }

            // 移除 trojan:// 前缀
            let content = uri.slice(9);

            // 提取节点名称 (fragment)
            let name = '';
            const hashIndex = content.indexOf('#');
            if (hashIndex !== -1) {
                name = this.urlDecode(content.slice(hashIndex + 1));
                content = content.slice(0, hashIndex);
            }

            const node = this.createNode();
            node.type = 'trojan';
            node.name = name || 'Trojan节点';

            // 解析查询参数
            let params = {};
            const queryIndex = content.indexOf('?');
            if (queryIndex !== -1) {
                params = this.parseQuery(content.slice(queryIndex));
                content = content.slice(0, queryIndex);
            }

            // 解析 password@server:port
            const atIndex = content.indexOf('@');
            if (atIndex === -1) {
                console.error('无效的 Trojan 格式');
                return null;
            }

            node.password = this.urlDecode(content.slice(0, atIndex));
            const serverPart = content.slice(atIndex + 1);

            // 解析 server:port
            const portIndex = serverPart.lastIndexOf(':');
            if (portIndex === -1) {
                console.error('无效的 Trojan server:port 格式');
                return null;
            }

            node.server = serverPart.slice(0, portIndex);
            node.port = parseInt(serverPart.slice(portIndex + 1), 10);

            // 解析查询参数
            if (params.sni) {
                node.sni = params.sni;
            }
            if (params.alpn) {
                node.alpn = params.alpn.split(',');
            }
            if (params.allowInsecure === '1' || params.allowInsecure === 'true') {
                node.skip_cert_verify = true;
            }
            if (params.type) {
                node.network = params.type;
            }

            // WebSocket 配置
            if (node.network === 'ws') {
                if (params.path) {
                    node.ws_opts.path = params.path;
                }
                if (params.host) {
                    node.ws_opts.headers = { Host: params.host };
                }
            }

            // gRPC 配置
            if (node.network === 'grpc') {
                if (params.serviceName) {
                    node.grpc_opts.service_name = params.serviceName;
                }
            }

            // Trojan 默认启用 TLS
            node.tls = true;
            if (!node.sni) {
                node.sni = node.server;
            }

            return this.validate(node) ? node : null;
        } catch (error) {
            console.error('解析 Trojan 节点失败:', error.message);
            return null;
        }
    }

    /**
     * 验证 Trojan 节点
     * @param {object} node - 节点对象
     * @returns {boolean} 是否有效
     */
    validate(node) {
        if (!super.validate(node)) return false;
        if (!node.password) return false;
        if (node.port < 1 || node.port > 65535) return false;
        return true;
    }
}

module.exports = TrojanParser;
