# Native Dedup Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add fetch-time protocol totals and detailed dedup logging for native conversion.

**Architecture:** Keep the current native conversion flow intact, but return structured dedup metadata from the merger so the converter can log both the kept source node and every removed duplicate. Use focused `node:test` coverage to lock the behavior before implementation.

**Tech Stack:** Node.js, CommonJS, `node:test`, `node:assert/strict`

---

### Task 1: Add merger regression test

**Files:**
- Create: `tests/native/merger.test.js`
- Modify: `services/native/merger.js`

- [ ] **Step 1: Write the failing test**

```js
test("merge returns kept nodes and duplicate groups", () => {
  const merger = new NodeMerger();
  const result = merger.merge([
    { nodes: [firstTrojan, uniqueVless] },
    { nodes: [duplicateTrojan, secondDuplicateTrojan] },
  ]);

  assert.equal(result.nodes.length, 2);
  assert.equal(result.dedupReport.length, 1);
  assert.equal(result.dedupReport[0].kept.name, "first");
  assert.equal(result.dedupReport[0].duplicates.length, 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/native/merger.test.js`
Expected: FAIL because `merge()` currently returns an array, not an object with `dedupReport`

- [ ] **Step 3: Write minimal implementation**

Update `services/native/merger.js` so `merge()` returns `{ nodes, dedupReport }`
while preserving the existing deduplicated result and sort behavior.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/native/merger.test.js`
Expected: PASS

### Task 2: Wire fetch-type summary and dedup logging

**Files:**
- Modify: `services/native/index.js`
- Modify: `services/native/merger.js`

- [ ] **Step 1: Write the failing test or assertion surface**

Add assertions in `tests/native/merger.test.js` for duplicate counts by type so
the reporting data is available to `index.js`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/native/merger.test.js`
Expected: FAIL until duplicate summaries are exposed

- [ ] **Step 3: Write minimal implementation**

In `services/native/index.js`:

- compute fetch-time protocol totals from original parsed nodes
- consume `{ nodes, dedupReport }`
- log duplicate totals, group totals, kept records, and removed records

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/native/merger.test.js`
Expected: PASS

### Task 3: Verify final behavior

**Files:**
- Modify: `services/native/index.js`
- Modify: `services/native/merger.js`
- Create: `tests/native/merger.test.js`

- [ ] **Step 1: Run focused verification**

Run: `node --test tests/native/merger.test.js`
Expected: PASS with all assertions green

- [ ] **Step 2: Sanity-check changed files**

Run: `git diff -- services/native/index.js services/native/merger.js tests/native/merger.test.js`
Expected: diff matches the approved scope only
