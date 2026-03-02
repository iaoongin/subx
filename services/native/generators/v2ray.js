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
                        flow: node.flow || ''
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
        streamSettings.network = node.network || 'tcp';

        if (node.tls) {
            streamSettings.security = 'tls';
            streamSettings.tlsSettings = {
                serverName: node.sni || node.server,
                allowInsecure: node.skip_cert_verify || false
            };

            if (node.alpn && node.alpn.length > 0) {
                streamSettings.tlsSettings.alpn = node.alpn;
            }
        }

        if (node.network === 'ws') {
            streamSettings.wsSettings = {
                path: node.ws_opts.path || '/',
                headers: node.ws_opts.headers || {}
            };
        } else if (node.network === 'h2' || node.network === 'http') {
            streamSettings.httpSettings = {
                host: node.h2_opts.host || [],
                path: node.h2_opts.path || '/'
            };
        } else if (node.network === 'grpc') {
            streamSettings.grpcSettings = {
                serviceName: node.grpc_opts.service_name || ''
            };
        }
    }
}

module.exports = V2RayGenerator;
