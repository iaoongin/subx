const BaseParser = require('./base');

/**
 * Shadowsocks 协议解析器
 * 支持格式: ss://base64(method:password@server:port)#name
 * 或: ss://base64(method:password)@server:port#name
 */
class ShadowsocksParser extends BaseParser {
    /**
     * 解析 Shadowsocks URI
     * @param {string} uri - SS URI
     * @returns {object|null} 标准化节点对象
     */
    parse(uri) {
        try {
            if (!uri.startsWith('ss://')) {
                return null;
            }

            // 移除 ss:// 前缀
            let content = uri.slice(5);

            // 提取节点名称 (fragment)
            let name = '';
            const hashIndex = content.indexOf('#');
            if (hashIndex !== -1) {
                name = this.urlDecode(content.slice(hashIndex + 1));
                content = content.slice(0, hashIndex);
            }

            const node = this.createNode();
            node.type = 'ss';
            node.name = name || 'SS节点';

            // 检查是否是 SIP002 格式 (userinfo@hostname:port)
            const atIndex = content.indexOf('@');

            if (atIndex !== -1) {
                // SIP002 格式: ss://base64(method:password)@server:port?plugin=...#name
                const userInfo = content.slice(0, atIndex);
                const serverInfo = content.slice(atIndex + 1);

                // 解析 userInfo (可能是 base64 编码的)
                let decoded;
                try {
                    decoded = this.base64Decode(userInfo);
                    if (!decoded.includes(':')) {
                        // 解码失败，尝试直接使用
                        decoded = userInfo;
                    }
                } catch {
                    decoded = userInfo;
                }

                // 解析 method:password
                const colonIndex = decoded.indexOf(':');
                if (colonIndex === -1) {
                    console.error('无效的 SS userInfo 格式');
                    return null;
                }

                node.method = decoded.slice(0, colonIndex);
                node.password = decoded.slice(colonIndex + 1);

                // 解析 server:port
                const queryIndex = serverInfo.indexOf('?');
                const serverPart = queryIndex !== -1 ? serverInfo.slice(0, queryIndex) : serverInfo;
                const portIndex = serverPart.lastIndexOf(':');

                if (portIndex === -1) {
                    console.error('无效的 SS server:port 格式');
                    return null;
                }

                node.server = serverPart.slice(0, portIndex);
                node.port = parseInt(serverPart.slice(portIndex + 1), 10);

                // 解析插件参数 (如果有)
                if (queryIndex !== -1) {
                    const params = this.parseQuery(serverInfo.slice(queryIndex));
                    if (params.plugin) {
                        // 暂不处理插件，可以在此扩展
                        console.log('检测到插件:', params.plugin);
                    }
                }
            } else {
                // 旧格式: ss://base64(method:password@server:port)
                const decoded = this.base64Decode(content);

                // 解析 method:password@server:port
                const atSign = decoded.indexOf('@');
                if (atSign === -1) {
                    console.error('无效的 SS 格式');
                    return null;
                }

                const authPart = decoded.slice(0, atSign);
                const serverPart = decoded.slice(atSign + 1);

                // 解析 method:password
                const colonIndex = authPart.indexOf(':');
                if (colonIndex === -1) {
                    console.error('无效的 SS auth 格式');
                    return null;
                }

                node.method = authPart.slice(0, colonIndex);
                node.password = authPart.slice(colonIndex + 1);

                // 解析 server:port
                const portIndex = serverPart.lastIndexOf(':');
                if (portIndex === -1) {
                    console.error('无效的 SS server:port 格式');
                    return null;
                }

                node.server = serverPart.slice(0, portIndex);
                node.port = parseInt(serverPart.slice(portIndex + 1), 10);
            }

            return this.validate(node) ? node : null;
        } catch (error) {
            console.error('解析 SS 节点失败:', error.message);
            return null;
        }
    }

    /**
     * 验证 SS 节点
     * @param {object} node - 节点对象
     * @returns {boolean} 是否有效
     */
    validate(node) {
        if (!super.validate(node)) return false;
        if (!node.method || !node.password) return false;
        if (node.port < 1 || node.port > 65535) return false;
        return true;
    }
}

module.exports = ShadowsocksParser;
