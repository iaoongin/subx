/**
 * 节点合并器
 * 负责合并多个订阅源的节点，去重和排序
 */
const crypto = require("crypto");

class NodeMerger {
    /**
     * 合并节点列表
     * @param {Array<object>} fetchResults - 多个订阅拉取结果
     * @returns {{nodes: Array<object>, dedupReport: Array<object>}} 合并后的节点和去重报告
     */
    merge(fetchResults) {
        const allNodes = [];
        const seen = new Set();
        const dedupGroups = new Map();

        for (const result of fetchResults) {
            const nodes = result.nodes || [];
            for (const node of nodes) {
                const sourcedNode = this.withSourceName(node, result.sourceName);
                const key = this.generateNodeKey(sourcedNode);
                if (!seen.has(key)) {
                    seen.add(key);
                    allNodes.push(sourcedNode);
                    dedupGroups.set(key, {
                        key,
                        kept: sourcedNode,
                        duplicates: [],
                    });
                    continue;
                }

                dedupGroups.get(key).duplicates.push(sourcedNode);
            }
        }

        this.ensureUniqueNames(allNodes);

        // 排序：按类型分组，同类型按名称排序
        allNodes.sort((a, b) => {
            if (a.type !== b.type) {
                const typeOrder = { vmess: 1, vless: 2, trojan: 3, ss: 4, hysteria2: 5 };
                return (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99);
            }
            return (a.name || "").localeCompare(b.name || "");
        });

        const dedupReport = Array.from(dedupGroups.values())
            .filter((group) => group.duplicates.length > 0)
            .sort((a, b) => a.key.localeCompare(b.key));

        return { nodes: allNodes, dedupReport };
    }

    /**
     * 生成节点唯一标识
     * @param {object} node - 节点对象
     * @returns {string} 唯一标识
     */
    generateNodeKey(node) {
        const endpointKey = `${node.type}:${node.server}:${node.port}`;
        const identity = this.getNodeIdentity(node);

        if (!identity) return endpointKey;

        const identityHash = crypto
            .createHash("sha256")
            .update(identity)
            .digest("hex")
            .slice(0, 16);
        return `${endpointKey}:auth=${identityHash}`;
    }

    getNodeIdentity(node) {
        switch (node.type) {
            case "vmess":
                return node.uuid ? `uuid:${node.uuid}` : "";
            case "vless":
                if (!node.uuid) return "";
                return `uuid:${node.uuid}:config=${this.serializeVlessConfig(node)}`;
            case "trojan":
            case "hysteria2":
                return node.password ? `password:${node.password}` : "";
            case "ss":
                return node.method && node.password
                    ? `method:${node.method}:password:${node.password}`
                    : "";
            default:
                return "";
        }
    }

    serializeVlessConfig(node) {
        const uriParams = node.uri_params || {};
        if (Object.keys(uriParams).length > 0) {
            return JSON.stringify(
                Object.fromEntries(Object.entries(uriParams).sort(([left], [right]) => left.localeCompare(right))),
            );
        }

        return JSON.stringify({
            cipher: node.cipher || "",
            flow: node.flow || "",
            security: node.security || (node.tls ? "tls" : "none"),
            network: node.network || "tcp",
            sni: node.sni || "",
            alpn: node.alpn || [],
            packet_encoding: node.packet_encoding || "",
            client_fingerprint: node.client_fingerprint || "",
            reality_opts: node.reality_opts || {},
            ws_opts: node.ws_opts || {},
            grpc_opts: node.grpc_opts || {},
            h2_opts: node.h2_opts || {},
            httpupgrade_opts: node.httpupgrade_opts || {},
            xhttp_opts: node.xhttp_opts || {},
            quic_opts: node.quic_opts || {},
            kcp_opts: node.kcp_opts || {},
            tcp_opts: node.tcp_opts || {},
            tls_opts: node.tls_opts || {}
        });
    }

    withSourceName(node, sourceName) {
        if (!sourceName) return { ...node };

        const originalName = node.name || "Unnamed Node";
        return { ...node, name: `${originalName} (${sourceName})` };
    }

    ensureUniqueNames(nodes) {
        const counts = new Map();
        for (const node of nodes) {
            const name = node.name || "Unnamed Node";
            const count = (counts.get(name) || 0) + 1;
            counts.set(name, count);
            node.name = count === 1 ? name : `${name} (${count})`;
        }
    }

    /**
     * 按类型过滤节点
     * @param {Array<object>} nodes - 节点列表
     * @param {string} type - 节点类型
     * @returns {Array<object>} 过滤后的节点列表
     */
    filterByType(nodes, type) {
        return nodes.filter((node) => node.type === type);
    }

    /**
     * 获取节点统计信息
     * @param {Array<object>} nodes - 节点列表
     * @returns {{total: number, byType: Record<string, number>}} 统计信息
     */
    getStats(nodes) {
        const stats = {
            total: nodes.length,
            byType: {},
        };

        for (const node of nodes) {
            stats.byType[node.type] = (stats.byType[node.type] || 0) + 1;
        }

        return stats;
    }
}

module.exports = NodeMerger;
