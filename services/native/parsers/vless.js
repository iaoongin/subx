const BaseParser = require('./base');

/**
 * VLESS 协议解析器
 * 支持格式: vless://uuid@server:port?params#name
 */
class VLESSParser extends BaseParser {
    /**
     * 解析 VLESS URI
     * @param {string} uri - VLESS URI
     * @returns {object|null} 标准化节点对象
     */
    parse(uri) {
        try {
            if (!uri.startsWith('vless://')) {
                return null;
            }

            // 移除 vless:// 前缀
            let content = uri.slice(8);

            // 提取节点名称 (fragment)
            let name = '';
            const hashIndex = content.indexOf('#');
            if (hashIndex !== -1) {
                name = this.urlDecode(content.slice(hashIndex + 1));
                content = content.slice(0, hashIndex);
            }

            const node = this.createNode();
            node.type = 'vless';
            node.name = name || 'VLESS节点';

            // 解析查询参数
            let params = {};
            const queryIndex = content.indexOf('?');
            if (queryIndex !== -1) {
                params = this.parseQuery(content.slice(queryIndex));
                content = content.slice(0, queryIndex);
            }

            // 解析 uuid@server:port
            const atIndex = content.indexOf('@');
            if (atIndex === -1) {
                console.error('无效的 VLESS 格式');
                return null;
            }

            node.uuid = content.slice(0, atIndex);
            const serverPart = content.slice(atIndex + 1);

            // 解析 server:port
            const portIndex = serverPart.lastIndexOf(':');
            if (portIndex === -1) {
                console.error('无效的 VLESS server:port 格式');
                return null;
            }

            node.server = serverPart.slice(0, portIndex);
            node.port = parseInt(serverPart.slice(portIndex + 1), 10);

            // 解析查询参数
            if (params.encryption) {
                node.cipher = params.encryption;
            }
            if (params.flow) {
                node.flow = params.flow;
            }
            if (params.security) {
                node.tls = params.security === 'tls' || params.security === 'reality';
            }
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

            // HTTP/2 配置
            if (node.network === 'h2' || node.network === 'http') {
                if (params.path) {
                    node.h2_opts.path = params.path;
                }
                if (params.host) {
                    node.h2_opts.host = params.host.split(',');
                }
            }

            return this.validate(node) ? node : null;
        } catch (error) {
            console.error('解析 VLESS 节点失败:', error.message);
            return null;
        }
    }

    /**
     * 验证 VLESS 节点
     * @param {object} node - 节点对象
     * @returns {boolean} 是否有效
     */
    validate(node) {
        if (!super.validate(node)) return false;
        if (!node.uuid) return false;
        if (node.port < 1 || node.port > 65535) return false;
        return true;
    }
}

module.exports = VLESSParser;
