/**
 * 节点合并器
 * 负责合并多个订阅源的节点，去重和排序
 */
class NodeMerger {
    /**
     * 合并节点列表
     * @param {Array<Array>} nodeLists - 多个节点列表
     * @returns {Array} 合并后的节点列表
     */
    merge(fetchResults) {
        const allNodes = [];
        const seen = new Set();

        for (const result of fetchResults) {
            const nodes = result.nodes || [];
            for (const node of nodes) {
                const key = this.generateNodeKey(node);
                if (!seen.has(key)) {
                    seen.add(key);
                    allNodes.push(node);
                }
            }
        }

        // 排序：按类型分组，同类型按名称排序
        allNodes.sort((a, b) => {
            if (a.type !== b.type) {
                const typeOrder = { vmess: 1, vless: 2, trojan: 3, ss: 4 };
                return (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99);
            }
            return (a.name || '').localeCompare(b.name || '');
        });

        return allNodes;
    }

    /**
     * 生成节点唯一标识
     * @param {object} node - 节点对象
     * @returns {string} 唯一标识
     */
    generateNodeKey(node) {
        // 使用 server + port + type 作为唯一标识
        return `${node.type}:${node.server}:${node.port}`;
    }

    /**
     * 按类型过滤节点
     * @param {Array} nodes - 节点列表
     * @param {string} type - 节点类型
     * @returns {Array} 过滤后的节点列表
     */
    filterByType(nodes, type) {
        return nodes.filter(node => node.type === type);
    }

    /**
     * 获取节点统计信息
     * @param {Array} nodes - 节点列表
     * @returns {object} 统计信息
     */
    getStats(nodes) {
        const stats = {
            total: nodes.length,
            byType: {}
        };

        for (const node of nodes) {
            stats.byType[node.type] = (stats.byType[node.type] || 0) + 1;
        }

        return stats;
    }
}

module.exports = NodeMerger;
