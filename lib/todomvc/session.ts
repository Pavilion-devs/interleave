import type { Entry, Session } from '../../packages/recorder/src/index.ts';
import { assertMode } from '../lab-engine.ts';
import { TODOMVC_ADAPTER, type TodoRecordedState } from './adapter.ts';

const KEY = 'interleave.todomvc.sessions.v1';
const LIMIT = 1500000;
const EMPTY: { sessions: Session<TodoRecordedState>[]; warning: string } = {
  sessions: [],
  warning: '',
};
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid session object.');
  return value as Record<string, unknown>;
}
function validateState(value: unknown) {
  const state = object(value);
  assertMode(state.mode);
  const document = object(state.document);
  if (
    !Number.isSafeInteger(document.revision) ||
    Number(document.revision) < 0 ||
    !['ready', 'working', 'applied', 'blocked', 'cancelled'].includes(
      String(document.phase),
    ) ||
    !Array.isArray(document.todos) ||
    document.todos.length > 100
  )
    throw new Error('Invalid TodoMVC state.');
  const ids = new Set<string>();
  for (const value of document.todos) {
    const todo = object(value);
    if (
      typeof todo.id !== 'string' ||
      !todo.id ||
      todo.id.length > 100 ||
      ids.has(todo.id) ||
      typeof todo.title !== 'string' ||
      todo.title.length > 100 ||
      typeof todo.completed !== 'boolean'
    )
      throw new Error('Invalid recorded todo.');
    ids.add(todo.id);
  }
  if (document.pending !== null) {
    const pending = object(document.pending);
    if (
      !Number.isSafeInteger(pending.id) ||
      !Number.isSafeInteger(pending.revision) ||
      !Array.isArray(pending.todos) ||
      pending.todos.length > 100
    )
      throw new Error('Invalid captured TodoMVC state.');
  }
  if (state.assertion !== null) {
    const assertion = object(state.assertion);
    if (
      typeof assertion.passed !== 'boolean' ||
      !['blocked', 'applied'].includes(String(assertion.completion)) ||
      typeof assertion.rule !== 'string' ||
      typeof assertion.message !== 'string' ||
      !Array.isArray(assertion.expectedTitles) ||
      !Array.isArray(assertion.actualTitles)
    )
      throw new Error('Invalid TodoMVC assertion.');
  }
}
export function parseTodoSession(text: string): Session<TodoRecordedState> {
  if (text.length > LIMIT)
    throw new Error('Session files must be smaller than 1.5 MB.');
  const raw: unknown = JSON.parse(text);
  const session = object(raw);
  const adapter = object(session.adapter);
  if (
    session.format !== 'interleave.session.v1' ||
    adapter.id !== TODOMVC_ADAPTER.id ||
    adapter.version !== TODOMVC_ADAPTER.version
  )
    throw new Error(
      'Only Interleave TodoMVC v1 recordings are supported here.',
    );
  if (
    typeof session.id !== 'string' ||
    !session.id ||
    session.id.length > 100 ||
    !Number.isFinite(session.startedAt) ||
    !Number.isFinite(session.updatedAt) ||
    !Number.isSafeInteger(session.droppedEntries) ||
    Number(session.droppedEntries) < 0
  )
    throw new Error('Invalid session metadata.');
  validateState(session.initialState);
  validateState(session.latestState);
  if (!Array.isArray(session.entries) || session.entries.length > 500)
    throw new Error('Invalid session entries.');
  const ids = new Set<number>();
  for (const value of session.entries) {
    const entry = object(value);
    if (
      !Number.isSafeInteger(entry.id) ||
      Number(entry.id) < 1 ||
      ids.has(Number(entry.id)) ||
      typeof entry.name !== 'string' ||
      entry.name.length > 500 ||
      !['tool', 'action', 'state'].includes(String(entry.kind)) ||
      !['manual', 'native', 'replay', 'system'].includes(
        String(entry.source),
      ) ||
      ![
        'pending',
        'fulfilled',
        'rejected',
        'cancelled',
        'interrupted',
      ].includes(String(entry.status))
    )
      throw new Error('Invalid session event.');
    ids.add(Number(entry.id));
    if (
      !Number.isFinite(entry.startedAt) ||
      (entry.endedAt !== null && !Number.isFinite(entry.endedAt)) ||
      (entry.durationMs !== null &&
        (!Number.isFinite(entry.durationMs) || Number(entry.durationMs) < 0))
    )
      throw new Error('Invalid event timing.');
    validateState(entry.before);
    if (entry.after !== null) validateState(entry.after);
  }
  return raw as Session<TodoRecordedState>;
}
export function closeTodoSession(
  session: Session<TodoRecordedState>,
): Session<TodoRecordedState> {
  return {
    ...session,
    entries: session.entries.map((entry) =>
      entry.status === 'pending'
        ? ({
            ...entry,
            status: 'interrupted',
            error: {
              name: 'DocumentClosed',
              message: 'The document closed before the result was recorded.',
            },
          } as Entry<TodoRecordedState>)
        : entry,
    ),
  };
}
export class TodoSessionArchive {
  private snapshot = EMPTY;
  private listeners = new Set<() => void>();
  private initialized = false;
  getSnapshot = () => this.snapshot;
  getServerSnapshot = () => EMPTY;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(sessions: Session<TodoRecordedState>[], warning = '') {
    this.snapshot = { sessions, warning };
    for (const listener of this.listeners) listener();
  }
  initialize() {
    if (this.initialized) return;
    this.initialized = true;
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
      if (!Array.isArray(stored)) throw new Error('Invalid archive.');
      this.publish(
        stored
          .slice(0, 10)
          .map((value) =>
            closeTodoSession(parseTodoSession(JSON.stringify(value))),
          ),
      );
    } catch {
      this.publish(
        [],
        'Saved TodoMVC sessions could not be read. JSON download remains available.',
      );
    }
  }
  save(session: Session<TodoRecordedState>) {
    if (!this.initialized || !session.entries.length) return;
    let sessions = [
      session,
      ...this.snapshot.sessions.filter((item) => item.id !== session.id),
    ].slice(0, 10);
    try {
      while (JSON.stringify(sessions).length > LIMIT && sessions.length > 1)
        sessions = sessions.slice(0, -1);
      if (JSON.stringify(sessions).length > LIMIT)
        throw new Error('Too large.');
      localStorage.setItem(KEY, JSON.stringify(sessions));
      this.publish(sessions);
    } catch {
      this.publish(
        sessions,
        'Browser storage is full or unavailable. Download JSON to keep this session.',
      );
    }
  }
}
