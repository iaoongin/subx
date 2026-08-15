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
      proxy.encryption = node.cipher || "none";
      proxy.tls = node.tls;
      proxy.network = node.network === "splithttp" ? "xhttp" : (node.network || "tcp");

      if (node.flow) {
        proxy.flow = node.flow;
      }
      if (node.packet_encoding) {
        proxy["packet-encoding"] = node.packet_encoding;
      }
      if (node.alpn && node.alpn.length > 0) {
        proxy.alpn = node.alpn;
      }
      if (node.client_fingerprint) {
        proxy["client-fingerprint"] = node.client_fingerprint;
      }

      if (node.network === "ws") {
        const wsOpts = node.ws_opts || {};
        proxy["ws-opts"] = {
          path: wsOpts.path || "/",
          headers: wsOpts.headers || {},
        };
        if (wsOpts.max_early_data) {
          proxy["ws-opts"]["max-early-data"] = wsOpts.max_early_data;
        }
        if (wsOpts.early_data_header_name) {
          proxy["ws-opts"]["early-data-header-name"] = wsOpts.early_data_header_name;
        }
      } else if (node.network === "grpc") {
        const grpcOpts = node.grpc_opts || {};
        proxy["grpc-opts"] = {
          "grpc-service-name": grpcOpts.service_name || "",
        };
        if (grpcOpts.authority) {
          proxy["grpc-opts"].authority = grpcOpts.authority;
        }
        if (grpcOpts.mode) {
          proxy["grpc-opts"]["grpc-mode"] = grpcOpts.mode;
        }
      } else if (node.network === "h2") {
        const h2Opts = node.h2_opts || {};
        proxy["h2-opts"] = {
          host: h2Opts.host || [],
          path: h2Opts.path || "/",
        };
        if (h2Opts.method) {
          proxy["h2-opts"].method = h2Opts.method;
        }
        if (h2Opts.headers && Object.keys(h2Opts.headers).length > 0) {
          proxy["h2-opts"].headers = h2Opts.headers;
        }
      } else if (node.network === "http") {
        const h2Opts = node.h2_opts || {};
        const headers = { ...(h2Opts.headers || {}) };
        if (h2Opts.host && h2Opts.host.length > 0 && !headers.Host) {
          headers.Host = h2Opts.host;
        }
        proxy["http-opts"] = {
          method: h2Opts.method || "GET",
          headers,
          path: [h2Opts.path || "/"],
        };
      } else if (node.network === "xhttp" || node.network === "splithttp") {
        const xhttpOpts = node.xhttp_opts || {};
        proxy["xhttp-opts"] = {
          path: xhttpOpts.path || "/",
          mode: xhttpOpts.mode || "auto",
          host: xhttpOpts.host || [],
          extra: xhttpOpts.extra || {},
        };
        if (xhttpOpts.sc_max_each_post_bytes) {
          proxy["xhttp-opts"]["sc-max-each-post-bytes"] = xhttpOpts.sc_max_each_post_bytes;
        }
        if (xhttpOpts.no_sse_header) {
          proxy["xhttp-opts"]["no-sse-header"] = true;
        }
        if (xhttpOpts.xmux && Object.keys(xhttpOpts.xmux).length > 0) {
          proxy["xhttp-opts"].xmux = xhttpOpts.xmux;
        }
      } else if (node.network === "httpupgrade") {
        const httpUpgradeOpts = node.httpupgrade_opts || {};
        proxy["http-upgrade-opts"] = {
          path: httpUpgradeOpts.path || "/",
          host: httpUpgradeOpts.host || "",
          headers: httpUpgradeOpts.headers || {},
        };
      } else if (node.network === "quic") {
        const quicOpts = node.quic_opts || {};
        proxy["quic-opts"] = {
          security: quicOpts.security || "",
          key: quicOpts.key || "",
        };
        if (quicOpts.header_type) {
          proxy["quic-opts"]["header-type"] = quicOpts.header_type;
        }
      } else if (node.network === "kcp" || node.network === "mkcp") {
        const kcpOpts = node.kcp_opts || {};
        proxy["kcp-opts"] = {
          mtu: kcpOpts.mtu || 0,
          tti: kcpOpts.tti || 0,
          "uplink-capacity": kcpOpts.uplink_capacity || 0,
          "downlink-capacity": kcpOpts.downlink_capacity || 0,
          congestion: kcpOpts.congestion === true,
          "read-buffer-size": kcpOpts.read_buffer_size || 0,
          "write-buffer-size": kcpOpts.write_buffer_size || 0,
          seed: kcpOpts.seed || "",
        };
        if (kcpOpts.header_type) {
          proxy["kcp-opts"]["header-type"] = kcpOpts.header_type;
        }
      } else if (node.tcp_opts?.header_type) {
        proxy["header-type"] = node.tcp_opts.header_type;
      }

      if (node.tls) {
        proxy.servername = node.sni || node.server;
        if (node.skip_cert_verify) {
          proxy["skip-cert-verify"] = true;
        }
      }
      if (node.security === "reality") {
        const realityOpts = {};
        if (node.reality_opts?.public_key) {
          realityOpts["public-key"] = node.reality_opts.public_key;
        }
        if (node.reality_opts?.short_id) {
          realityOpts["short-id"] = node.reality_opts.short_id;
        }
        if (node.reality_opts?.spider_x) {
          realityOpts["spider-x"] = node.reality_opts.spider_x;
        }
        if (node.reality_opts?.mldsa65_verify) {
          realityOpts["mldsa65-verify"] = node.reality_opts.mldsa65_verify;
        }
        if (Object.keys(realityOpts).length > 0) {
          proxy["reality-opts"] = realityOpts;
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
