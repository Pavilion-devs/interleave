# Plane issue-link metadata race — local review artifact

## Scope and provenance

This integration reproduces the behavior documented in [makeplane/plane#9674](https://github.com/makeplane/plane/issues/9674). The source review and proposed patch are pinned to Plane commit [`da1a7ab85012d16836459a10dd92ec55eb739c69`](https://github.com/makeplane/plane/commit/da1a7ab85012d16836459a10dd92ec55eb739c69) from the public `preview` branch.

All execution is local and deterministic. Interleave does not contact a Plane deployment, account, database, queue, credential, or user dataset. The Plane source was reviewed from its public repository and an existing shallow clone.

## Source behavior at the pinned commit

Two partial-update endpoints save an issue-link update and then queue `crawl_work_item_link_title`:

- `apps/api/plane/app/views/issue/link.py`, `IssueLinkViewSet.partial_update`
- `apps/api/plane/api/views/issue.py`, `IssueLinkDetailAPIEndpoint.patch`

Neither endpoint checks whether the URL changed or whether the request supplied metadata before dispatching the crawl.

The worker in `apps/api/plane/bgtasks/work_item_link_task.py` crawls the URL, fetches the issue-link by ID, assigns the result to `issue_link.metadata`, and saves it. It does not verify that the URL or row revision still matches the state that caused the task to be queued.

## Deterministic reproduction

The `/plane` route runs this sequence against an executable model of those source paths:

1. An agent changes only an issue-link display title. The API accepts the update and queues a metadata crawl at revision 1.
2. The worker remains pending.
3. A person explicitly saves metadata title `Human verified runbook`. The live row advances to revision 2.
4. The queued worker completes with crawled title `Plane documentation`.
5. Current behavior applies that stale result and replaces the explicit human value.

Preservation rule:

> Metadata explicitly saved after a crawl is queued must not be overwritten by that stale crawl.

Expected final metadata title: `Human verified runbook`

Actual title with the pinned behavior: `Plane documentation`

The five-command observed session reduces to the three operations required to reproduce the failure:

```text
start_crawl("Production runbook")
edit_metadata("Human verified runbook")
release()
```

## Proposed Plane patch

The local patch is [`public/plane-9674.patch`](../public/plane-9674.patch). It changes four upstream files:

- Both update endpoints queue a crawl only when the URL is explicitly changed and metadata is not explicitly supplied.
- Create endpoints pass the saved row's `updated_at` value to the worker.
- The worker accepts old two-argument queued messages during a rolling deployment but safely skips them because they have no dispatch revision to compare.
- New tasks filter by ID, URL, and the expected `updated_at` revision before writing.
- The final write is one atomic queryset update. A zero-row update means the task is stale and is logged instead of overwriting newer state.
- Three unit tests verify a matching revision is updated, a changed revision is skipped, and an old task without a revision cannot write.

Checking both dispatch and completion matters. Avoiding unnecessary crawls removes the common trigger, while the atomic completion guard protects against races that happen after a legitimate URL change.

## Review and validation

Interleave exercises both modes:

- **Current Plane behavior** must fail the preservation assertion.
- **Proposed patch** must preserve the human title and pass.
- A crawl whose revision still matches must continue to apply normally.

The exported Node regression defaults to proposed behavior and can be run against the reproduced current behavior:

```sh
node --test tests/generated-plane-regression.test.mjs
INTERLEAVE_IMPLEMENTATION=unguarded node --test tests/generated-plane-regression.test.mjs
```

The second invocation is expected to fail. The generated file is a browser download; the repository test creates and removes an equivalent file automatically.

The upstream Python files pass syntax compilation and `git diff --check`. Interleave's full test, lint, type-check, and production-build results are recorded in the final review report after they run. Full Plane test execution depends on Plane's Docker development environment and is reported separately rather than implied.

## Publication status

The patch exists only in the local shallow clone and this Interleave repository. No Plane issue, pull request, comment, branch, message, or deployment has been created or modified. Upstream publication requires the user's review and approval of the finished patch.
