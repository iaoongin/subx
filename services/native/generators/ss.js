const BaseGenerator = require('./base');

/**
 * Shadowsocks 格式生成器
 * 输出格式: Base64编码的 ss:// URI 列表
 */
class SSGenerator extends BaseGenerator {
    /**
     * 生成 SS 订阅内容
     * @param {Array} nodes - 节点列表
     * @returns {string} Base64 编码的订阅内容
     */
    generate(nodes) {
        const validNodes = this.filterValidNodes(nodes);
        const lines = [];

        for (const node of validNodes) {
            const uri = this.convertToUri(node);
            if (uri) {
                lines.push(uri);
            }
        }

        // Base64 编码整个订阅
        return this.base64Encode(lines.join('\n'));
    }

    /**
     * 将节点转换为 ss:// URI
     * @param {object} node - 节点对象
     * @returns {string|null} SS URI
     */
    convertToUri(node) {
        try {
            // 只处理 SS 节点
            if (node.type !== 'ss') {
                // 允许多协议输出：保留原始 URI（若存在）
                if (node.raw && /^(vmess|vless|trojan|hysteria2|ss):\/\//i.test(node.raw)) {
                    return node.raw.trim();
                }
                return null;
            }

            // SIP002 格式: ss://base64(method:password)@server:port#name
            const userInfo = `${node.method}:${node.password}`;
            const encodedUserInfo = this.base64Encode(userInfo);
            const serverInfo = `${node.server}:${node.port}`;
            const name = this.urlEncode(node.name || 'SS Node');

            return `ss://${encodedUserInfo}@${serverInfo}#${name}`;
        } catch (error) {
            console.error('转换 SS URI 失败:', error.message);
            return null;
        }
    }
}

module.exports = SSGenerator;
