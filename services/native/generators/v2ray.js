const BaseGenerator = require('./base');

/**
 * V2Ray 格式生成器
 * 输出格式: JSON 配置文件
 */
class V2RayGenerator extends BaseGenerator {
    /**
     * 生成 V2Ray 配置
     * @param {Array} nodes - 节点列表
     * @returns {string} JSON 配置内容
     */
    generate(nodes) {
        const validNodes = this.filterValidNodes(nodes);
        const outbounds = [];

        for (const node of validNodes) {
            const outbound = this.convertToOutbound(node);
            if (outbound) {
                outbounds.push(outbound);
            }
        }

        // 构建 V2Ray 配置
        const config = {
            log: {
                loglevel: 'warning'
            },
            inbounds: [
                {
                    port: 1080,
                    listen: '127.0.0.1',
                    protocol: 'socks',
                    settings: {
                        udp: true
                    }
                },
                {
                    port: 1081,
                    listen: '127.0.0.1',
                    protocol: 'http'
                }
            ],
            outbounds: outbounds.concat([
                {
                    protocol: 'freedom',
                    tag: 'direct'
                }
            ]),
            routing: {
                domainStrategy: 'IPOnDemand',
                rules: [
                    {
                        type: 'field',
                        ip: ['geoip:private', 'geoip:cn'],
                        outboundTag: 'direct'
                    }
                ]
            }
        };

        return JSON.stringify(config, null, 2);
    }

    /**
     * 将节点转换为 V2Ray outbound 配置
     * @param {object} node - 节点对象
     * @returns {object|null} V2Ray outbound 对象
     */
    convertToOutbound(node) {
        try {
            const outbound = {
                protocol: node.type,
                tag: node.name,
                settings: {},
                streamSettings: {}
            };

            if (node.type === 'vmess') {
                outbound.settings.vnext = [{
                    address: node.server,
                    port: node.port,
                    users: [{
                        id: node.uuid,
                        alterId: node.alterId || 0,
                        security: node.cipher || 'auto'
                    }]
                }];

                this.addStreamSettings(outbound.streamSettings, node);
            } else if (node.type === 'vless') {
                outbound.settings.vnext = [{
                    address: node.server,
                    port: node.port,
                    users: [{
                        id: node.uuid,
                        encryption: node.cipher || 'none',
                        flow: node.flow || '',
                        ...(node.packet_encoding ? { packetEncoding: node.packet_encoding } : {})
                    }]
                }];

                this.addStreamSettings(outbound.streamSettings, node);
            } else if (node.type === 'trojan') {
                outbound.settings.servers = [{
                    address: node.server,
                    port: node.port,
                    password: node.password
                }];

                this.addStreamSettings(outbound.streamSettings, node);
            } else if (node.type === 'shadowsocks' || node.type === 'ss') {
                outbound.protocol = 'shadowsocks';
                outbound.settings.servers = [{
                    address: node.server,
                    port: node.port,
                    method: node.method,
                    password: node.password
                }];
            } else {
                return null;
            }

            return outbound;
        } catch (error) {
            console.error('转换 V2Ray outbound 失败:', error.message);
            return null;
        }
    }

    /**
     * 添加传输层配置
     * @param {object} streamSettings - 传输层设置对象
     * @param {object} node - 节点对象
     */
    addStreamSettings(streamSettings, node) {
        streamSettings.network = node.network === 'splithttp' ? 'xhttp' : (node.network || 'tcp');

        const security = node.type === 'vless'
            ? (node.security || (node.tls ? 'tls' : 'none'))
            : (node.tls ? 'tls' : 'none');
        if (security === 'reality') {
            streamSettings.security = 'reality';
            streamSettings.realitySettings = {
                show: false,
                fingerprint: node.client_fingerprint || '',
                serverName: node.sni || node.server,
                publicKey: node.reality_opts?.public_key || '',
                shortId: node.reality_opts?.short_id || '',
                spiderX: node.reality_opts?.spider_x || ''
            };
            if (node.reality_opts?.mldsa65_verify) {
                streamSettings.realitySettings.mldsa65Verify = node.reality_opts.mldsa65_verify;
            }
            this.addTlsOptions(streamSettings.realitySettings, node.tls_opts);
        } else if (security === 'tls') {
            streamSettings.security = 'tls';
            streamSettings.tlsSettings = {
                serverName: node.sni || node.server,
                allowInsecure: node.skip_cert_verify || false,
                fingerprint: node.client_fingerprint || ''
            };

            if (node.alpn && node.alpn.length > 0) {
                streamSettings.tlsSettings.alpn = node.alpn;
            }
            this.addTlsOptions(streamSettings.tlsSettings, node.tls_opts);
        }

        if (node.network === 'ws') {
            const wsOpts = node.ws_opts || {};
            streamSettings.wsSettings = {
                path: this.addWebSocketEarlyData(wsOpts.path || '/', wsOpts),
                headers: wsOpts.headers || {}
            };
        } else if (node.network === 'h2' || node.network === 'http') {
            const h2Opts = node.h2_opts || {};
            streamSettings.httpSettings = {
                host: h2Opts.host || [],
                path: h2Opts.path || '/'
            };
            if (h2Opts.method) {
                streamSettings.httpSettings.method = h2Opts.method;
            }
            if (h2Opts.headers && Object.keys(h2Opts.headers).length > 0) {
                streamSettings.httpSettings.headers = h2Opts.headers;
            }
        } else if (node.network === 'grpc') {
            const grpcOpts = node.grpc_opts || {};
            streamSettings.grpcSettings = {
                serviceName: grpcOpts.service_name || ''
            };
            if (grpcOpts.authority) {
                streamSettings.grpcSettings.authority = grpcOpts.authority;
            }
            if (grpcOpts.mode) {
                streamSettings.grpcSettings.multiMode = grpcOpts.mode === 'multi';
            }
        } else if (node.network === 'httpupgrade') {
            const httpUpgradeOpts = node.httpupgrade_opts || {};
            streamSettings.httpupgradeSettings = {
                path: httpUpgradeOpts.path || '/',
                host: httpUpgradeOpts.host || '',
                headers: httpUpgradeOpts.headers || {}
            };
        } else if (node.network === 'xhttp' || node.network === 'splithttp') {
            const xhttpOpts = node.xhttp_opts || {};
            streamSettings.xhttpSettings = {
                path: xhttpOpts.path || '/',
                host: xhttpOpts.host || [],
                mode: xhttpOpts.mode || 'auto',
                extra: xhttpOpts.extra || {}
            };
            if (xhttpOpts.sc_max_each_post_bytes) {
                streamSettings.xhttpSettings.scMaxEachPostBytes = xhttpOpts.sc_max_each_post_bytes;
            }
            if (xhttpOpts.no_sse_header) {
                streamSettings.xhttpSettings.noSSEHeader = true;
            }
            if (xhttpOpts.xmux && Object.keys(xhttpOpts.xmux).length > 0) {
                streamSettings.xhttpSettings.xmux = xhttpOpts.xmux;
            }
        } else if (node.network === 'quic') {
            const quicOpts = node.quic_opts || {};
            streamSettings.quicSettings = {
                security: quicOpts.security || '',
                key: quicOpts.key || '',
                header: {
                    type: quicOpts.header_type || node.tcp_opts?.header_type || 'none'
                }
            };
        } else if (node.network === 'kcp' || node.network === 'mkcp') {
            const kcpSettings = {};
            const kcpOpts = node.kcp_opts || {};
            if (kcpOpts.mtu) kcpSettings.mtu = kcpOpts.mtu;
            if (kcpOpts.tti) kcpSettings.tti = kcpOpts.tti;
            if (kcpOpts.uplink_capacity) kcpSettings.uplinkCapacity = kcpOpts.uplink_capacity;
            if (kcpOpts.downlink_capacity) kcpSettings.downlinkCapacity = kcpOpts.downlink_capacity;
            if (kcpOpts.congestion) kcpSettings.congestion = true;
            if (kcpOpts.read_buffer_size) kcpSettings.readBufferSize = kcpOpts.read_buffer_size;
            if (kcpOpts.write_buffer_size) kcpSettings.writeBufferSize = kcpOpts.write_buffer_size;
            if (kcpOpts.seed) kcpSettings.seed = kcpOpts.seed;
            if (kcpOpts.header_type || node.tcp_opts?.header_type) {
                kcpSettings.header = { type: kcpOpts.header_type || node.tcp_opts?.header_type };
            }
            streamSettings.kcpSettings = kcpSettings;
        } else if (node.network === 'tcp' && node.tcp_opts?.header_type) {
            streamSettings.tcpSettings = {
                header: {
                    type: node.tcp_opts.header_type
                }
            };
        }
    }

    addTlsOptions(settings, tlsOpts = {}) {
        if (tlsOpts.ech_config) settings.echConfig = tlsOpts.ech_config;
        if (tlsOpts.ech_doh_server) settings.echDohServer = tlsOpts.ech_doh_server;
        if (tlsOpts.ech_force_query) settings.echForceQuery = true;
        if (tlsOpts.pinned_peer_certificate_chain_sha256?.length > 0) {
            settings.pinnedPeerCertificateChainSha256 = tlsOpts.pinned_peer_certificate_chain_sha256;
        }
    }

    addWebSocketEarlyData(path, wsOpts) {
        if (!wsOpts?.max_early_data || /(?:^|[?&])ed=/.test(path)) {
            return path;
        }

        return `${path}${path.includes('?') ? '&' : '?'}ed=${wsOpts.max_early_data}`;
    }
}

module.exports = V2RayGenerator;
