import {
  SessionRecorder,
  type Provenance,
  type Session,
} from '../../packages/recorder/src/index.ts';
import { assertMode, type Mode } from '../lab-engine.ts';
import { AsyncTodoClear } from './async-clear.ts';
import {
  TodoLab,
  assertTodoTitle,
  type TodoAssertion,
  type TodoCommand,
  type TodoDocument,
  type TodoSource,
} from './lab.ts';

export interface TodoRecordedState {
  mode: Mode;
  document: TodoDocument;
  assertion: TodoAssertion | null;
}
export const TODOMVC_ADAPTER = { id: 'interleave.todomvc', version: 1 };

export class TodoAdapter {
  lab: TodoLab;
  operation: AsyncTodoClear;
  recorder: SessionRecorder<TodoRecordedState>;
  private detach: () => void;
  constructor(mode: Mode = 'unguarded') {
    this.lab = new TodoLab(mode);
    this.operation = new AsyncTodoClear(this.lab);
    this.recorder = new SessionRecorder({
      adapter: TODOMVC_ADAPTER,
      readState: this.readState,
    });
    let previous = this.lab.getSnapshot();
    this.detach = this.lab.subscribe(() => {
      const current = this.lab.getSnapshot();
      if (current.events.length > previous.events.length) {
        const event = current.events.at(-1)!;
        this.recorder.stateChange(
          event.title,
          current.recipe.at(-1),
          {
            mode: current.mode,
            document: event.before,
            assertion: previous.assertion,
          },
          {
            mode: current.mode,
            document: event.after,
            assertion: current.assertion,
          },
          event.source,
        );
      }
      previous = current;
    });
  }
  readState = (): TodoRecordedState => {
    const { mode, document, assertion } = this.lab.getSnapshot();
    return { mode, document, assertion };
  };
  invoke<T>(name: string, input: unknown, source: Provenance, action: () => T) {
    return this.recorder.run(
      name,
      input,
      source,
      action,
      source === 'manual' ? 'action' : 'tool',
    );
  }
  clear(delayMs: number, source: TodoSource = 'manual', signal?: AbortSignal) {
    return this.invoke(
      'todos_clear_completed_slow',
      { delayMs },
      source,
      async () => {
        await this.operation.clear(delayMs, source, signal);
        return this.readState();
      },
    );
  }
  add(title: string, source: TodoSource = 'manual') {
    return this.invoke('todos_add', { title }, source, () => {
      this.lab.add(title, source);
      return this.readState();
    });
  }
  toggle(title: string, source: TodoSource = 'manual') {
    return this.invoke('todos_toggle', { title }, source, () => {
      this.lab.toggle(title, source);
      return this.readState();
    });
  }
  hold(source: TodoSource = 'manual') {
    return this.invoke('todos_hold_clear', {}, source, () =>
      this.operation.hold(),
    );
  }
  complete(source: TodoSource = 'manual') {
    return this.invoke('todos_complete_clear', {}, source, () => {
      this.operation.completeNow();
      return this.readState();
    });
  }
  cancel(source: TodoSource = 'manual') {
    return this.invoke('todos_cancel_clear', {}, source, () => {
      this.operation.cancel();
      return this.readState();
    });
  }
  reset(mode: Mode) {
    assertMode(mode);
    if (this.operation.getSnapshot())
      this.operation.cancel('The run was reset.');
    this.recorder.interruptPending(
      'The run was reset before this call returned.',
    );
    this.lab.reset(mode);
    this.recorder.newSession();
  }
  dispose() {
    if (this.operation.getSnapshot())
      this.operation.cancel('The TodoMVC document was closed.');
    this.recorder.interruptPending('The TodoMVC document was closed.');
    this.detach();
  }
}

/** Replay semantic application actions through a real held asynchronous call. */
export async function replayTodoAsync(
  recipe: readonly TodoCommand[],
  adapter: TodoAdapter,
  step?: () => Promise<void>,
) {
  let pending: Promise<TodoRecordedState> | null = null;
  let ownedId: number | null = null;
  try {
    for (const command of recipe) {
      if (step) await step();
      switch (command.type) {
        case 'observe':
          adapter.lab.observe('replay');
          break;
        case 'start_clear':
          if (pending)
            throw new Error('The recording starts two clear operations.');
          pending = adapter.clear(20000, 'replay');
          void pending.catch(() => {});
          if (!adapter.operation.getSnapshot()) {
            await pending;
            throw new Error('The asynchronous checkpoint was not reached.');
          }
          ownedId = adapter.operation.getSnapshot()!.id;
          adapter.operation.hold();
          break;
        case 'add':
          adapter.add(command.title, 'replay');
          break;
        case 'toggle':
          adapter.toggle(command.title, 'replay');
          break;
        case 'release':
          if (!pending)
            throw new Error('The recording completes before starting.');
          adapter.complete('replay');
          await pending;
          pending = null;
          ownedId = null;
          break;
        case 'cancel':
          if (!pending)
            throw new Error('The recording cancels before starting.');
          adapter.cancel('replay');
          await pending.catch(() => {});
          pending = null;
          ownedId = null;
          break;
      }
    }
    if (pending) throw new Error('The recording ends with unfinished work.');
    return adapter.lab.getSnapshot();
  } finally {
    if (ownedId !== null && adapter.operation.getSnapshot()?.id === ownedId)
      adapter.operation.cancel('Replay stopped before completion.');
    if (pending) await pending.catch(() => {});
  }
}

export function todoRecipeFromSession(
  session: Session<TodoRecordedState>,
): TodoCommand[] {
  if (
    session.adapter.id !== TODOMVC_ADAPTER.id ||
    session.adapter.version !== TODOMVC_ADAPTER.version
  )
    throw new Error('This recording needs a different application adapter.');
  if (session.droppedEntries)
    throw new Error(
      'This recording was truncated and cannot be replayed reliably.',
    );
  if (
    session.entries.some(
      (entry) => entry.status === 'pending' || entry.status === 'interrupted',
    )
  )
    throw new Error(
      'Finish every recorded call before replaying this session.',
    );
  const recipe = session.entries
    .filter((entry) => entry.kind === 'state')
    .map((entry) => {
      const command = entry.input as unknown as TodoCommand;
      if (
        !command ||
        ![
          'observe',
          'start_clear',
          'add',
          'toggle',
          'release',
          'cancel',
        ].includes(command.type)
      )
        throw new Error('The recording contains an unsupported action.');
      if (command.type === 'add' || command.type === 'toggle')
        assertTodoTitle(command.title);
      return structuredClone(command);
    });
  if (!recipe.length)
    throw new Error('This recording has no application actions.');
  const initial = session.initialState.document;
  if (
    initial.revision !== 0 ||
    initial.pending ||
    initial.todos.length !== 2 ||
    initial.todos[0].id !== 'fixture-complete' ||
    initial.todos[1].id !== 'fixture-active'
  )
    throw new Error(
      'This recording requires a different TodoMVC starting state.',
    );
  return recipe;
}
