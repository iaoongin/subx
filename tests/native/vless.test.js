const test = require("node:test");
const assert = require("node:assert/strict");
const yaml = require("js-yaml");

const VLESSParser = require("../../services/native/parsers/vless");
const YAMLParser = require("../../services/native/parsers/yaml");
const ClashGenerator = require("../../services/native/generators/clash");
const V2RayGenerator = require("../../services/native/generators/v2ray");
const NodeMerger = require("../../services/native/merger");

const realityUri = [
  "VLESS://11111111-1111-1111-1111-111111111111@example.com:443",
  "?encryption=none&flow=xtls-rprx-vision&security=reality",
  "&sni=www.example.com&alpn=h2,http%2F1.1&allowInsecure=1",
  "&fp=chrome&pbk=PUBLIC_KEY%3D%3D&sid=SHORT_ID&spx=%2F",
  "&packet-encoding=xudp&type=grpc&serviceName=grpc-service",
  "&futureParam=value%3Dwith%3Dequals#demo"
].join("");

test("VLESS parser preserves Reality and unknown URI parameters", () => {
  const node = new VLESSParser().parse(realityUri);

  assert.equal(node.type, "vless");
  assert.equal(node.security, "reality");
  assert.equal(node.tls, true);
  assert.equal(node.cipher, "none");
  assert.deepEqual(node.alpn, ["h2", "http/1.1"]);
  assert.equal(node.skip_cert_verify, true);
  assert.equal(node.client_fingerprint, "chrome");
  assert.equal(node.packet_encoding, "xudp");
  assert.deepEqual(node.reality_opts, {
    public_key: "PUBLIC_KEY==",
    short_id: "SHORT_ID",
    spider_x: "/",
  });
  assert.equal(node.grpc_opts.service_name, "grpc-service");
  assert.equal(node.uri_params.futureParam, "value=with=equals");
});

test("Clash generator emits VLESS Reality fields", () => {
  const node = new VLESSParser().parse(realityUri);
  const output = yaml.load(new ClashGenerator().generate([node]));
  const proxy = output.proxies[0];

  assert.equal(proxy.type, "vless");
  assert.equal(proxy.encryption, "none");
  assert.equal(proxy["client-fingerprint"], "chrome");
  assert.deepEqual(proxy["reality-opts"], {
    "public-key": "PUBLIC_KEY==",
    "short-id": "SHORT_ID",
    "spider-x": "/",
  });
  assert.deepEqual(proxy.alpn, ["h2", "http/1.1"]);
  assert.equal(proxy["packet-encoding"], "xudp");
});

test("V2Ray generator emits VLESS Reality settings", () => {
  const node = new VLESSParser().parse(realityUri);
  const output = JSON.parse(new V2RayGenerator().generate([node]));
  const outbound = output.outbounds[0];

  assert.equal(outbound.settings.vnext[0].users[0].packetEncoding, "xudp");
  assert.equal(outbound.streamSettings.security, "reality");
  assert.deepEqual(outbound.streamSettings.realitySettings, {
    show: false,
    fingerprint: "chrome",
    serverName: "www.example.com",
    publicKey: "PUBLIC_KEY==",
    shortId: "SHORT_ID",
    spiderX: "/",
  });
});

test("VLESS nodes with different transport parameters are not deduplicated", () => {
  const parser = new VLESSParser();
  const first = parser.parse(
    "vless://11111111-1111-1111-1111-111111111111@example.com:443?security=reality&pbk=KEY_A&sid=ID_A#one",
  );
  const second = parser.parse(
    "vless://11111111-1111-1111-1111-111111111111@example.com:443?security=reality&pbk=KEY_B&sid=ID_B#two",
  );

  const result = new NodeMerger().merge([{ nodes: [first, second] }]);
  assert.equal(result.nodes.length, 2);
  assert.equal(result.dedupReport.length, 0);
});

test("V2Ray keeps TLS output for non-VLESS nodes", () => {
  const outbound = new V2RayGenerator().convertToOutbound({
    type: "vmess",
    name: "vmess",
    server: "example.com",
    port: 443,
    uuid: "11111111-1111-1111-1111-111111111111",
    tls: true,
    network: "tcp",
    security: "none",
    sni: "example.com",
    ws_opts: { path: "", headers: {} },
    grpc_opts: { service_name: "" },
    h2_opts: { host: [], path: "" },
    tcp_opts: { header_type: "" },
  });

  assert.equal(outbound.streamSettings.security, "tls");
});

test("VLESS parser maps TLS ECH and newer Reality fields", () => {
  const node = new VLESSParser().parse(
    "vless://11111111-1111-1111-1111-111111111111@example.com:443?security=tls&fp=chrome&echConfig=ECH_CONFIG&echDohServer=https%3A%2F%2Fdoh.example.com&echForceQuery=1&pinSHA256=PIN_A,PIN_B#tls",
  );
  assert.equal(node.tls_opts.ech_config, "ECH_CONFIG");
  assert.equal(node.tls_opts.ech_doh_server, "https://doh.example.com");
  assert.equal(node.tls_opts.ech_force_query, true);
  assert.deepEqual(node.tls_opts.pinned_peer_certificate_chain_sha256, ["PIN_A", "PIN_B"]);

  const reality = new VLESSParser().parse(
    "vless://11111111-1111-1111-1111-111111111111@example.com:443?security=reality&pqv=MLDSA_VERIFY#reality",
  );
  assert.equal(reality.reality_opts.mldsa65_verify, "MLDSA_VERIFY");
});

test("YAML parser reads VLESS Reality fields", () => {
  const node = new YAMLParser().parse(`
proxies:
  - name: reality
    type: vless
    server: example.com
    port: 443
    uuid: 11111111-1111-1111-1111-111111111111
    encryption: none
    flow: xtls-rprx-vision
    tls: true
    servername: www.example.com
    client-fingerprint: chrome
    reality-opts:
      public-key: PUBLIC_KEY
      short-id: SHORT_ID
      spider-x: /
`).at(0);

  assert.equal(node.security, "reality");
  assert.equal(node.cipher, "none");
  assert.equal(node.reality_opts.public_key, "PUBLIC_KEY");
  assert.equal(node.client_fingerprint, "chrome");
});

test("VLESS parser and generators keep all common transport parameters", () => {
  const parser = new VLESSParser();
  const clash = new ClashGenerator();
  const v2ray = new V2RayGenerator();
  const cases = [
    {
      type: "tcp",
      query: "security=tls&sni=example.com&headerType=http",
      node: (node) => assert.equal(node.tcp_opts.header_type, "http"),
      clash: (proxy) => assert.equal(proxy["header-type"], "http"),
      v2ray: (outbound) => assert.equal(outbound.streamSettings.tcpSettings.header.type, "http"),
    },
    {
      type: "ws",
      query: "security=tls&path=%2Fws&host=cdn.example.com&ed=2048&eh=X-Header",
      node: (node) => assert.deepEqual(node.ws_opts, {
        path: "/ws",
        headers: { Host: "cdn.example.com" },
        max_early_data: 2048,
        early_data_header_name: "X-Header",
      }),
      clash: (proxy) => {
        assert.equal(proxy["ws-opts"]["max-early-data"], 2048);
        assert.equal(proxy["ws-opts"]["early-data-header-name"], "X-Header");
      },
      v2ray: (outbound) => assert.match(outbound.streamSettings.wsSettings.path, /ed=2048/),
    },
    {
      type: "h2",
      query: "path=%2Fh2&host=a.example.com,b.example.com&method=POST",
      node: (node) => assert.deepEqual(node.h2_opts, {
        host: ["a.example.com", "b.example.com"],
        path: "/h2",
        method: "POST",
        headers: {},
      }),
      clash: (proxy) => assert.equal(proxy["h2-opts"].method, "POST"),
      v2ray: (outbound) => assert.equal(outbound.streamSettings.httpSettings.method, "POST"),
    },
    {
      type: "http",
      query: "path=%2Fplain&host=plain.example.com&method=GET",
      node: (node) => assert.equal(node.h2_opts.host[0], "plain.example.com"),
      clash: (proxy) => {
        assert.deepEqual(proxy["http-opts"].path, ["/plain"]);
        assert.deepEqual(proxy["http-opts"].headers.Host, ["plain.example.com"]);
      },
      v2ray: (outbound) => assert.equal(outbound.streamSettings.httpSettings.path, "/plain"),
    },
    {
      type: "grpc",
      query: "serviceName=grpc-service&authority=authority.example.com&mode=multi",
      node: (node) => assert.deepEqual(node.grpc_opts, {
        service_name: "grpc-service",
        authority: "authority.example.com",
        mode: "multi",
      }),
      clash: (proxy) => assert.equal(proxy["grpc-opts"]["grpc-mode"], "multi"),
      v2ray: (outbound) => assert.equal(outbound.streamSettings.grpcSettings.multiMode, true),
    },
    {
      type: "quic",
      query: "quicSecurity=chacha20-poly1305&key=secret&headerType=srtp",
      node: (node) => assert.deepEqual(node.quic_opts, {
        security: "chacha20-poly1305",
        key: "secret",
        header_type: "srtp",
      }),
      clash: (proxy) => assert.equal(proxy["quic-opts"]["header-type"], "srtp"),
      v2ray: (outbound) => assert.equal(outbound.streamSettings.quicSettings.header.type, "srtp"),
    },
    {
      type: "kcp",
      query: "mtu=1350&tti=50&uplinkCapacity=10&downlinkCapacity=20&congestion=1&readBufferSize=2&writeBufferSize=3&seed=seed&headerType=http",
      node: (node) => {
        assert.equal(node.kcp_opts.mtu, 1350);
        assert.equal(node.kcp_opts.header_type, "http");
        assert.equal(node.kcp_opts.congestion, true);
      },
      clash: (proxy) => assert.equal(proxy["kcp-opts"]["uplink-capacity"], 10),
      v2ray: (outbound) => assert.equal(outbound.streamSettings.kcpSettings.seed, "seed"),
    },
    {
      type: "httpupgrade",
      query: "path=%2Fupgrade&host=upgrade.example.com&headers=%7B%22X-Test%22%3A%22yes%22%7D",
      node: (node) => assert.deepEqual(node.httpupgrade_opts.headers, { "X-Test": "yes" }),
      clash: (proxy) => assert.equal(proxy["http-upgrade-opts"].host, "upgrade.example.com"),
      v2ray: (outbound) => assert.equal(outbound.streamSettings.httpupgradeSettings.path, "/upgrade"),
    },
    {
      type: "xhttp",
      query: "path=%2Fxhttp&host=x.example.com&mode=auto&extra=%7B%22x Padding Bytes%22%3A100%7D&scMaxEachPostBytes=4096&noSSEHeader=1",
      node: (node) => {
        assert.equal(node.xhttp_opts.sc_max_each_post_bytes, 4096);
        assert.equal(node.xhttp_opts.no_sse_header, true);
        assert.equal(node.xhttp_opts.extra["x Padding Bytes"], 100);
      },
      clash: (proxy) => assert.equal(proxy["xhttp-opts"]["no-sse-header"], true),
      v2ray: (outbound) => assert.equal(outbound.streamSettings.xhttpSettings.scMaxEachPostBytes, 4096),
    },
    {
      type: "splithttp",
      query: "path=%2Fsplit&mode=stream-up&host=split.example.com",
      node: (node) => {
        assert.equal(node.network, "splithttp");
        assert.equal(node.xhttp_opts.path, "/split");
        assert.deepEqual(node.xhttp_opts.host, ["split.example.com"]);
      },
      clash: (proxy) => {
        assert.equal(proxy.network, "xhttp");
        assert.ok(proxy["xhttp-opts"]);
      },
      v2ray: (outbound) => assert.equal(outbound.streamSettings.network, "xhttp"),
    },
  ];

  for (const item of cases) {
    const node = parser.parse(
      `vless://11111111-1111-1111-1111-111111111111@example.com:443?type=${item.type}&${item.query}#${item.type}`,
    );
    assert.ok(node, `failed to parse ${item.type}`);
    item.node(node);
    item.clash(clash.convertToProxy(node));
    item.v2ray(v2ray.convertToOutbound(node));
  }
});

test("YAML parser reads VLESS HTTPUpgrade and XHTTP fields", () => {
  const nodes = new YAMLParser().parse(`
proxies:
  - name: http-upgrade
    type: vless
    server: example.com
    port: 443
    uuid: 11111111-1111-1111-1111-111111111111
    network: httpupgrade
    http-upgrade-opts:
      path: /upgrade
      host: upgrade.example.com
      headers:
        X-Test: yes
  - name: xhttp
    type: vless
    server: example.com
    port: 443
    uuid: 22222222-2222-2222-2222-222222222222
    network: xhttp
    xhttp-opts:
      path: /xhttp
      mode: auto
      sc-max-each-post-bytes: 4096
      no-sse-header: true
`);

  assert.equal(nodes[0].httpupgrade_opts.path, "/upgrade");
  assert.equal(nodes[0].httpupgrade_opts.headers["X-Test"], "yes");
  assert.equal(nodes[1].xhttp_opts.sc_max_each_post_bytes, 4096);
  assert.equal(nodes[1].xhttp_opts.no_sse_header, true);
});
