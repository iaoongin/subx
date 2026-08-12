const BaseGenerator = require("./base");
const yaml = require("js-yaml");

/**
 * Clash format generator
 * Output format: YAML config
 */
class ClashGenerator extends BaseGenerator {
  generate(nodes) {
    return this.generateWithAudit(nodes).content;
  }

  generateWithAudit(nodes) {
    const { validNodes, discarded: validationDiscarded } = this.auditValidNodes(nodes);
    const proxies = [];
    const generatedNodes = [];
    const discarded = [...validationDiscarded];

    for (const node of validNodes) {
      if (!this.isSupportedType(node.type)) {
        discarded.push(this.describeDiscardedNode(node, "unsupported-type"));
        continue;
      }

      try {
        const proxy = this.convertToProxy(node);
        if (!proxy) {
          discarded.push(this.describeDiscardedNode(node, "unsupported-type"));
          continue;
        }

        proxies.push(proxy);
        generatedNodes.push(node);
      } catch (error) {
        const nodeInfo = `${node?.type || "unknown"}://${node?.server || "unknown"}:${node?.port || "unknown"} (${node?.name || "no-name"})`;
        console.error(`Clash proxy conversion failed: ${nodeInfo}`, error);
        discarded.push(this.describeDiscardedNode(node, "convert-error"));
      }
    }

    return {
      content: this.buildConfig(proxies),
      validNodes,
      generatedNodes,
      discarded,
    };
  }

  convertToProxy(node) {
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
      proxy.type = "hysteria2";
      if (node.password) {
        proxy.password = node.password;
      }
      proxy.sni = node.sni || node.server;
      proxy["skip-cert-verify"] = node.skip_cert_verify || false;

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
  }

  isSupportedType(type) {
    return ["ss", "vmess", "trojan", "vless", "hysteria2"].includes(type);
  }

  buildConfig(proxies) {
    const config = {
      port: 7890,
      "socks-port": 7891,
      "allow-lan": false,
      mode: "rule",
      "log-level": "info",
      "external-controller": "127.0.0.1:9090",
      proxies,
      "proxy-groups": this.generateProxyGroups(proxies),
      rules: this.generateRules(),
    };

    return this.toYAML(config);
  }

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

  toYAML(obj) {
    return yaml.dump(obj, {
      lineWidth: -1,
      noRefs: true,
    });
  }
}

module.exports = ClashGenerator;
