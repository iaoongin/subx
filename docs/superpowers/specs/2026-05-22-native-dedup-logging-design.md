# Native Dedup Logging Design

## Goal

Improve native conversion observability so operators can see:

1. fetch-time node totals grouped by protocol before deduplication
2. which original node record was kept for each dedup group
3. which original node records were removed as duplicates

## Scope

This change applies to the native conversion flow in `services/native/index.js`
and `services/native/merger.js`.

The existing dedup key remains `type:server:port`.

## Design

### Fetch summary

Keep the existing aggregate counts and add protocol counts based on parsed
original nodes before deduplication.

### Dedup reporting

Enhance the merger to return:

- `nodes`: deduplicated node list
- `dedupReport`: duplicate groups, each with `key`, `kept`, and `duplicates`

The converter logs:

- deduplicated totals by protocol
- duplicate totals and duplicate group totals
- one kept record and all removed records for each duplicate group

### Record formatting

Each logged record should include:

- protocol
- name
- server
- port
- raw preview

Raw previews should be truncated to keep logs readable.

## Testing

Add focused `node:test` coverage for the merger to verify:

1. duplicate groups preserve the first record as kept
2. removed duplicates are collected in the report
3. deduplicated totals stay unchanged
