# Native WebMCP browser acceptance

On 2026-09-03, the public `/plane` route completed the full Interleave proof in the Codex in-app browser using native `document.modelContext` tools. The machine-readable receipt is [`public/webmcp-plane-acceptance.json`](../public/webmcp-plane-acceptance.json).

## Browser sequence

The browser discovered nine idle Plane tools. It invoked `plane_patch_link_slow` with an eight-second worker delay, then the visible **Save metadata** control was clicked while that native call remained pending.

The recorded order was:

1. Native agent dispatch at `+25424 ms` from recording start.
2. Manual human metadata save at `+28413 ms`, 2.989 seconds after dispatch.
3. Native delayed worker write at `+33426 ms`, 5.013 seconds after the human save.

The native race tool fulfilled in 8.007 seconds. The session recorder retained five receipts: two calls or actions, three state changes, and no errors or cancellations.

## Observed violation

The explicit rule was:

> Metadata explicitly saved after a crawl is queued must not be overwritten by that stale crawl.

The expected final title was `Human verified runbook`. The current Plane behavior produced `Plane documentation`, so the rule failed.

## Replay, reduction, and exports

Native WebMCP calls then completed the rest of the proof:

- `plane_compare_modes` replayed the same three-step recipe. Current Plane failed; the proposed compare-and-set blocked the stale worker and preserved `Human verified runbook`.
- `plane_reduce_failure` evaluated four candidates and retained the minimal sequence `start_crawl → edit_metadata → release`.
- `plane_export_regression` returned the public deterministic test with three recipe steps.
- `plane_export_upstream_patch` returned the AGPL patch receipt pinned to `da1a7ab85012d16836459a10dd92ec55eb739c69`, checksum `a48b20978ca27a0e3aec62fde4080d40b93fc5cd8bec6144712e04763daa2aab`, and the 37/37 Plane validation result.

The browser console contained no errors or warnings. The fixture contacted no live Plane system, account, or user data.
