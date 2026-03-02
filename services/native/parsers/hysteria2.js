const BaseParser = require('./base');

/**
 * Hysteria2 协议解析器
 * 支持格式: hysteria2://[auth@]hostname[:port]/?[key=value]&[key=value]...#name
 * 也支持 hy2:// 前缀
 */
class Hysteria2Parser extends BaseParser {
    /**
     * 解析 Hysteria2 URI
     * @param {string} uri - Hysteria2 URI
     * @returns {object|null} 标准化节点对象
     */
    parse(uri) {
        try {
            let content;
            if (uri.startsWith('hysteria2://')) {
                content = uri.slice(12);
            } else if (uri.startsWith('hy2://')) {
                content = uri.slice(6);
            } else {
                return null;
            }

            // 提取节点名称 (fragment)
            let name = '';
            const hashIndex = content.indexOf('#');
            if (hashIndex !== -1) {
                name = this.urlDecode(content.slice(hashIndex + 1));
                content = content.slice(0, hashIndex);
            }

            const node = this.createNode();
            node.type = 'hysteria2';
            node.name = name || 'Hysteria2节点';

            // 解析查询参数
            let params = {};
            const queryIndex = content.indexOf('?');
            if (queryIndex !== -1) {
                params = this.parseQuery(content.slice(queryIndex));
                content = content.slice(0, queryIndex);
            }

            // 解析 auth@hostname:port
            const atIndex = content.indexOf('@');
            if (atIndex !== -1) {
                // 有认证信息
                node.password = this.urlDecode(content.slice(0, atIndex));
                content = content.slice(atIndex + 1);
            }

            // 解析 hostname:port
            // 支持 IPv6: [::1]:port
            let server, port;
            if (content.startsWith('[')) {
                // IPv6
                const bracketEnd = content.indexOf(']');
                if (bracketEnd === -1) {
                    console.error('无效的 Hysteria2 IPv6 格式');
                    return null;
                }
                server = content.slice(1, bracketEnd);
                const portPart = content.slice(bracketEnd + 1);
                if (portPart.startsWith(':')) {
                    port = parseInt(portPart.slice(1), 10);
                } else {
                    port = 443; // 默认端口
                }
            } else {
                const portIndex = content.lastIndexOf(':');
                if (portIndex !== -1) {
                    server = content.slice(0, portIndex);
                    // Hysteria2 支持多端口格式如 123,5000-6000，取第一个端口
                    const portStr = content.slice(portIndex + 1);
                    const firstPort = portStr.split(',')[0].split('-')[0];
                    port = parseInt(firstPort, 10);
                } else {
                    server = content;
                    port = 443; // 默认端口
                }
            }

            node.server = server;
            node.port = port;

            // TLS 配置 - Hysteria2 默认启用 TLS
            node.tls = true;
            if (params.sni) {
                node.sni = params.sni;
            } else {
                node.sni = node.server;
            }

            // insecure 参数
            if (params.insecure === '1' || params.insecure === 'true') {
                node.skip_cert_verify = true;
            }

            // 混淆配置
            if (params.obfs) {
                node.hysteria2_opts = node.hysteria2_opts || {};
                node.hysteria2_opts.obfs = params.obfs;
                if (params['obfs-password']) {
                    node.hysteria2_opts.obfs_password = params['obfs-password'];
                }
            }

            // 证书指纹
            if (params.pinSHA256) {
                node.hysteria2_opts = node.hysteria2_opts || {};
                node.hysteria2_opts.pinSHA256 = params.pinSHA256;
            }

            return this.validate(node) ? node : null;
        } catch (error) {
            console.error('解析 Hysteria2 节点失败:', error.message);
            return null;
        }
    }

    /**
     * 验证 Hysteria2 节点
     * @param {object} node - 节点对象
     * @returns {boolean} 是否有效
     */
    validate(node) {
        if (!super.validate(node)) return false;
        if (node.port < 1 || node.port > 65535) return false;
        return true;
    }
}

module.exports = Hysteria2Parser;
