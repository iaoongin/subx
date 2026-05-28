# Native Conversion Audit Logging Design

## Goal

Improve observability for native subscription conversion so operators can see
where nodes are lost during format generation, especially for `clash`.

The logging should answer:

1. how many nodes were parsed successfully
2. how many nodes remained after deduplication
3. how many nodes were discarded before generation
4. how many nodes were emitted in the target format
5. why discarded nodes were removed

## Scope

This change applies only to the native conversion flow used by
`services/native/index.js`.

In scope:

- fetch and parse summary logging
- dedup summary logging
- generator validation summary logging
- Clash generator discard reason logging

Out of scope:

- remote conversion logging
- response payload changes
- deduplication rule changes
- adding support for more proxy protocols

## Current Problem

`routes/conversion.js` currently logs conversion start and end, but does not
show where nodes are lost during native generation.

For `clash`, node loss can happen at multiple stages:

1. source fetch succeeds but individual node parsing fails
2. duplicate nodes are removed during merge
3. nodes are missing required fields such as `server` or `port`
4. a node protocol is not supported by the Clash generator
5. proxy conversion throws because node fields are malformed

Without structured audit logs, operators can only see that the final node count
is lower than expected.

## Design

### Stage model

Native conversion should log a consistent audit summary across four stages:

1. `fetched`: all successfully parsed nodes before deduplication
2. `merged`: nodes after deduplication
3. `valid`: nodes remaining after generator-level structural validation
4. `generated`: nodes successfully converted into the target output format

Each stage should log:

- total node count
- counts grouped by node type

### Discard model

Discarded nodes should be grouped by reason. Each reason group should log:

- discard total
- counts grouped by node type

Reasons for this change:

- `parse-failed`: already logged during fetch, remains part of fetch summary
- `deduplicated`: removed by `NodeMerger`
- `missing-server`: filtered by generator validation
- `missing-port`: filtered by generator validation
- `empty-node`: filtered by generator validation
- `unsupported-type`: node type not supported by the target generator
- `convert-error`: target generator threw while building a proxy entry

### Base generator validation

`services/native/generators/base.js` should expose structured validation
results instead of only returning a filtered array.

Recommended API:

- `filterValidNodes(nodes)` keeps current behavior for compatibility
- `auditValidNodes(nodes)` returns `{ validNodes, discarded }`

Each discarded record should include:

- `reason`
- `type`
- `name`
- `server`
- `port`

### Clash generator audit

`services/native/generators/clash.js` should expose structured generation
results so `services/native/index.js` can audit format-specific loss.

Recommended API:

- `generate(nodes)` keeps returning the YAML string
- `generateWithAudit(nodes)` returns:
  - `content`
  - `validNodes`
  - `generatedNodes`
  - `discarded`

Clash-specific discard rules:

- unsupported protocols return `unsupported-type`
- conversion exceptions return `convert-error`

### Native converter logging

`services/native/index.js` should aggregate and print:

1. fetch summary
2. dedup summary
3. validation summary
4. generated summary
5. discard summary by reason

Suggested log shape:

```text
[native-audit] stage=fetched total=120 byType=vmess:60,vless:30,trojan:20,ss:10
[native-audit] stage=merged total=95 byType=vmess:50,vless:25,trojan:15,ss:5
[native-audit] stage=valid total=92 byType=vmess:49,vless:24,trojan:14,ss:5
[native-audit] stage=generated format=clash total=88 byType=vmess:47,vless:22,trojan:14,ss:5
[native-audit] discard reason=deduplicated total=25 byType=vmess:10,vless:5,trojan:8,ss:2
[native-audit] discard reason=missing-port total=2 byType=vmess:1,vless:1
[native-audit] discard reason=unsupported-type total=3 byType=hysteria2:3
[native-audit] discard reason=convert-error total=2 byType=vmess:2
```

This format keeps logs compact while making the loss point obvious.

## Testing

Add focused `node:test` coverage for the new audit helpers and Clash generator
behavior.

Tests should verify:

1. validation reports missing field reasons correctly
2. Clash audit reports unsupported protocols separately
3. Clash audit reports conversion failures separately
4. generated node counts match the returned content inputs

## Risks

- Generator APIs are shared internally, so compatibility wrappers should remain
  in place for existing callers.
- Logging must stay compact enough for production use; avoid dumping every node
  unless debugging is explicitly extended later.

## Success Criteria

When a native `clash` conversion returns fewer nodes than expected, logs should
show:

- original parsed totals by type
- post-dedup totals by type
- post-validation totals by type
- final generated totals by type
- discard totals grouped by reason and type

Operators should be able to identify the primary loss reason without manually
instrumenting the code again.
