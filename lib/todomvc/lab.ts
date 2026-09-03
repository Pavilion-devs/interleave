import { assertMode, type Mode } from '../lab-engine.ts';
import {
  ADD_ITEM,
  REMOVE_COMPLETED_ITEMS,
  TOGGLE_ITEM,
  todoReducer,
  type Todo,
} from './upstream-reducer.ts';

export type TodoSource = 'manual' | 'native' | 'replay';
export type TodoActor = 'agent' | 'human' | 'system' | 'guard';
export type TodoPhase =
  | 'ready'
  | 'working'
  | 'applied'
  | 'blocked'
  | 'cancelled';
export type TodoCommand =
  | { type: 'observe' }
  | { type: 'start_clear' }
  | { type: 'add'; title: string }
  | { type: 'toggle'; title: string }
  | { type: 'release' }
  | { type: 'cancel' };

export interface PendingClear {
  id: number;
  revision: number;
  todos: Todo[];
}
export interface TodoDocument {
  todos: Todo[];
  revision: number;
  phase: TodoPhase;
  pending: PendingClear | null;
}
export interface TodoAssertion {
  passed: boolean;
  completion: 'blocked' | 'applied';
  rule: string;
  expectedTitles: string[];
  actualTitles: string[];
  message: string;
}
export interface TodoTraceEvent {
  id: number;
  elapsedMs: number;
  actor: TodoActor;
  source: TodoSource;
  kind: string;
  title: string;
  detail: string;
  before: TodoDocument;
  after: TodoDocument;
}
export interface TodoLabSnapshot {
  mode: Mode;
  document: TodoDocument;
  events: TodoTraceEvent[];
  recipe: TodoCommand[];
  assertion: TodoAssertion | null;
  runNumber: number;
}

export const TODO_RULE =
  'A todo added after clear-completed starts must remain unless the human deletes it.';
export const SAMPLE_TODO_RECIPE: TodoCommand[] = [
  { type: 'observe' },
  { type: 'start_clear' },
  { type: 'add', title: 'Human follow-up' },
  { type: 'observe' },
  { type: 'release' },
];

const copy = <T>(value: T): T => structuredClone(value);
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}
export function assertTodoTitle(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 100)
    throw new Error('Todo title must contain 1 to 100 characters.');
}
const initialDocument = (): TodoDocument => ({
  todos: [
    { id: 'fixture-complete', title: 'Package recorder', completed: true },
    { id: 'fixture-active', title: 'Review async trace', completed: false },
  ],
  revision: 0,
  phase: 'ready',
  pending: null,
});

/**
 * TodoMVC's reducer is the application state path. The delayed snapshot write is
 * an intentional Interleave integration fault; it is not attributed to TodoMVC.
 */
export class TodoLab {
  private state: TodoLabSnapshot;
  private listeners = new Set<() => void>();
  private startedAt = Date.now();
  private nextOperation = 1;
  constructor(mode: Mode = 'unguarded') {
    assertMode(mode);
    this.state = freeze({
      mode,
      document: initialDocument(),
      events: [],
      recipe: [],
      assertion: null,
      runNumber: 1,
    });
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(next: TodoLabSnapshot) {
    this.state = freeze(next);
    for (const listener of this.listeners) listener();
  }
  reset(mode: Mode = this.state.mode) {
    assertMode(mode);
    this.startedAt = Date.now();
    this.nextOperation = 1;
    this.publish({
      mode,
      document: initialDocument(),
      events: [],
      recipe: [],
      assertion: null,
      runNumber: this.state.runNumber + 1,
    });
    return this.state;
  }
  private record(
    command: TodoCommand,
    source: TodoSource,
    actor: TodoActor,
    kind: string,
    title: string,
    detail: string,
    document: TodoDocument,
    assertion: TodoAssertion | null = this.state.assertion,
  ) {
    const event: TodoTraceEvent = {
      id: this.state.events.length + 1,
      elapsedMs: Date.now() - this.startedAt,
      actor,
      source,
      kind,
      title,
      detail,
      before: copy(this.state.document),
      after: copy(document),
    };
    this.publish({
      ...this.state,
      document,
      events: [...this.state.events, event],
      recipe: [...this.state.recipe, copy(command)],
      assertion,
    });
    return this.state;
  }
  observe(source: TodoSource = 'manual') {
    return this.record(
      { type: 'observe' },
      source,
      'system',
      'observation',
      'Inspect TodoMVC state',
      'The current todo list is read without changing it.',
      copy(this.state.document),
    );
  }
  startClear(source: TodoSource = 'manual') {
    const current = this.state.document;
    if (current.pending)
      throw new Error('A clear-completed operation is already running.');
    const pending: PendingClear = {
      id: this.nextOperation++,
      revision: current.revision,
      todos: copy(current.todos),
    };
    return this.record(
      { type: 'start_clear' },
      source,
      'agent',
      'read',
      'Agent captures the TodoMVC list',
      `${pending.todos.length} todos captured at revision ${pending.revision}. Completion is delayed.`,
      { ...copy(current), pending, phase: 'working' },
      null,
    );
  }
  add(title: string, source: TodoSource = 'manual') {
    assertTodoTitle(title);
    const cleanTitle = title.trim();
    const current = this.state.document;
    const todos = todoReducer(current.todos, {
      type: ADD_ITEM,
      payload: { title: cleanTitle },
    });
    return this.record(
      { type: 'add', title: cleanTitle },
      source,
      'human',
      'edit',
      source === 'manual' ? 'Human adds a todo' : 'Injected human todo',
      `“${cleanTitle}” is added through TodoMVC's upstream reducer. Revision ${current.revision} → ${current.revision + 1}.`,
      {
        ...copy(current),
        todos,
        revision: current.revision + 1,
        phase: current.pending ? 'working' : 'ready',
      },
      null,
    );
  }
  toggle(title: string, source: TodoSource = 'manual') {
    assertTodoTitle(title);
    const current = this.state.document;
    const matches = current.todos.filter((todo) => todo.title === title.trim());
    if (matches.length !== 1)
      throw new Error('Toggle requires one todo with that exact title.');
    const todos = todoReducer(current.todos, {
      type: TOGGLE_ITEM,
      payload: { id: matches[0].id },
    });
    return this.record(
      { type: 'toggle', title: title.trim() },
      source,
      'human',
      'edit',
      'Human toggles a todo',
      `“${title.trim()}” changes completion state through TodoMVC's upstream reducer.`,
      {
        ...copy(current),
        todos,
        revision: current.revision + 1,
        phase: current.pending ? 'working' : 'ready',
      },
      null,
    );
  }
  release(source: TodoSource = 'manual') {
    const current = this.state.document;
    const pending = current.pending;
    if (!pending) throw new Error('No clear-completed operation is running.');
    const concurrent = current.todos.filter(
      (todo) => !pending.todos.some((captured) => captured.id === todo.id),
    );
    const expectedTitles = concurrent.map((todo) => todo.title);
    if (
      this.state.mode === 'guarded' &&
      pending.revision !== current.revision
    ) {
      const document: TodoDocument = {
        ...copy(current),
        pending: null,
        phase: 'blocked',
      };
      const assertion: TodoAssertion = {
        passed: true,
        completion: 'blocked',
        rule: TODO_RULE,
        expectedTitles,
        actualTitles: document.todos.map((todo) => todo.title),
        message:
          'The list changed after capture, so the stale replacement was refused. The human todo is intact.',
      };
      return this.record(
        { type: 'release' },
        source,
        'guard',
        'blocked',
        'Stale TodoMVC write blocked',
        `Captured revision ${pending.revision} does not match live revision ${current.revision}.`,
        document,
        assertion,
      );
    }

    // Seeded integration defect: reducer output from the captured list replaces the live list.
    const todos = todoReducer(pending.todos, { type: REMOVE_COMPLETED_ITEMS });
    const actualTitles = todos.map((todo) => todo.title);
    const missing = expectedTitles.filter(
      (title) => !actualTitles.includes(title),
    );
    const passed = missing.length === 0;
    const document: TodoDocument = {
      todos,
      revision: current.revision + 1,
      pending: null,
      phase: 'applied',
    };
    const assertion: TodoAssertion = {
      passed,
      completion: 'applied',
      rule: TODO_RULE,
      expectedTitles,
      actualTitles,
      message: passed
        ? 'Completed todos were removed and every concurrent human addition survived.'
        : `The stale replacement erased ${missing.map((title) => `“${title}”`).join(', ')}.`,
    };
    return this.record(
      { type: 'release' },
      source,
      'agent',
      passed ? 'commit' : 'violation',
      passed ? 'Completed todos cleared' : 'Concurrent todo erased',
      passed
        ? 'TodoMVC reducer output was applied without violating the preservation rule.'
        : 'Reducer output computed from the captured list replaced newer live state.',
      document,
      assertion,
    );
  }
  cancel(source: TodoSource = 'manual') {
    const current = this.state.document;
    if (!current.pending) throw new Error('No clear operation is running.');
    return this.record(
      { type: 'cancel' },
      source,
      'system',
      'cancelled',
      'Delayed clear cancelled',
      'The captured TodoMVC list was discarded without changing the live todos.',
      { ...copy(current), pending: null, phase: 'cancelled' },
      null,
    );
  }
  execute(command: TodoCommand, source: TodoSource = 'replay') {
    switch (command.type) {
      case 'observe':
        return this.observe(source);
      case 'start_clear':
        return this.startClear(source);
      case 'add':
        return this.add(command.title, source);
      case 'toggle':
        return this.toggle(command.title, source);
      case 'release':
        return this.release(source);
      case 'cancel':
        return this.cancel(source);
    }
  }
}

export function replayTodoRecipe(recipe: readonly TodoCommand[], mode: Mode) {
  const lab = new TodoLab(mode);
  for (const command of recipe) lab.execute(command, 'replay');
  return lab.getSnapshot();
}

/** Delta-debug the command list while rerunning the witnessed rule violation. */
export function reduceTodoFailure(recipe: readonly TodoCommand[]) {
  const fails = (candidate: TodoCommand[]) => {
    try {
      return (
        replayTodoRecipe(candidate, 'unguarded').assertion?.passed === false
      );
    } catch {
      return false;
    }
  };
  let reduced = copy([...recipe]);
  if (!fails(reduced))
    throw new Error(
      'This recording contains no reproducible TodoMVC violation.',
    );
  let attempts = 1;
  for (let index = 0; index < reduced.length;) {
    const candidate = reduced.filter((_, item) => item !== index);
    attempts++;
    if (fails(candidate)) {
      reduced = candidate;
      index = 0;
    } else index++;
  }
  return {
    originalLength: recipe.length,
    reducedLength: reduced.length,
    attempts,
    recipe: reduced,
    original: replayTodoRecipe(reduced, 'unguarded').assertion,
    guarded: replayTodoRecipe(reduced, 'guarded').assertion,
  };
}
