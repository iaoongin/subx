const BaseGenerator = require("./base");

/**
 * Clash 格式生成器
 * 输出格式: YAML 配置文件
 */
class ClashGenerator extends BaseGenerator {
  /**
   * 生成 Clash 配置
   * @param {Array} nodes - 节点列表
   * @returns {string} YAML 配置内容
   */
  generate(nodes) {
    const validNodes = this.filterValidNodes(nodes);
    const proxies = [];

    for (const node of validNodes) {
      const proxy = this.convertToProxy(node);
      if (proxy) {
        proxies.push(proxy);
      }
    }

    // 构建 Clash 配置
    const config = {
      port: 7890,
      "socks-port": 7891,
      "allow-lan": false,
      mode: "rule",
      "log-level": "info",
      "external-controller": "127.0.0.1:9090",
      proxies: proxies,
      "proxy-groups": this.generateProxyGroups(proxies),
      rules: this.generateRules(),
    };

    // 转换为 YAML (手动实现，避免依赖)
    return this.toYAML(config);
  }

  /**
   * 将节点转换为 Clash 代理配置
   * @param {object} node - 节点对象
   * @returns {object|null} Clash 代理对象
   */
  convertToProxy(node) {
    try {
      const proxy = {
        name: node.name,
        server: node.server,
        port: node.port,
        udp: node.udp !== false,
      };

      if (node.type === "ss") {
        proxy.type = "ss";
        proxy.cipher = node.method;
        proxy.password = node.password;
      } else if (node.type === "vmess") {
        proxy.type = "vmess";
        proxy.uuid = node.uuid;
        proxy.alterId = node.alterId || 0;
        proxy.cipher = node.cipher || "auto";
        proxy.tls = node.tls;
        proxy.network = node.network || "tcp";

        if (node.network === "ws") {
          proxy["ws-opts"] = {
            path: node.ws_opts.path || "/",
            headers: node.ws_opts.headers || {},
          };
        } else if (node.network === "h2") {
          proxy["h2-opts"] = {
            host: node.h2_opts.host || [],
            path: node.h2_opts.path || "/",
          };
        } else if (node.network === "grpc") {
          proxy["grpc-opts"] = {
            "grpc-service-name": node.grpc_opts.service_name || "",
          };
        }

        if (node.tls) {
          proxy.servername = node.sni || node.server;
          if (node.skip_cert_verify) {
            proxy["skip-cert-verify"] = true;
          }
        }
      } else if (node.type === "trojan") {
        proxy.type = "trojan";
        proxy.password = node.password;
        proxy.sni = node.sni || node.server;
        proxy["skip-cert-verify"] = node.skip_cert_verify || false;

        if (node.network === "ws") {
          proxy.network = "ws";
          proxy["ws-opts"] = {
            path: node.ws_opts.path || "/",
            headers: node.ws_opts.headers || {},
          };
        } else if (node.network === "grpc") {
          proxy.network = "grpc";
          proxy["grpc-opts"] = {
            "grpc-service-name": node.grpc_opts.service_name || "",
          };
        }
      } else if (node.type === "vless") {
        // Clash Meta 支持 VLESS
        proxy.type = "vless";
        proxy.uuid = node.uuid;
        proxy.tls = node.tls;
        proxy.network = node.network || "tcp";

        if (node.flow) {
          proxy.flow = node.flow;
        }

        if (node.network === "ws") {
          proxy["ws-opts"] = {
            path: node.ws_opts.path || "/",
            headers: node.ws_opts.headers || {},
          };
        } else if (node.network === "grpc") {
          proxy["grpc-opts"] = {
            "grpc-service-name": node.grpc_opts.service_name || "",
          };
        }

        if (node.tls) {
          proxy.servername = node.sni || node.server;
          if (node.skip_cert_verify) {
            proxy["skip-cert-verify"] = true;
          }
        }
      } else if (node.type === "hysteria2") {
        // Clash Meta 支持 Hysteria2
        proxy.type = "hysteria2";
        if (node.password) {
          proxy.password = node.password;
        }
        proxy.sni = node.sni || node.server;
        proxy["skip-cert-verify"] = node.skip_cert_verify || false;

        // 混淆配置
        if (node.hysteria2_opts && node.hysteria2_opts.obfs) {
          proxy.obfs = node.hysteria2_opts.obfs;
          if (node.hysteria2_opts.obfs_password) {
            proxy["obfs-password"] = node.hysteria2_opts.obfs_password;
          }
        }
      } else {
        return null;
      }

      return proxy;
    } catch (error) {
      const nodeInfo = `${node?.type || "unknown"}://${node?.server || "unknown"}:${node?.port || "unknown"} (${node?.name || "no-name"})`;
      console.error(`转换 Clash 代理失败: ${nodeInfo}`, error);
      return null;
    }
  }

  /**
   * 生成代理组
   * @param {Array} proxies - 代理列表
   * @returns {Array} 代理组配置
   */
  generateProxyGroups(proxies) {
    const proxyNames = proxies.map((p) => p.name);

    return [
      {
        name: "🚀 节点选择",
        type: "select",
        proxies: ["♻️ 自动选择", "🔰 故障转移", "DIRECT"].concat(proxyNames),
      },
      {
        name: "♻️ 自动选择",
        type: "url-test",
        proxies: proxyNames,
        url: "http://www.gstatic.com/generate_204",
        interval: 300,
      },
      {
        name: "🔰 故障转移",
        type: "fallback",
        proxies: proxyNames,
        url: "http://www.gstatic.com/generate_204",
        interval: 300,
      },
    ];
  }

  /**
   * 生成规则
   * @returns {Array} 规则列表
   */
  generateRules() {
    return [
      "DOMAIN-SUFFIX,local,DIRECT",
      "IP-CIDR,127.0.0.0/8,DIRECT",
      "IP-CIDR,172.16.0.0/12,DIRECT",
      "IP-CIDR,192.168.0.0/16,DIRECT",
      "IP-CIDR,10.0.0.0/8,DIRECT",
      "IP-CIDR,224.0.0.0/4,DIRECT",
      "IP-CIDR,240.0.0.0/4,DIRECT",
      "GEOIP,CN,DIRECT",
      "MATCH,🚀 节点选择",
    ];
  }

  /**
   * 转换对象为 YAML 格式 (简化版)
   * @param {object} obj - 对象
   * @param {number} indent - 缩进级别
   * @returns {string} YAML 字符串
   */
  toYAML(obj, indent = 0) {
    const spaces = "  ".repeat(indent);
    let yaml = "";

    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) {
        continue;
      }

      if (Array.isArray(value)) {
        yaml += `${spaces}${key}:\n`;
        for (const item of value) {
          if (typeof item === "object") {
            // 生成对象的 YAML，然后将第一行与 - 合并
            const itemYaml = this.toYAML(item, indent + 2);
            const lines = itemYaml.split("\n").filter((line) => line.trim());

            if (lines.length > 0) {
              // 第一行：- key: value
              yaml += `${spaces}  - ${lines[0].trim()}\n`;
              // 剩余行：保持缩进
              for (let i = 1; i < lines.length; i++) {
                yaml += `${spaces}    ${lines[i].trim()}\n`;
              }
            }
          } else {
            yaml += `${spaces}  - ${this.escapeYAML(item)}\n`;
          }
        }
      } else if (typeof value === "object") {
        yaml += `${spaces}${key}:\n`;
        yaml += this.toYAML(value, indent + 1);
      } else {
        yaml += `${spaces}${key}: ${this.escapeYAML(value)}\n`;
      }
    }

    return yaml;
  }

  /**
   * 转义 YAML 值
   * @param {*} value - 值
   * @returns {string} 转义后的值
   */
  escapeYAML(value) {
    if (typeof value === "string") {
      // 如果包含特殊字符，使用引号
      if (
        value.includes(":") ||
        value.includes("#") ||
        value.includes("[") ||
        value.includes("]") ||
        value.includes("{") ||
        value.includes("}")
      ) {
        return `"${value.replace(/"/g, '\\"')}"`;
      }
      return value;
    }
    return String(value);
  }
}

module.exports = ClashGenerator;
