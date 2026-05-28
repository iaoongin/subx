/**
 * 基础配置生成器类
 */
class BaseGenerator {
    /**
     * 生成配置
     * @param {Array} nodes - 节点列表
     * @returns {string} 配置内容
     */
    generate(nodes) {
        throw new Error('generate() 方法必须在子类中实现');
    }

    /**
     * Base64 编码
     * @param {string} str - 原始字符串
     * @returns {string} Base64 字符串
     */
    base64Encode(str) {
        return Buffer.from(str, 'utf8').toString('base64');
    }

    /**
     * URL 编码
     * @param {string} str - 原始字符串
     * @returns {string} URL编码的字符串
     */
    urlEncode(str) {
        return encodeURIComponent(str);
    }

    /**
     * 过滤有效节点
     * @param {Array} nodes - 节点列表
     * @returns {Array} 有效节点列表
     */
    filterValidNodes(nodes) {
        return this.auditValidNodes(nodes).validNodes;
    }

    auditValidNodes(nodes) {
        const validNodes = [];
        const discarded = [];

        for (const node of nodes || []) {
            if (!node) {
                discarded.push(this.describeDiscardedNode(node, 'empty-node'));
                continue;
            }

            if (!node.server) {
                discarded.push(this.describeDiscardedNode(node, 'missing-server'));
                continue;
            }

            if (node.port === undefined || node.port === null || node.port === '') {
                discarded.push(this.describeDiscardedNode(node, 'missing-port'));
                continue;
            }

            validNodes.push(node);
        }

        return { validNodes, discarded };
    }

    describeDiscardedNode(node, reason) {
        return {
            reason,
            type: node?.type || 'unknown',
            name: node?.name || '',
            server: node?.server || '',
            port: node?.port ?? null,
        };
    }
}

module.exports = BaseGenerator;
