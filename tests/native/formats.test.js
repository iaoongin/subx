const test = require("node:test");
const assert = require("node:assert/strict");

const { detectSubscriptionFormat } = require("../../services/converter");
const NativeConverter = require("../../services/native");
const NodeMerger = require("../../services/native/merger");
const YAMLParser = require("../../services/native/parsers/yaml");
const ShadowsocksParser = require("../../services/native/parsers/shadowsocks");
const VMessParser = require("../../services/native/parsers/vmess");
const VLESSParser = require("../../services/native/parsers/vless");
const TrojanParser = require("../../services/native/parsers/trojan");
const MixedURIGenerator = require("../../services/native/generators/mixed-uri");
const { normalizeOutputFormat } = require("../../services/native/formats");

const clashSubscription = `
proxies:
  - name: ss-node
    type: ss
    server: ss.example.com
    port: 8388
    cipher: aes-256-gcm
    password: ss-password
    plugin: obfs
    plugin-opts:
      mode: http
      host: example.com
  - name: vmess-node
    type: vmess
    server: vmess.example.com
    port: 443
    uuid: 11111111-1111-1111-1111-111111111111
    alterId: 0
    cipher: auto
    tls: true
    network: ws
    ws-opts:
      path: /vmess
      headers:
        Host: cdn.example.com
  - name: vless-node
    type: vless
    server: vless.example.com
    port: 443
    uuid: 22222222-2222-2222-2222-222222222222
    tls: true
    network: grpc
    grpc-opts:
      grpc-service-name: vless-service
  - name: trojan-node
    type: trojan
    server: trojan.example.com
    port: 443
    password: trojan-password
    sni: trojan.example.com
`;

test("Clash YAML to URI keeps every supported proxy protocol", () => {
  const nodes = new YAMLParser().parse(clashSubscription);
  const result = new MixedURIGenerator().generate(nodes);
  const uris = Buffer.from(result, "base64")
    .toString("utf8")
    .split(/\r?\n/)
    .filter(Boolean);

  assert.equal(nodes.length, 4);
  assert.deepEqual(
    uris.map((uri) => uri.slice(0, uri.indexOf("://"))).sort(),
    ["ss", "trojan", "vless", "vmess"],
  );
  assert.match(uris.find((uri) => uri.startsWith("ss://")), /plugin=obfs%3Bmode%3Dhttp%3Bhost%3Dexample.com/);
  assert.match(uris.find((uri) => uri.startsWith("vmess://")), /^vmess:\/\//);
  assert.match(uris.find((uri) => uri.startsWith("vless://")), /serviceName=vless-service/);
  assert.match(uris.find((uri) => uri.startsWith("trojan://")), /trojan-password/);

  const parsedSS = new ShadowsocksParser().parse(uris.find((uri) => uri.startsWith("ss://")));
  assert.equal(parsedSS.plugin, "obfs");
  assert.deepEqual(parsedSS.plugin_opts, { mode: "http", host: "example.com" });
});

test("output format names use URI, Clash, and V2Ray with legacy aliases", () => {
  assert.equal(normalizeOutputFormat("uri"), "uri");
  assert.equal(normalizeOutputFormat("ss"), "uri");
  assert.equal(normalizeOutputFormat("mixed-uri"), "uri");
  assert.equal(normalizeOutputFormat("clash.yaml"), "clash");
  assert.equal(normalizeOutputFormat("v2ray.json"), "v2ray");

  const converter = new NativeConverter();
  assert.equal(converter.getGenerator("uri"), converter.getGenerator("ss"));
  assert.ok(converter.getGenerator("clash"));
  assert.ok(converter.getGenerator("v2ray"));
});

test("subscription format detection defaults to URI and recognizes Clash/V2Ray", () => {
  assert.equal(detectSubscriptionFormat("Mozilla/5.0", {}), "uri");
  assert.equal(detectSubscriptionFormat("Clash Meta", {}), "clash");
  assert.equal(detectSubscriptionFormat("V2RayN", {}), "v2ray");
  assert.equal(detectSubscriptionFormat("Mozilla/5.0", { uri: "1" }), "uri");
  assert.equal(detectSubscriptionFormat("Mozilla/5.0", { v2ray: "1" }), "v2ray");
});

test("URI output appends subscription names without losing raw URI parameters", () => {
  const vmessRaw = `vmess://${Buffer.from(JSON.stringify({
    v: "2",
    ps: "VMess",
    add: "vmess.example.com",
    port: 443,
    id: "33333333-3333-3333-3333-333333333333",
    net: "ws",
    path: "/ws",
    host: "cdn.example.com",
  })).toString("base64")}`;
  const rawUris = [
    `ss://${Buffer.from("aes-256-gcm:ss-password").toString("base64url")}@ss.example.com:8388?plugin=obfs%3Bmode%3Dhttp#SS`,
    vmessRaw,
    "vless://44444444-4444-4444-4444-444444444444@vless.example.com:443?security=reality&pbk=PUBLIC_KEY#VLESS",
    "trojan://trojan-password@trojan.example.com:443?sni=trojan.example.com#Trojan",
  ];
  const nodes = [
    [new ShadowsocksParser(), rawUris[0]],
    [new VMessParser(), rawUris[1]],
    [new VLESSParser(), rawUris[2]],
    [new TrojanParser(), rawUris[3]],
  ].map(([parser, raw]) => {
    const node = parser.parse(raw);
    node.raw = raw;
    return node;
  });

  const merged = new NodeMerger().merge([{ sourceName: "Plan A", nodes }]).nodes;
  const output = Buffer.from(new MixedURIGenerator().generate(merged), "base64")
    .toString("utf8")
    .split(/\r?\n/)
    .filter(Boolean);

  const ss = output.find((uri) => uri.startsWith("ss://"));
  const vmess = output.find((uri) => uri.startsWith("vmess://"));
  const vless = output.find((uri) => uri.startsWith("vless://"));
  const trojan = output.find((uri) => uri.startsWith("trojan://"));

  assert.ok(ss.endsWith("#SS%20(Plan%20A)"));
  assert.match(vless, /security=reality/);
  assert.ok(vless.endsWith("#VLESS%20(Plan%20A)"));
  assert.match(trojan, /sni=trojan.example.com/);
  assert.ok(trojan.endsWith("#Trojan%20(Plan%20A)"));
  assert.equal(JSON.parse(Buffer.from(vmess.slice(8), "base64").toString("utf8")).ps, "VMess (Plan A)");
});
