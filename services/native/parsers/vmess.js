const BaseParser = require('./base');

/**
 * VMess 协议解析器
 * 支持格式: vmess://base64(JSON)
 */
class VMessParser extends BaseParser {
    /**
     * 解析 VMess URI
     * @param {string} uri - VMess URI
     * @returns {object|null} 标准化节点对象
     */
    parse(uri) {
        this.resetLastError();
        try {
            if (!uri.startsWith('vmess://')) {
                return null;
            }

            const content = uri.slice(8);
            if (!content) {
                this.setLastError('VMess URI 内容为空');
                return null;
            }

            // 格式 1: vmess://base64(JSON)
            try {
                const decoded = this.base64Decode(content);
                if (decoded) {
                    const vmessConfig = JSON.parse(decoded);
                    const node = this.buildNodeFromConfig(vmessConfig);
                    if (node) {
                        return node;
                    }
                }
            } catch {
                // 非 Base64(JSON) 时继续尝试 URI 直连格式
            }

            // 格式 2: vmess://uuid@host:port?type=ws&security=tls#name
            const uriNode = this.parseStandardVmessUri(uri);
            if (uriNode) {
                return uriNode;
            }

            this.setLastError(this.getLastError() || '不支持的 VMess URI 格式');
            return null;
        } catch (error) {
            this.setLastError(error.message || 'VMess 解析异常');
            return null;
        }
    }

    buildNodeFromConfig(vmessConfig) {
        const node = this.createNode();
        node.type = 'vmess';
        node.name = vmessConfig.ps || vmessConfig.remark || 'VMess节点';
        node.server = vmessConfig.add || vmessConfig.address;
        node.port = parseInt(vmessConfig.port, 10);
        node.uuid = vmessConfig.id || vmessConfig.uuid;
        node.alterId = parseInt(vmessConfig.aid || vmessConfig.alterId || 0, 10);
        node.cipher = vmessConfig.scy || vmessConfig.cipher || 'auto';
        node.network = vmessConfig.net || vmessConfig.network || 'tcp';

        node.tls = vmessConfig.tls === 'tls' || vmessConfig.tls === true;
        if (node.tls) {
            node.sni = vmessConfig.sni || vmessConfig.host || '';
            if (vmessConfig.alpn) {
                node.alpn = Array.isArray(vmessConfig.alpn)
                    ? vmessConfig.alpn
                    : String(vmessConfig.alpn).split(',');
            }
        }

        node.skip_cert_verify = vmessConfig.skip_cert_verify ||
                                vmessConfig['skip-cert-verify'] ||
                                false;

        if (node.network === 'ws') {
            node.ws_opts.path = vmessConfig.path || '/';
            if (vmessConfig.host) {
                node.ws_opts.headers = { Host: vmessConfig.host };
            }
        } else if (node.network === 'h2' || node.network === 'http') {
            node.h2_opts.path = vmessConfig.path || '/';
            if (vmessConfig.host) {
                node.h2_opts.host = String(vmessConfig.host).split(',');
            }
        } else if (node.network === 'grpc') {
            node.grpc_opts.service_name = vmessConfig.path ||
                                          vmessConfig.serviceName || '';
        }

        node.udp = vmessConfig.udp !== false;

        if (!node.server) {
            this.setLastError('VMess 缺少服务器地址(add/address)');
            return null;
        }
        if (!node.uuid) {
            this.setLastError('VMess 缺少 UUID(id/uuid)');
            return null;
        }
        if (!Number.isInteger(node.port) || node.port < 1 || node.port > 65535) {
            this.setLastError(`VMess 端口无效: ${vmessConfig.port}`);
            return null;
        }

        if (!this.validate(node)) {
            this.setLastError('VMess 节点校验失败');
            return null;
        }
        return node;
    }

    parseStandardVmessUri(uri) {
        let parsed;
        try {
            parsed = new URL(uri);
        } catch {
            this.setLastError('VMess URI 不是合法 URL');
            return null;
        }

        const node = this.createNode();
        node.type = 'vmess';
        node.server = parsed.hostname;
        node.port = parseInt(parsed.port, 10);
        node.uuid = parsed.username || '';
        node.alterId = parseInt(parsed.password || parsed.searchParams.get('aid') || '0', 10);
        node.cipher = parsed.searchParams.get('cipher') ||
                      parsed.searchParams.get('scy') ||
                      'auto';
        node.network = parsed.searchParams.get('type') ||
                       parsed.searchParams.get('net') ||
                       'tcp';

        const hashName = parsed.hash ? this.urlDecode(parsed.hash.slice(1)) : '';
        node.name = hashName || `vmess-${node.server || 'node'}`;

        const security = (parsed.searchParams.get('security') || '').toLowerCase();
        const tlsFlag = (parsed.searchParams.get('tls') || '').toLowerCase();
        node.tls = security === 'tls' || tlsFlag === '1' || tlsFlag === 'true' || tlsFlag === 'tls';

        if (node.tls) {
            node.sni = parsed.searchParams.get('sni') ||
                       parsed.searchParams.get('peer') ||
                       parsed.searchParams.get('host') ||
                       node.server;
        }

        const insecure = (parsed.searchParams.get('allowInsecure') ||
                          parsed.searchParams.get('skip-cert-verify') ||
                          '').toLowerCase();
        node.skip_cert_verify = insecure === '1' || insecure === 'true';

        if (node.network === 'ws') {
            node.ws_opts.path = parsed.searchParams.get('path') || '/';
            const host = parsed.searchParams.get('host');
            if (host) {
                node.ws_opts.headers = { Host: host };
            }
        } else if (node.network === 'h2' || node.network === 'http') {
            node.h2_opts.path = parsed.searchParams.get('path') || '/';
            const host = parsed.searchParams.get('host');
            if (host) {
                node.h2_opts.host = host.split(',');
            }
        } else if (node.network === 'grpc') {
            node.grpc_opts.service_name = parsed.searchParams.get('serviceName') ||
                                          parsed.searchParams.get('path') ||
                                          '';
        }

        const udpFlag = (parsed.searchParams.get('udp') || '').toLowerCase();
        node.udp = !(udpFlag === '0' || udpFlag === 'false');

        if (!node.server) {
            this.setLastError('VMess URI 缺少 host');
            return null;
        }
        if (!node.uuid) {
            this.setLastError('VMess URI 缺少 UUID(username)');
            return null;
        }
        if (!Number.isInteger(node.port) || node.port < 1 || node.port > 65535) {
            this.setLastError(`VMess URI 端口无效: ${parsed.port || 'empty'}`);
            return null;
        }

        if (!this.validate(node)) {
            this.setLastError('VMess URI 节点校验失败');
            return null;
        }

        return node;
    }

    /**
     * 验证 VMess 节点
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

module.exports = VMessParser;
