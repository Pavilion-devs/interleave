# Interleave — WebMCP Lab

A working first slice of a collaboration testing lab. Capture a reservation selection, change it while a write is held at a checkpoint, and release the write. Compare the seeded stale-write defect with a version check that preserves the newer human choice.

## Run

Requires Node 22.13 or later.

```sh
npm install
npm run dev
```

Open the Local URL printed by the server. Click **Run sample** for a clearly labeled scripted demonstration. For a manual experiment, click **Capture selection**, change the ticket count, then **Release pending write**. Switch to **With version guard** and repeat. A blocked write requires a fresh capture before a reservation can complete.

Use **Replay recording** to repeat the latest completed sequence. **Compare modes** executes the same recorded commands in two isolated stores. **Reduce failure** removes dispensable commands and re-runs candidate sequences. **Export regression** downloads a test that imports this project's actual engine; place it in `tests/` and run it with Node.

```sh
node --test tests/*.test.mjs
npx tsc --noEmit
npm run build
```

## Native WebMCP

The top-level document registers ten imperative tools through `document.modelContext.registerTool`, with schema validation and AbortSignal cleanup. No fake polyfill is installed. Unsupported browsers retain manual controls and show **Manual mode**.

- `lab_read_context`: current state, selected event, and trace.
- `lab_reset`: reset this disposable fixture with an explicit mode.
- `reservation_capture`: capture the live selection and stage a write.
- `lab_inject_human_edit`: inject a labeled sample human action.
- `reservation_release`: commit the captured selection or reject stale input.
- `lab_select_event`: select a trace event in the same visible inspector.
- `lab_replay`: re-execute the latest completed recording, or the sample.
- `lab_compare_modes`: compute and display outcomes for both modes.
- `lab_reduce_failure`: reduce and verify the failure sequence.
- `lab_export_regression`: return regression test source without downloading or executing it.

An example agent request: “Reset this lab to unguarded, capture the reservation, inject a human change to one ticket, and release the pending write. Inspect the result, then compare modes and reduce the failure.”

Manual controls, native calls, and scripted replays are labeled separately. For a real human/agent session, ask the agent to capture, change the ticket count yourself, then ask it to release.

## Scope and evidence

The reservation is a local, in-memory test fixture with a deliberately seeded defect. It is not a booking service, backend transaction system, or discovered browser vulnerability. Nothing is charged or sent to a merchant. “PASS” checks preservation of human intent; a guarded rejection does not mean the reservation is complete.

The checkpoint is an explicit capture/release boundary. Replaying a command sequence executes actual fixture logic; it does not rerun a model. Reduction finds a deletion-minimal reproduction for this fixture, not a globally smallest proof. Arbitrary-site adapters, network fault injection, a durable trace backend, and external application integrations are outside this first slice.

Trace downloads record the browser user agent, fixture format/version, provenance, recipe, and before/after application state. This page stores session state only in memory. Refreshing the page clears it.

The rules checked here are application expectations, not universal WebMCP requirements. WebMCP browser behavior is evolving; see the [specification](https://webmachinelearning.github.io/webmcp/) and [OpenAI site tools guide](https://learn.chatgpt.com/docs/webmcp).

## Validation of this slice

On September 3, 2026, all ten tools were discovered and invoked through the Codex browser's native WebMCP capability against the local running page. The observed unguarded sequence committed two tickets after an injected edit to one. Replaying it with the guard blocked the stale write; a fresh capture and release then committed one ticket. A separate sequence combined native capture, the visible minus button, and native release, confirming the UI and native tools share state.

Invalid quantities, modes, extra arguments, unknown events, release without capture, and duplicate capture were rejected. A healthy recording could not be reduced or exported as a failure. Native comparison, trace selection, reduction, and test export returned results matching the visible page.

Ten engine tests pass. The generated `tests/interleave-regression.test.mjs` adds two passing tests and is an example of the export output. These checks cover the current fixture, not arbitrary websites or universal browser compatibility.
