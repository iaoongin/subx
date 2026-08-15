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
        node.cipher = proxy.encryption ?? 'none';
        node.flow = proxy.flow || '';
        node.network = (proxy.network || 'tcp').toLowerCase();
        if (node.network === 'http-upgrade') node.network = 'httpupgrade';
        node.udp = proxy.udp !== false;

        // TLS 配置
        const realityOpts = proxy['reality-opts'] || {};
        node.security = String(proxy.security || (Object.keys(realityOpts).length > 0
            ? 'reality'
            : (proxy.tls === true || proxy.tls === 'true' || proxy.tls === 'tls' ? 'tls' : 'none'))).toLowerCase();
        node.tls = node.security === 'tls' || node.security === 'reality';
        node.client_fingerprint = proxy['client-fingerprint'] || proxy.fingerprint || '';
        node.packet_encoding = proxy['packet-encoding'] || proxy.packetEncoding || '';
        node.reality_opts = {
            public_key: realityOpts['public-key'] || '',
            short_id: realityOpts['short-id'] || '',
            spider_x: realityOpts['spider-x'] || '',
            mldsa65_verify: realityOpts['mldsa65-verify'] || ''
        };
        node.uri_params = proxy['uri-params'] || {};
        node.sni = proxy.sni || proxy.servername || proxy['server-name'] || '';
        node.skip_cert_verify = this.toBoolean(proxy['skip-cert-verify']);
        if (proxy.alpn) {
            node.alpn = this.toList(proxy.alpn);
        }
        const tlsOpts = proxy['tls-opts'] || {};
        node.tls_opts = {
            ech_config: tlsOpts['ech-config'] || tlsOpts.echConfig || '',
            ech_doh_server: tlsOpts['ech-doh-server'] || tlsOpts.echDohServer || '',
            ech_force_query: this.toBoolean(tlsOpts['ech-force-query'] ?? tlsOpts.echForceQuery),
            pinned_peer_certificate_chain_sha256: this.toList(
                tlsOpts['pin-sha256'] || tlsOpts.pinSHA256 || tlsOpts['pinned-peer-certificate-chain-sha256']
            )
        };

        if (proxy['header-type']) {
            node.tcp_opts.header_type = proxy['header-type'];
        }

        // 传输层配置
        if (node.network === 'ws') {
            const wsOpts = proxy['ws-opts'] || {};
            node.ws_opts.path = wsOpts.path || '/';
            if (wsOpts.headers) {
                node.ws_opts.headers = wsOpts.headers;
            }
            node.ws_opts.max_early_data = parseInt(wsOpts['max-early-data'] || 0, 10) || 0;
            node.ws_opts.early_data_header_name = wsOpts['early-data-header-name'] || '';
        } else if (node.network === 'h2') {
            const h2Opts = proxy['h2-opts'] || {};
            node.h2_opts.path = h2Opts.path || '/';
            node.h2_opts.host = this.toList(h2Opts.host);
            node.h2_opts.method = h2Opts.method || '';
            node.h2_opts.headers = h2Opts.headers || {};
        } else if (node.network === 'http') {
            const httpOpts = proxy['http-opts'] || {};
            node.h2_opts.path = Array.isArray(httpOpts.path)
                ? (httpOpts.path[0] || '/')
                : (httpOpts.path || '/');
            node.h2_opts.host = this.toList(httpOpts.host || httpOpts.headers?.Host);
            node.h2_opts.method = httpOpts.method || '';
            node.h2_opts.headers = httpOpts.headers || {};
        } else if (node.network === 'grpc') {
            const grpcOpts = proxy['grpc-opts'] || {};
            node.grpc_opts.service_name = grpcOpts['grpc-service-name'] || '';
            node.grpc_opts.authority = grpcOpts.authority || '';
            node.grpc_opts.mode = grpcOpts['grpc-mode'] || grpcOpts.mode || '';
        } else if (node.network === 'httpupgrade') {
            const httpUpgradeOpts = proxy['http-upgrade-opts'] || proxy['httpupgrade-opts'] || {};
            node.httpupgrade_opts.path = httpUpgradeOpts.path || '/';
            node.httpupgrade_opts.host = httpUpgradeOpts.host || '';
            node.httpupgrade_opts.headers = httpUpgradeOpts.headers || {};
        } else if (node.network === 'xhttp' || node.network === 'splithttp') {
            const xhttpOpts = proxy['xhttp-opts'] || {};
            node.xhttp_opts.path = xhttpOpts.path || '/';
            node.xhttp_opts.host = this.toList(xhttpOpts.host);
            node.xhttp_opts.mode = xhttpOpts.mode || '';
            node.xhttp_opts.extra = xhttpOpts.extra || {};
            node.xhttp_opts.sc_max_each_post_bytes = this.toInteger(
                xhttpOpts['sc-max-each-post-bytes'] || xhttpOpts.scMaxEachPostBytes
            );
            node.xhttp_opts.no_sse_header = this.toBoolean(
                xhttpOpts['no-sse-header'] ?? xhttpOpts.noSSEHeader
            );
            node.xhttp_opts.xmux = xhttpOpts.xmux || {};
        } else if (node.network === 'quic') {
            const quicOpts = proxy['quic-opts'] || {};
            node.quic_opts.security = quicOpts.security || '';
            node.quic_opts.key = quicOpts.key || '';
            node.quic_opts.header_type = quicOpts['header-type'] || proxy['header-type'] || '';
        } else if (node.network === 'kcp' || node.network === 'mkcp') {
            const kcpOpts = proxy['kcp-opts'] || {};
            node.kcp_opts.mtu = parseInt(kcpOpts.mtu || 0, 10) || 0;
            node.kcp_opts.tti = parseInt(kcpOpts.tti || 0, 10) || 0;
            node.kcp_opts.uplink_capacity = parseInt(kcpOpts['uplink-capacity'] || 0, 10) || 0;
            node.kcp_opts.downlink_capacity = parseInt(kcpOpts['downlink-capacity'] || 0, 10) || 0;
            node.kcp_opts.congestion = kcpOpts.congestion === true;
            node.kcp_opts.read_buffer_size = parseInt(kcpOpts['read-buffer-size'] || 0, 10) || 0;
            node.kcp_opts.write_buffer_size = parseInt(kcpOpts['write-buffer-size'] || 0, 10) || 0;
            node.kcp_opts.seed = kcpOpts.seed || '';
            node.kcp_opts.header_type = kcpOpts['header-type'] || proxy['header-type'] || '';
        }

        return node;
    }

    toBoolean(value) {
        return value === true || ['1', 'true', 'yes'].includes(String(value || '').toLowerCase());
    }

    toInteger(value) {
        const parsed = Number(value);
        return Number.isInteger(parsed) ? parsed : 0;
    }

    toList(value) {
        if (!value) return [];
        if (Array.isArray(value)) return value.filter(Boolean);
        return String(value).split(',').map((item) => item.trim()).filter(Boolean);
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
