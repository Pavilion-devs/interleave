# @interleave/recorder

A dependency-free, framework-independent recorder for application tools and semantic human actions. It is opt-in instrumentation: it does not inspect other sites, patch the browser, or read an agent's hidden reasoning.

## Use

Install the current public build directly from Interleave:

```sh
npm install https://interleave-iota.vercel.app/interleave-recorder-0.2.0.tgz
```

You can also build from the repository root with `npm run build:recorder` and pack the local package. The lab's source imports `src/index.ts`. No npm registry publication is implied.

```ts
import { SessionRecorder } from '@interleave/recorder';

const recorder = new SessionRecorder({
  adapter: { id: 'your-document-editor', version: 1 },
  readState: () => ({ text: editor.text, revision: editor.revision }),
  // Optional: select/redact fields before they enter the recording.
  redact: (value, field) => redactForSharing(value, field),
});

const saveTool = {
  name: 'save_document',
  description: 'Save the current document.',
  inputSchema: yourSaveSchema,
  execute: (input, options) =>
    recorder.run('save_document', input, 'native', () =>
      editor.save(input, options?.signal),
    ),
};

document.modelContext.registerTool(saveTool);

// Call from the application's actual human-edit handler.
function editText(text) {
  return recorder.run(
    'edit_text',
    { text },
    'manual',
    () => {
      editor.setText(text);
      return { revision: editor.revision };
    },
    'action',
  );
}

const unsubscribe = recorder.subscribe(() => {
  persistSession(recorder.getSnapshot());
});
```

`editor`, `yourSaveSchema`, `redactForSharing`, and `persistSession` are supplied by the integrating application. Keep `readState` focused on relevant, serializable state. Without a redaction function, selected inputs, outputs, errors, and state are recorded as supplied. The recorder does not automatically identify secrets.

## Contract

- `run(name, input, source, execute, kind?)` preserves synchronous return values, thrown errors, resolved values, and rejected error objects. For an asynchronous result it returns a tracking promise that settles with the same value or error.
- Entries include arguments, result/error, source, start/end timestamps, elapsed time, and state before/after. `AbortError` is recorded as cancellation. Recorder timestamps describe observations, not every browser scheduling boundary.
- `stateChange` records explicit application transitions supplied by the adapter. This preserves human edits inside a pending tool call even when the final state is later overwritten.
- `getSnapshot` exposes a detached, frozen session. `subscribe` observes updates. `newSession` closes pending entries as interrupted. Late completions cannot enter a different session.
- Default history is 500 entries. Truncation is counted; applications must not claim complete replay of a truncated recording. Pending entries are retained, so a very large number of simultaneous calls can exceed that entry count.
- Values must be JSON serializable. Unsupported values receive a serialization-error marker. Recorder callbacks and adapters should be synchronous and reliable; the package does not isolate exceptions thrown by an application's redactor, state reader, or subscriber.

Persistence, semantic action replay, correctness rules, and browser UI belong to the integrating application. See `lib/reservation-adapter.ts` for the reservation integration, `lib/todomvc/adapter.ts` for the independent TodoMVC application model, and `tests/recorder.test.mjs` for a minimal document-state example.
