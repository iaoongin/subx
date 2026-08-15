# VLESS 参数模板

这份模板是原生转换器的 VLESS 兼容参考。解析器会将所有解码后的查询参数
保存在 `node.uri_params` 中；对于目标格式已有明确映射的参数，同时保存为
结构化字段。

## URI 模板

```text
vless://{uuid}@{server}:{port}?encryption={encryption}&flow={flow}&security={security}&sni={sni}&alpn={alpn}&allowInsecure={allowInsecure}&fp={fp}&pbk={pbk}&sid={sid}&spx={spx}&packet-encoding={packet-encoding}&type={type}&path={path}&host={host}&serviceName={serviceName}&authority={authority}&mode={mode}&headerType={headerType}#{name}
```

查询值必须按 URI 规则 URL 编码，例如 `/` 编码为 `%2F`，JSON 的 `extra`、`headers`、`xmux` 也应先编码。

## 参数清单

| 分组 | 参数 | 标准节点字段 |
| --- | --- | --- |
| 基础 | `encryption` / `cipher` | `cipher` |
| 基础 | `flow` | `flow` |
| 安全 | `security` | `security`、`tls` |
| 安全 | `sni` / `servername` / `serverName` | `sni` |
| 安全 | `alpn` | `alpn[]` |
| 安全 | `allowInsecure` / `skip-cert-verify` | `skip_cert_verify` |
| Reality | `fp` / `fingerprint` / `client-fingerprint` | `client_fingerprint` |
| Reality | `pbk` / `publicKey` / `public-key` | `reality_opts.public_key` |
| Reality | `sid` / `shortId` / `short-id` | `reality_opts.short_id` |
| Reality | `spx` / `spiderX` / `spider-x` | `reality_opts.spider_x` |
| Reality | `pqv` / `mldsa65Verify` | `reality_opts.mldsa65_verify` |
| TLS | `echConfig`, `echDohServer`, `echForceQuery`, `pinSHA256` | `tls_opts.*` |
| VLESS | `packet-encoding` / `packetEncoding` | `packet_encoding` |
| 传输 | `type` / `network` | `network` |
| 通用传输 | `path`、`host`、`method` | 按传输类型写入 `ws_opts`、`h2_opts` 或 `xhttp_opts` |
| TCP/QUIC/KCP | `headerType` / `header-type` | `tcp_opts`、`quic_opts` 或 `kcp_opts` |
| WS | `ed` / `maxEarlyData` | `ws_opts.max_early_data` |
| WS | `eh` / `earlyDataHeaderName` | `ws_opts.early_data_header_name` |
| gRPC | `serviceName` / `service-name` | `grpc_opts.service_name` |
| gRPC | `authority`、`mode` | `grpc_opts.authority`、`grpc_opts.mode` |
| HTTPUpgrade | `headers` | `httpupgrade_opts.headers` |
| XHTTP/SplitHTTP | `extra`、`scMaxEachPostBytes`、`noSSEHeader`、`xmux` | `xhttp_opts.*` |
| QUIC | `quicSecurity`、`key` | `quic_opts.security`、`quic_opts.key` |
| mKCP | `mtu`、`tti`、`uplinkCapacity`、`downlinkCapacity`、`congestion` | `kcp_opts.*` |
| mKCP | `readBufferSize`、`writeBufferSize`、`seed` | `kcp_opts.*` |

## 目标格式映射

| URI 参数 | 标准节点字段 | Clash Meta | Xray |
| --- | --- | --- | --- |
| `encryption` | `cipher` | `encryption` | `users[].encryption` |
| `flow` | `flow` | `flow` | `users[].flow` |
| `security` | `security`, `tls` | `tls` or `reality-opts` | `streamSettings.security` |
| `sni` | `sni` | `servername` | `tlsSettings.serverName` or `realitySettings.serverName` |
| `alpn` | `alpn` | `alpn` | `tlsSettings.alpn` |
| `allowInsecure` | `skip_cert_verify` | `skip-cert-verify` | `tlsSettings.allowInsecure` |
| `fp` | `client_fingerprint` | `client-fingerprint` | `realitySettings.fingerprint` |
| `pbk` | `reality_opts.public_key` | `reality-opts.public-key` | `realitySettings.publicKey` |
| `sid` | `reality_opts.short_id` | `reality-opts.short-id` | `realitySettings.shortId` |
| `spx` | `reality_opts.spider_x` | `reality-opts.spider-x` | `realitySettings.spiderX` |
| `packet-encoding` | `packet_encoding` | `packet-encoding` | `users[].packetEncoding` |
| `type` | `network` | `network` | `streamSettings.network` |
| `path` | transport options | `ws-opts.path` / `h2-opts.path` | transport settings path |
| `host` | transport options | WS/H2 host options | transport settings host |
| `serviceName` | `grpc_opts.service_name` | `grpc-opts.grpc-service-name` | `grpcSettings.serviceName` |
| `authority` / `mode` | `grpc_opts.*` | `grpc-opts` | `grpcSettings.authority` / `multiMode` |
| `ed` / `eh` | `ws_opts.*` | `ws-opts.max-early-data` / `early-data-header-name` | WS path `ed` / headers |
| `extra` / `xmux` | `xhttp_opts.*` | `xhttp-opts` | `xhttpSettings` |
| `quicSecurity` / `key` | `quic_opts.*` | `quic-opts` | `quicSettings` |
| mKCP 参数 | `kcp_opts.*` | `kcp-opts` | `kcpSettings` |
| `headerType` | `tcp_opts.header_type` | target-dependent | `tcpSettings.header.type` |

`xhttp` 和 `splithttp` 共用 `xhttp_opts`；`httpupgrade` 同时兼容
`http-upgrade-opts` 和 `httpupgrade-opts` 两种 YAML 键名。

未列出的参数会继续保留在 `uri_params` 中，供后续适配器使用。未知字段不会被盲目
写入目标配置，因为 Clash、Xray 及其他客户端的字段名称和嵌套结构并不一致；新增
字段只需要在解析器和对应生成器增加一条映射，不会再影响 URI 解析和去重。
