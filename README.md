# Interleave — WebMCP Lab v0.3

A collaboration testing lab with real asynchronous operations, opt-in tool recording, saved sessions, and deliberately seeded stale-write defects. It includes the original reservation fixture and an independently maintained TodoMVC application integration.

## Run

Requires Node 22.13 or later.

```sh
npm install
npm run dev
```

Open the Local URL printed by the server. Click **Start reservation**, change the ticket count during its delay, and let the operation finish. The original implementation commits its captured quantity and can overwrite the newer human choice. **With version guard** refuses the stale write; **Retry current selection** then completes the reservation correctly.

**Hold completion** keeps the same asynchronous call pending. **Complete now** finishes it early. **Cancel operation** rejects it without committing. The optional step-by-step capture controls preserve the earlier staged demonstration. **Run sample** is explicitly scripted.

The delay models application work in this browser; it is not a merchant or network request. No payment or real ticket booking occurs.

## TodoMVC external application integration

Open `/todomvc` to run the recorder against the React reducer from the independently maintained [TodoMVC repository](https://github.com/tastejs/todomvc/tree/ff43b02e59dfa604386bb382034b2cd07c2bcd8a/examples/react). Todo additions, toggles, and clear-completed behavior pass through the adapted upstream reducer pinned at commit `ff43b02e59dfa604386bb382034b2cd07c2bcd8a`. Its source and MIT license are documented in `THIRD_PARTY_NOTICES.md`.

The demonstrated race is explicitly seeded by Interleave's orchestration layer; it is not presented as a TodoMVC bug. A delayed agent clear captures the current list, a human adds a todo while that call is pending, and the seeded completion replaces live state with reducer output computed from the old list. The revision guard refuses that stale replacement. A fresh retry reads the current list and safely finishes the clear.

The TodoMVC route has its own versioned recording adapter, browser-local archive, JSON validation/import/export, asynchronous replay, delta reduction, runnable regression export, and 15 native WebMCP tools. This proves the recorder package is not coupled to the reservation data model.

## Recorder and saved sessions

The session recorder captures application tool arguments, results, errors, cancellation, timestamps, source, and before/after state. Semantic state changes are recorded during pending calls, so the human edit is visible even if a later write overwrites it. Lab navigation and session-management tools are excluded from application recordings.

Up to 10 recent sessions are saved in this browser and origin, within the storage limit. Reopen them in the **Session recorder**, inspect receipts, download JSON, or import an exported recording. Storage failures are visible and JSON download remains available. A document closed before a call's result was recorded marks that call interrupted; it is not treated as completed.

**Replay session** validates the recording and executes supported reservation actions at actual asynchronous checkpoints. It preserves relevant command ordering, not wall-clock timing or model decisions. It does not execute arbitrary uploaded code. Truncated, unfinished, unknown-adapter, or unsupported-action recordings cannot be advertised as reliable replays.

**Compare modes**, **Reduce failure**, and **Export regression** use the latest witnessed failure, or the included sample. A later successful recovery does not hide its reproduction. Reduction remains specific to this reservation rule. The six-step sample reduces to capture, human edit, completion.

## Regression export

**Export regression** emits a single asynchronous adapter test that checks preservation of the latest selection and completed recovery. Its default guarded implementation passes. The same test must fail against the original implementation:

```sh
node --test tests/interleave-async-regression.test.mjs
INTERLEAVE_IMPLEMENTATION=unguarded node --test tests/interleave-async-regression.test.mjs
```

The second command is an intentionally failing verification. The older fixture comparison test is retained separately. These exports import this project's adapter; they are not yet portable tests for arbitrary applications or full native-browser/model replays.

## Native WebMCP

The top-level document registers 17 tools through `document.modelContext.registerTool`. Unsupported browsers retain manual controls. Registration uses AbortSignal cleanup; no fake polyfill is installed.

- `reservation_reserve({delayMs})` stays pending until completion or cancellation. Native delay: 500–20000 ms. The manual interface can demonstrate a 30-second wait. The human can edit the visible selection during the call.
- `lab_hold_response({})`, `reservation_release({})`, and `reservation_cancel({})` control the pending operation.
- `reservation_capture({})` retains the separate capture/release fixture controls.
- `lab_inject_human_edit({quantity})` injects a clearly labeled human action for automated experiments.
- `lab_read_context({})`, `lab_reset({mode})`, and `lab_select_event({eventId})` inspect or control the active fixture.
- `lab_replay({mode,sessionId?})` replays a saved session or the latest completed sequence through asynchronous checkpoints.
- `lab_compare_modes({})`, `lab_reduce_failure({})`, and `lab_export_regression({})` analyze the completed recipe.
- `lab_list_sessions({})`, `lab_open_session({sessionId})`, `lab_export_session({sessionId?})`, and `lab_import_session({json})` operate on the local session archive.

A real agent prompt: “Reserve my current ticket selection with a 15-second delay. I will change the quantity while your call is running. Tell me whether my latest selection was preserved when the operation finishes.”

On `/todomvc`: “Start clearing completed todos with a 15-second delay. I will add a todo while your call is running. When it finishes, tell me whether my new todo survived, reduce any failure, and export the regression test.”

The browser must support concurrent human interaction while the tool awaits completion. Cancellation from the caller is honored when the browser supplies an execution AbortSignal; explicit lab cancellation also works.

## Reusable package

`packages/recorder` is the dependency-free `@interleave/recorder` package. It accepts an application state reader, optional redaction, semantic transitions, and tool functions. It has no reservation or React dependency. See its README for integration and limitations.

```sh
npm run build:recorder
npm pack ./packages/recorder --pack-destination /tmp
```

This is a local distribution; the package has not been published to npm. The running lab provides a direct download of the built package. The repository and recorder are licensed under MIT. A separate document-state test verifies the generic recorder API, and the TodoMVC route exercises the package in a second application model.

## Checks

```sh
node --test tests/*.test.mjs
npm run lint
npm run build
```

Tests cover autonomous delayed completion, guarded recovery, cancellation, invalid inputs, duplicate calls, reset/replay races, JSON validation, asynchronous replay, generic recording, error preservation, redaction, immutable snapshots, bounded history, upstream TodoMVC reducer behavior, TodoMVC interruption/recovery, reduction, and a regression that passes guarded and fails seeded. Seeded defects are not claimed as newly discovered bugs.

The rules are application expectations, not universal WebMCP requirements. See the [current specification](https://webmachinelearning.github.io/webmcp/).
