const BaseGenerator = require('./base');

/**
 * Mixed URI subscription generator.
 * The result is a Base64 encoded list of protocol-specific share links.
 */
class MixedURIGenerator extends BaseGenerator {
    generate(nodes) {
        const validNodes = this.filterValidNodes(nodes);
        const lines = validNodes
            .map((node) => this.convertToUri(node))
            .filter(Boolean);

        return this.base64Encode(lines.join('\n'));
    }

    convertToUri(node) {
        try {
            if (node?.raw && /^(vmess|vless|ss|trojan|hysteria2|hy2):\/\//i.test(node.raw)) {
                return this.renameRawUri(node.raw, node.name, node.sourceName);
            }

            switch (node?.type) {
                case 'ss':
                    return this.serializeShadowsocks(node);
                case 'vmess':
                    return this.serializeVMess(node);
                case 'vless':
                    return this.serializeVLESS(node);
                case 'trojan':
                    return this.serializeTrojan(node);
                case 'hysteria2':
                    return this.serializeHysteria2(node);
                default:
                    return null;
            }
        } catch (error) {
            console.error('转换混合 URI 失败:', error.message);
            return null;
        }
    }

    renameRawUri(raw, name, sourceName = '') {
        const uri = String(raw).trim();
        if (!name) return uri;

        const currentName = this.getRawUriName(uri);
        if (currentName === name || (!currentName && !sourceName)) return uri;

        if (/^vmess:\/\//i.test(uri)) {
            const renamedVmess = this.renameVmessUri(uri, name);
            if (renamedVmess) return renamedVmess;
        }

        return this.renameFragment(uri, name);
    }

    getRawUriName(uri) {
        const hashIndex = uri.indexOf('#');
        const fragment = hashIndex === -1 ? '' : uri.slice(hashIndex + 1);
        const decodedFragment = fragment ? this.decodeFragment(fragment) : '';

        if (!/^vmess:\/\//i.test(uri)) return decodedFragment;

        const content = uri.slice(uri.indexOf('://') + 3, hashIndex === -1 ? uri.length : hashIndex);
        try {
            const config = JSON.parse(this.base64Decode(content));
            return config.ps || config.remark || decodedFragment;
        } catch {
            return decodedFragment;
        }
    }

    renameVmessUri(uri, name) {
        const hashIndex = uri.indexOf('#');
        const content = uri.slice(uri.indexOf('://') + 3, hashIndex === -1 ? uri.length : hashIndex);

        try {
            const config = JSON.parse(this.base64Decode(content));
            config.ps = name;
            return `vmess://${this.base64Encode(JSON.stringify(config))}`;
        } catch {
            return '';
        }
    }

    renameFragment(uri, name) {
        const hashIndex = uri.indexOf('#');
        const base = hashIndex === -1 ? uri : uri.slice(0, hashIndex);
        return `${base}#${encodeURIComponent(name)}`;
    }

    base64Decode(value) {
        const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
        return Buffer.from(normalized, 'base64').toString('utf8');
    }

    decodeFragment(fragment) {
        try {
            return decodeURIComponent(fragment);
        } catch {
            return fragment;
        }
    }

    serializeShadowsocks(node) {
        const userInfo = this.base64UrlEncode(`${node.method}:${node.password}`);
        const query = {};
        if (node.plugin) {
            query.plugin = this.serializePlugin(node.plugin, node.plugin_opts);
        }

        return this.withQuery(
            `ss://${userInfo}@${this.endpoint(node.server, node.port)}`,
            query,
            node.name,
        );
    }

    serializeVMess(node) {
        const config = {
            v: '2',
            ps: node.name || 'VMess Node',
            add: node.server,
            port: node.port,
            id: node.uuid,
            aid: node.alterId || 0,
            scy: node.cipher || 'auto',
            net: node.network || 'tcp',
            type: 'none',
            host: this.transportHost(node),
            path: this.transportPath(node),
            tls: node.tls ? 'tls' : '',
            sni: node.sni || ''
        };

        if (node.alpn?.length > 0) config.alpn = node.alpn.join(',');
        if (node.skip_cert_verify) config.allowInsecure = '1';
        if (node.network === 'grpc') {
            config.path = node.grpc_opts?.service_name || '';
            if (node.grpc_opts?.authority) config.authority = node.grpc_opts.authority;
        }

        return `vmess://${this.base64Encode(JSON.stringify(config))}`;
    }

    serializeVLESS(node) {
        const query = {
            ...(node.uri_params || {}),
            encryption: node.cipher || 'none',
            flow: node.flow,
            security: node.security || (node.tls ? 'tls' : 'none'),
            sni: node.sni,
            alpn: node.alpn?.join(','),
            allowInsecure: node.skip_cert_verify ? '1' : '',
            fp: node.client_fingerprint,
            pbk: node.reality_opts?.public_key,
            sid: node.reality_opts?.short_id,
            spx: node.reality_opts?.spider_x,
            pqv: node.reality_opts?.mldsa65_verify,
            'packet-encoding': node.packet_encoding,
            type: node.network || 'tcp',
            headerType: node.tcp_opts?.header_type,
            echConfig: node.tls_opts?.ech_config,
            echDohServer: node.tls_opts?.ech_doh_server,
            echForceQuery: node.tls_opts?.ech_force_query ? '1' : '',
            pinSHA256: node.tls_opts?.pinned_peer_certificate_chain_sha256?.join(',')
        };

        this.addTransportQuery(query, node);
        return this.withQuery(
            `vless://${encodeURIComponent(node.uuid)}@${this.endpoint(node.server, node.port)}`,
            query,
            node.name,
        );
    }

    serializeTrojan(node) {
        const query = {
            sni: node.sni || node.server,
            alpn: node.alpn?.join(','),
            allowInsecure: node.skip_cert_verify ? '1' : '',
            type: node.network === 'tcp' ? '' : node.network
        };
        this.addTransportQuery(query, node);

        return this.withQuery(
            `trojan://${encodeURIComponent(node.password)}@${this.endpoint(node.server, node.port)}`,
            query,
            node.name,
        );
    }

    serializeHysteria2(node) {
        const opts = node.hysteria2_opts || {};
        const query = {
            sni: node.sni || node.server,
            insecure: node.skip_cert_verify ? '1' : '',
            obfs: opts.obfs,
            'obfs-password': opts.obfs_password,
            pinSHA256: opts.pinSHA256
        };

        return this.withQuery(
            `hysteria2://${encodeURIComponent(node.password || '')}@${this.endpoint(node.server, node.port)}`,
            query,
            node.name,
        );
    }

    addTransportQuery(query, node) {
        const network = node.network || 'tcp';
        if (network === 'ws') {
            query.path = node.ws_opts?.path;
            query.host = node.ws_opts?.headers?.Host;
            query.ed = node.ws_opts?.max_early_data;
            query.eh = node.ws_opts?.early_data_header_name;
        } else if (network === 'h2' || network === 'http') {
            query.path = node.h2_opts?.path;
            query.host = node.h2_opts?.host?.join(',');
            query.method = node.h2_opts?.method;
        } else if (network === 'grpc') {
            query.serviceName = node.grpc_opts?.service_name;
            query.authority = node.grpc_opts?.authority;
            query.mode = node.grpc_opts?.mode;
        } else if (network === 'httpupgrade') {
            query.path = node.httpupgrade_opts?.path;
            query.host = node.httpupgrade_opts?.host;
            query.headers = this.jsonQueryValue(node.httpupgrade_opts?.headers);
        } else if (network === 'xhttp' || network === 'splithttp') {
            query.path = node.xhttp_opts?.path;
            query.host = node.xhttp_opts?.host?.join(',');
            query.mode = node.xhttp_opts?.mode;
            query.extra = this.jsonQueryValue(node.xhttp_opts?.extra);
            query.scMaxEachPostBytes = node.xhttp_opts?.sc_max_each_post_bytes;
            query.noSSEHeader = node.xhttp_opts?.no_sse_header ? '1' : '';
            query.xmux = this.jsonQueryValue(node.xhttp_opts?.xmux);
        } else if (network === 'quic') {
            query.quicSecurity = node.quic_opts?.security;
            query.key = node.quic_opts?.key;
        } else if (network === 'kcp' || network === 'mkcp') {
            query.mtu = node.kcp_opts?.mtu;
            query.tti = node.kcp_opts?.tti;
            query.uplinkCapacity = node.kcp_opts?.uplink_capacity;
            query.downlinkCapacity = node.kcp_opts?.downlink_capacity;
            query.congestion = node.kcp_opts?.congestion ? '1' : '';
            query.readBufferSize = node.kcp_opts?.read_buffer_size;
            query.writeBufferSize = node.kcp_opts?.write_buffer_size;
            query.seed = node.kcp_opts?.seed;
        }
    }

    transportHost(node) {
        if (node.network === 'ws') return node.ws_opts?.headers?.Host || '';
        return node.h2_opts?.host?.join(',') || '';
    }

    transportPath(node) {
        if (node.network === 'grpc') return node.grpc_opts?.service_name || '';
        if (node.network === 'ws') return node.ws_opts?.path || '/';
        return node.h2_opts?.path || '/';
    }

    serializePlugin(plugin, options = {}) {
        const parts = [plugin];
        for (const [key, value] of Object.entries(options || {})) {
            if (value !== undefined && value !== null && value !== '') {
                parts.push(`${key}=${value}`);
            }
        }
        return parts.join(';');
    }

    jsonQueryValue(value) {
        if (!value || typeof value !== 'object' || Object.keys(value).length === 0) return '';
        return JSON.stringify(value);
    }

    withQuery(uri, query, name) {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(query || {})) {
            if (value !== undefined && value !== null && value !== '' && value !== 0) {
                params.set(key, String(value));
            }
        }

        const queryText = params.toString();
        const fragment = name ? `#${encodeURIComponent(name)}` : '';
        return `${uri}${queryText ? `?${queryText}` : ''}${fragment}`;
    }

    endpoint(server, port) {
        const host = String(server || '');
        const formattedHost = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
        return `${formattedHost}:${port}`;
    }

    base64UrlEncode(value) {
        return this.base64Encode(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    }
}

module.exports = MixedURIGenerator;
