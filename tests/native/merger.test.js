const test = require("node:test");
const assert = require("node:assert/strict");

const NodeMerger = require("../../services/native/merger");
const NativeConverter = require("../../services/native");
const BaseGenerator = require("../../services/native/generators/base");
const ClashGenerator = require("../../services/native/generators/clash");

test("merge returns kept nodes and duplicate groups", () => {
  const merger = new NodeMerger();
  const result = merger.merge([
    {
      nodes: [
        {
          type: "trojan",
          name: "first-trojan",
          server: "dup.example.com",
          port: 443,
          raw: "trojan://first@dup.example.com:443#first-trojan",
        },
        {
          type: "vless",
          name: "unique-vless",
          server: "unique.example.com",
          port: 8443,
          raw: "vless://unique@unique.example.com:8443#unique-vless",
        },
      ],
    },
    {
      nodes: [
        {
          type: "trojan",
          name: "second-trojan",
          server: "dup.example.com",
          port: 443,
          raw: "trojan://second@dup.example.com:443#second-trojan",
        },
        {
          type: "trojan",
          name: "third-trojan",
          server: "dup.example.com",
          port: 443,
          raw: "trojan://third@dup.example.com:443#third-trojan",
        },
      ],
    },
  ]);

  assert.equal(result.nodes.length, 2);
  assert.equal(result.dedupReport.length, 1);
  assert.equal(result.dedupReport[0].key, "trojan:dup.example.com:443");
  assert.equal(result.dedupReport[0].kept.name, "first-trojan");
  assert.equal(result.dedupReport[0].duplicates.length, 2);
  assert.deepEqual(
    result.dedupReport[0].duplicates.map((node) => node.name),
    ["second-trojan", "third-trojan"],
  );
  assert.deepEqual(merger.getStats(result.nodes), {
    total: 2,
    byType: {
      trojan: 1,
      vless: 1,
    },
  });
  assert.equal(
    result.dedupReport.reduce((sum, group) => sum + group.duplicates.length, 0),
    2,
  );
});

test("merge keeps same endpoint nodes with different credentials and labels their sources", () => {
  const merger = new NodeMerger();
  const result = merger.merge([
    {
      sourceName: "Expired Plan",
      nodes: [{
        type: "trojan",
        name: "Hong Kong 01",
        server: "same.example.com",
        port: 443,
        password: "expired-password",
      }],
    },
    {
      sourceName: "Available Plan",
      nodes: [
        {
          type: "trojan",
          name: "Hong Kong 01",
          server: "same.example.com",
          port: 443,
          password: "available-password",
        },
        {
          type: "trojan",
          name: "Hong Kong 01",
          server: "same.example.com",
          port: 443,
          password: "available-password",
        },
      ],
    },
  ]);

  assert.equal(result.nodes.length, 2);
  assert.deepEqual(
    result.nodes.map((node) => node.name).sort(),
    ["Hong Kong 01 (Available Plan)", "Hong Kong 01 (Expired Plan)"],
  );
  assert.equal(result.dedupReport.length, 1);
  assert.match(result.dedupReport[0].key, /^trojan:same\.example\.com:443:auth=[a-f0-9]{16}$/);
  assert.ok(!result.dedupReport[0].key.includes("available-password"));
});

test("formatNodeRecord keeps raw URI exactly as-is", () => {
  const converter = new NativeConverter();
  const raw = "trojan://password123@pokemon-02.yunjnet.com:54029?allowInsecure=1&peer=www.apple.com.cn&sni=www.apple.com.cn&type=tcp#日本01";

  const formatted = converter.formatNodeRecord({
    type: "trojan",
    name: "日本01",
    server: "pokemon-02.yunjnet.com",
    port: 54029,
    raw,
  });

  assert.match(formatted, /raw=/);
  assert.ok(formatted.endsWith(`raw=${raw}`));
  assert.ok(formatted.includes("password123@"));
});

test("summarizeNodeDifference reports fragment-only differences", () => {
  const converter = new NativeConverter();
  const kept = {
    type: "trojan",
    name: "日本01",
    server: "pokemon-02.yunjnet.com",
    port: 54029,
    raw: "trojan://password123@pokemon-02.yunjnet.com:54029?allowInsecure=1&sni=www.apple.com.cn#%E6%97%A5%E6%9C%AC01",
  };
  const duplicate = {
    type: "trojan",
    name: "日本02",
    server: "pokemon-02.yunjnet.com",
    port: 54029,
    raw: "trojan://password123@pokemon-02.yunjnet.com:54029?allowInsecure=1&sni=www.apple.com.cn#%E6%97%A5%E6%9C%AC02",
  };

  assert.equal(
    converter.summarizeNodeDifference(kept, duplicate),
    '差异: 仅 fragment/name 不同，保留="日本01"，重复="日本02"',
  );
});
test("base generator auditValidNodes reports missing field reasons", () => {
  class TestGenerator extends BaseGenerator {}

  const generator = new TestGenerator();
  const result = generator.auditValidNodes([
    null,
    { type: "vmess", name: "missing-server", port: 443 },
    { type: "vless", name: "missing-port", server: "a.example.com" },
    { type: "trojan", name: "valid", server: "b.example.com", port: 443 },
  ]);

  assert.equal(result.validNodes.length, 1);
  assert.deepEqual(
    result.discarded.map((item) => item.reason),
    ["empty-node", "missing-server", "missing-port"],
  );
});

test("clash generator audit reports unsupported types and generation failures", () => {
  const generator = new ClashGenerator();
  const originalConvert = generator.convertToProxy;

  generator.convertToProxy = function convertForTest(node) {
    if (node.name === "broken-vmess") {
      throw new Error("boom");
    }
    return originalConvert.call(this, node);
  };

  const result = generator.generateWithAudit([
    {
      type: "vmess",
      name: "ok-vmess",
      server: "ok.example.com",
      port: 443,
      uuid: "11111111-1111-1111-1111-111111111111",
      tls: true,
      network: "tcp",
    },
    {
      type: "hysteria",
      name: "unsupported",
      server: "nope.example.com",
      port: 443,
    },
    {
      type: "vmess",
      name: "broken-vmess",
      server: "broken.example.com",
      port: 443,
      uuid: "22222222-2222-2222-2222-222222222222",
      tls: true,
      network: "tcp",
    },
  ]);

  assert.equal(result.validNodes.length, 3);
  assert.equal(result.generatedNodes.length, 1);
  assert.equal(result.discarded.length, 2);
  assert.deepEqual(
    result.discarded.map((item) => item.reason).sort(),
    ["convert-error", "unsupported-type"],
  );
});

test("native converter groups discarded nodes by reason and type", () => {
  const converter = new NativeConverter();
  const stats = converter.groupDiscardedNodes([
    { reason: "deduplicated", type: "vmess" },
    { reason: "deduplicated", type: "vmess" },
    { reason: "missing-port", type: "vless" },
  ]);

  assert.deepEqual(stats, {
    deduplicated: { total: 2, byType: { vmess: 2 } },
    "missing-port": { total: 1, byType: { vless: 1 } },
  });
});
