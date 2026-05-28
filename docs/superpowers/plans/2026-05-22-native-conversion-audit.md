# Native Conversion Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add native conversion audit logging that shows per-stage totals, per-type totals, and discard reasons for Clash generation.

**Architecture:** Extend the native generator interfaces with audit helpers while preserving the existing `generate()` contract. The native converter will aggregate audit data from fetch, dedup, validation, and generation stages, then log compact summaries without changing subscription responses.

**Tech Stack:** Node.js, CommonJS, `node:test`, `node:assert/strict`

---

### Task 1: Add failing tests for generator audit helpers

**Files:**
- Modify: `tests/native/merger.test.js`
- Modify: `services/native/generators/base.js`
- Modify: `services/native/generators/clash.js`

- [ ] **Step 1: Write the failing tests**

```js
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
    { type: "vmess", name: "ok-vmess", server: "ok.example.com", port: 443, uuid: "11111111-1111-1111-1111-111111111111", tls: true, network: "tcp" },
    { type: "hysteria", name: "unsupported", server: "nope.example.com", port: 443 },
    { type: "vmess", name: "broken-vmess", server: "broken.example.com", port: 443, uuid: "22222222-2222-2222-2222-222222222222", tls: true, network: "tcp" },
  ]);

  assert.equal(result.validNodes.length, 3);
  assert.equal(result.generatedNodes.length, 1);
  assert.equal(result.discarded.length, 2);
  assert.deepEqual(
    result.discarded.map((item) => item.reason).sort(),
    ["convert-error", "unsupported-type"],
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/native/merger.test.js`
Expected: FAIL because `auditValidNodes()` and `generateWithAudit()` do not exist yet

- [ ] **Step 3: Write minimal implementation**

In `services/native/generators/base.js` add:

```js
auditValidNodes(nodes) {
  const validNodes = [];
  const discarded = [];

  for (const node of nodes || []) {
    if (!node) {
      discarded.push({ reason: "empty-node", type: "unknown" });
      continue;
    }
    if (!node.server) {
      discarded.push(this.describeDiscardedNode(node, "missing-server"));
      continue;
    }
    if (!node.port) {
      discarded.push(this.describeDiscardedNode(node, "missing-port"));
      continue;
    }
    validNodes.push(node);
  }

  return { validNodes, discarded };
}
```

In `services/native/generators/clash.js` add:

```js
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
      discarded.push(this.describeDiscardedNode(node, "convert-error"));
    }
  }

  return { content: this.buildConfig(proxies), validNodes, generatedNodes, discarded };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/native/merger.test.js`
Expected: PASS for the new audit helper tests

### Task 2: Wire native converter audit summaries

**Files:**
- Modify: `services/native/index.js`
- Modify: `services/native/generators/clash.js`

- [ ] **Step 1: Write the failing test surface**

Extend `tests/native/merger.test.js` with a converter-facing assertion:

```js
test("native converter aggregates discard stats by reason and type", () => {
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
```

- [ ] **Step 2: Run tests to verify it fails**

Run: `node --test tests/native/merger.test.js`
Expected: FAIL because `groupDiscardedNodes()` does not exist yet

- [ ] **Step 3: Write minimal implementation**

In `services/native/index.js`:

- add `groupDiscardedNodes(discardedNodes)`
- add `logAuditStage(stage, stats, extra = "")`
- add `logDiscardSummary(discardedNodes)`
- collect `deduplicated` discards from `dedupReport`
- call `generator.generateWithAudit(allNodes)` when available
- log `fetched`, `merged`, `valid`, and `generated` stage summaries

Implementation shape:

```js
const generatorAudit = typeof generator.generateWithAudit === "function"
  ? generator.generateWithAudit(allNodes)
  : null;

const validNodes = generatorAudit ? generatorAudit.validNodes : generator.filterValidNodes(allNodes);
const result = generatorAudit ? generatorAudit.content : generator.generate(allNodes);
const generatedNodes = generatorAudit ? generatorAudit.generatedNodes : validNodes;
const discardedNodes = [
  ...this.flattenDedupDiscarded(dedupReport),
  ...(generatorAudit ? generatorAudit.discarded : []),
];
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/native/merger.test.js`
Expected: PASS with converter discard grouping assertions green

### Task 3: Verify final behavior and changed scope

**Files:**
- Modify: `services/native/index.js`
- Modify: `services/native/generators/base.js`
- Modify: `services/native/generators/clash.js`
- Modify: `tests/native/merger.test.js`

- [ ] **Step 1: Run focused verification**

Run: `node --test tests/native/merger.test.js`
Expected: PASS with all four tests green

- [ ] **Step 2: Review diff**

Run: `git diff -- services/native/index.js services/native/generators/base.js services/native/generators/clash.js tests/native/merger.test.js docs/superpowers/specs/2026-05-22-native-conversion-audit-design.md docs/superpowers/plans/2026-05-22-native-conversion-audit.md`
Expected: diff only contains the approved native audit logging work
