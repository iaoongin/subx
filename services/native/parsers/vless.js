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
            if (!/^vless:\/\//i.test(uri)) {
                return null;
            }

            // 移除 vless:// 前缀
            let content = uri.slice(uri.indexOf('://') + 3);

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

            node.uuid = this.urlDecode(content.slice(0, atIndex));
            const serverPart = content.slice(atIndex + 1);

            // 解析 server:port
            const portIndex = serverPart.lastIndexOf(':');
            if (portIndex === -1) {
                console.error('无效的 VLESS server:port 格式');
                return null;
            }

            node.server = this.urlDecode(serverPart.slice(0, portIndex));
            if (node.server.startsWith('[') && node.server.endsWith(']')) {
                node.server = node.server.slice(1, -1);
            }
            const portText = serverPart.slice(portIndex + 1);
            if (!/^\d+$/.test(portText)) {
                console.error('无效的 VLESS port 格式');
                return null;
            }
            node.port = Number(portText);

            // 解析查询参数
            node.uri_params = { ...params };
            node.cipher = this.getParam(params, 'encryption', 'cipher') || 'none';
            node.flow = this.getParam(params, 'flow') || '';

            const security = (this.getParam(params, 'security') || 'none').toLowerCase();
            node.security = security;
            node.tls = security === 'tls' || security === 'reality';
            node.sni = this.getParam(params, 'sni', 'servername', 'serverName') || '';
            node.alpn = this.parseList(this.getParam(params, 'alpn'));
            node.skip_cert_verify = this.isTruthy(this.getParam(params, 'allowInsecure', 'skip-cert-verify'));
            node.client_fingerprint = this.getParam(params, 'fp', 'fingerprint', 'client-fingerprint') || '';
            node.packet_encoding = this.getParam(params, 'packet-encoding', 'packetEncoding') || '';
            node.reality_opts = {
                public_key: this.getParam(params, 'pbk', 'publicKey', 'public-key') || '',
                short_id: this.getParam(params, 'sid', 'shortId', 'short-id') || '',
                spider_x: this.getParam(params, 'spx', 'spiderX', 'spider-x') || ''
            };
            const mldsa65Verify = this.getParam(params, 'pqv', 'mldsa65Verify');
            if (mldsa65Verify) node.reality_opts.mldsa65_verify = mldsa65Verify;
            node.tls_opts = {
                ech_config: this.getParam(params, 'echConfig', 'ech-config') || '',
                ech_doh_server: this.getParam(params, 'echDohServer', 'ech-doh-server') || '',
                ech_force_query: this.isTruthy(this.getParam(params, 'echForceQuery', 'ech-force-query')),
                pinned_peer_certificate_chain_sha256: this.parseList(
                    this.getParam(params, 'pinSHA256', 'pinnedPeerCertificateChainSha256')
                )
            };
            node.tcp_opts.header_type = this.getParam(params, 'headerType', 'header-type') || '';
            node.network = (this.getParam(params, 'type', 'network') || 'tcp').toLowerCase();
            if (node.network === 'http-upgrade') node.network = 'httpupgrade';

            // WebSocket 配置
            if (node.network === 'ws') {
                if (this.getParam(params, 'path')) {
                    node.ws_opts.path = this.getParam(params, 'path');
                }
                if (this.getParam(params, 'host')) {
                    node.ws_opts.headers = { Host: this.getParam(params, 'host') };
                }
                node.ws_opts.max_early_data = this.toInteger(this.getParam(params, 'ed', 'maxEarlyData'));
                node.ws_opts.early_data_header_name = this.getParam(params, 'eh', 'earlyDataHeaderName') || '';
            }

            // gRPC 配置
            if (node.network === 'grpc') {
                if (this.getParam(params, 'serviceName', 'service-name')) {
                    node.grpc_opts.service_name = this.getParam(params, 'serviceName', 'service-name');
                }
                node.grpc_opts.authority = this.getParam(params, 'authority') || '';
                node.grpc_opts.mode = this.getParam(params, 'mode') || '';
            }

            // HTTP/2 配置
            if (node.network === 'h2' || node.network === 'http') {
                if (this.getParam(params, 'path')) {
                    node.h2_opts.path = this.getParam(params, 'path');
                }
                if (this.getParam(params, 'host')) {
                    node.h2_opts.host = this.parseList(this.getParam(params, 'host'));
                }
                node.h2_opts.method = this.getParam(params, 'method') || '';
            }

            // HTTPUpgrade 配置
            if (node.network === 'httpupgrade') {
                node.httpupgrade_opts.path = this.getParam(params, 'path') || '';
                node.httpupgrade_opts.host = this.getParam(params, 'host') || '';
                node.httpupgrade_opts.headers = this.parseObject(this.getParam(params, 'headers'));
            }

            // XHTTP 配置
            if (node.network === 'xhttp' || node.network === 'splithttp') {
                node.xhttp_opts.path = this.getParam(params, 'path') || '';
                node.xhttp_opts.host = this.parseList(this.getParam(params, 'host'));
                node.xhttp_opts.mode = this.getParam(params, 'mode', 'xhttpMode') || '';
                node.xhttp_opts.extra = this.parseJsonValue(this.getParam(params, 'extra'));
                node.xhttp_opts.sc_max_each_post_bytes = this.toInteger(
                    this.getParam(params, 'scMaxEachPostBytes', 'sc-max-each-post-bytes')
                );
                node.xhttp_opts.no_sse_header = this.isTruthy(
                    this.getParam(params, 'noSSEHeader', 'no-sse-header')
                );
                node.xhttp_opts.xmux = this.parseJsonValue(this.getParam(params, 'xmux'));
            }

            // QUIC 配置
            if (node.network === 'quic') {
                node.quic_opts.security = this.getParam(params, 'quicSecurity', 'quic-security') || '';
                node.quic_opts.key = this.getParam(params, 'key') || '';
                node.quic_opts.header_type = this.getParam(params, 'headerType', 'header-type') || '';
            }

            // mKCP 配置（兼容旧版 VLESS 链接）
            if (node.network === 'kcp' || node.network === 'mkcp') {
                node.kcp_opts.mtu = this.toInteger(this.getParam(params, 'mtu'));
                node.kcp_opts.tti = this.toInteger(this.getParam(params, 'tti'));
                node.kcp_opts.uplink_capacity = this.toInteger(this.getParam(params, 'uplinkCapacity'));
                node.kcp_opts.downlink_capacity = this.toInteger(this.getParam(params, 'downlinkCapacity'));
                node.kcp_opts.congestion = this.isTruthy(this.getParam(params, 'congestion'));
                node.kcp_opts.read_buffer_size = this.toInteger(this.getParam(params, 'readBufferSize'));
                node.kcp_opts.write_buffer_size = this.toInteger(this.getParam(params, 'writeBufferSize'));
                node.kcp_opts.seed = this.getParam(params, 'seed') || '';
                node.kcp_opts.header_type = this.getParam(params, 'headerType', 'header-type') || '';
            }

            return this.validate(node) ? node : null;
        } catch (error) {
            console.error('解析 VLESS 节点失败:', error.message);
            return null;
        }
    }

    isTruthy(value) {
        return ['1', 'true', 'yes'].includes(String(value || '').toLowerCase());
    }

    getParam(params, ...names) {
        for (const name of names) {
            if (params[name] !== undefined && params[name] !== '') return params[name];
        }
        return '';
    }

    parseList(value) {
        if (!value) return [];
        if (Array.isArray(value)) return value.filter(Boolean);
        const parsed = this.parseJsonValue(value);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
        return String(value).split(',').map((item) => item.trim()).filter(Boolean);
    }

    parseObject(value) {
        const parsed = this.parseJsonValue(value);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    }

    toInteger(value) {
        if (value === undefined || value === null || value === '') return 0;
        const parsed = Number(value);
        return Number.isInteger(parsed) ? parsed : 0;
    }

    parseJsonValue(value) {
        if (!value) return {};
        try {
            return JSON.parse(value);
        } catch {
            return value;
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
