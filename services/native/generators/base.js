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
        return nodes.filter(node => node && node.server && node.port);
    }
}

module.exports = BaseGenerator;
