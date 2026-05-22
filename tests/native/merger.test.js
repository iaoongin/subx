const test = require("node:test");
const assert = require("node:assert/strict");

const NodeMerger = require("../../services/native/merger");
const NativeConverter = require("../../services/native");

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
