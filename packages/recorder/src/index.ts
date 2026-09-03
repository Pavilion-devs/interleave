export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };
export type Provenance = 'native' | 'manual' | 'replay' | 'system';
export type EntryStatus =
  | 'pending'
  | 'fulfilled'
  | 'rejected'
  | 'cancelled'
  | 'interrupted';
export interface Entry<S> {
  id: number;
  kind: 'tool' | 'action' | 'state';
  name: string;
  source: Provenance;
  startedAt: number;
  endedAt: number | null;
  durationMs: number | null;
  status: EntryStatus;
  input: Json;
  output: Json;
  error: { name: string; message: string } | null;
  before: S;
  after: S | null;
}
export interface Session<S> {
  format: 'interleave.session.v1';
  id: string;
  adapter: { id: string; version: number };
  startedAt: number;
  updatedAt: number;
  initialState: S;
  latestState: S;
  entries: Entry<S>[];
  droppedEntries: number;
}
export interface RecorderOptions<S> {
  adapter: { id: string; version: number };
  readState: () => S;
  /** Select/redact fields before they enter the recording. Does not alter application values. */
  redact?: (
    value: unknown,
    field: 'input' | 'output' | 'state' | 'error',
  ) => unknown;
  maxEntries?: number;
  now?: () => number;
  createId?: () => string;
}
function json(value: unknown): Json {
  try {
    return JSON.parse(JSON.stringify(value ?? null)) as Json;
  } catch {
    return { serializationError: 'Value is not JSON serializable.' };
  }
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}
/** Framework-independent, opt-in instrumentation of application tools and semantic actions. */
export class SessionRecorder<S> {
  private options: RecorderOptions<S>;
  private session: Session<S>;
  private listeners = new Set<() => void>();
  private sequence = 0;
  constructor(options: RecorderOptions<S>) {
    this.options = options;
    const state = this.state();
    const now = this.now();
    this.session = freeze({
      format: 'interleave.session.v1',
      id: this.id(),
      adapter: { ...options.adapter },
      startedAt: now,
      updatedAt: now,
      initialState: state,
      latestState: state,
      entries: [],
      droppedEntries: 0,
    });
  }
  private now() {
    return this.options.now?.() ?? Date.now();
  }
  private id() {
    return this.options.createId?.() ?? crypto.randomUUID();
  }
  private clean(value: unknown, field: 'input' | 'output' | 'state' | 'error') {
    return json(
      this.options.redact ? this.options.redact(value, field) : value,
    );
  }
  private state(): S {
    return this.clean(this.options.readState(), 'state') as S;
  }
  getSnapshot = () => this.session;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(entries: Entry<S>[]) {
    const max = Math.max(10, this.options.maxEntries ?? 500);
    let dropped = 0;
    while (entries.length > max) {
      const index = entries.findIndex((entry) => entry.status !== 'pending');
      if (index < 0) break;
      entries.splice(index, 1);
      dropped++;
    }
    this.session = freeze({
      ...this.session,
      entries,
      updatedAt: this.now(),
      latestState: this.state(),
      droppedEntries: this.session.droppedEntries + dropped,
    });
    for (const listener of this.listeners) listener();
  }
  /** Preserve the underlying return value, exception, or promise. */
  run<T>(
    name: string,
    input: unknown,
    source: Provenance,
    action: () => T,
    kind: 'tool' | 'action' = 'tool',
  ): T {
    const sessionId = this.session.id;
    const id = ++this.sequence;
    const startedAt = this.now();
    this.publish([
      ...this.session.entries,
      {
        id,
        kind,
        name,
        source,
        startedAt,
        endedAt: null,
        durationMs: null,
        status: 'pending',
        input: this.clean(input, 'input'),
        output: null,
        error: null,
        before: this.state(),
        after: null,
      },
    ]);
    const finish = (status: EntryStatus, value: unknown) => {
      if (this.session.id !== sessionId) return;
      const endedAt = this.now();
      const rawError =
        value instanceof Error
          ? { name: value.name, message: value.message }
          : { name: 'Error', message: String(value) };
      const error =
        status === 'fulfilled'
          ? null
          : (this.clean(rawError, 'error') as unknown as Entry<S>['error']);
      this.publish(
        this.session.entries.map((entry) =>
          entry.id === id && entry.status === 'pending'
            ? {
                ...entry,
                status,
                endedAt,
                durationMs: Math.max(0, endedAt - startedAt),
                output:
                  status === 'fulfilled' ? this.clean(value, 'output') : null,
                error,
                after: this.state(),
              }
            : entry,
        ),
      );
    };
    const fail = (error: unknown): never => {
      finish(
        error instanceof Error && error.name === 'AbortError'
          ? 'cancelled'
          : 'rejected',
        error,
      );
      throw error;
    };
    try {
      const result = action();
      if (result && typeof (result as unknown as PromiseLike<unknown>).then === 'function')
        return Promise.resolve(result).then((value) => {
          finish('fulfilled', value);
          return value;
        }, fail) as T;
      finish('fulfilled', result);
      return result;
    } catch (error) {
      return fail(error);
    }
  }
  stateChange(
    name: string,
    input: unknown,
    before: S,
    after: S,
    source: Provenance,
  ) {
    const now = this.now();
    this.publish([
      ...this.session.entries,
      {
        id: ++this.sequence,
        kind: 'state',
        name,
        source,
        startedAt: now,
        endedAt: now,
        durationMs: 0,
        status: 'fulfilled',
        input: this.clean(input, 'input'),
        output: null,
        error: null,
        before: this.clean(before, 'state') as S,
        after: this.clean(after, 'state') as S,
      },
    ]);
  }
  interruptPending(message: string) {
    const endedAt = this.now();
    this.publish(
      this.session.entries.map((entry) =>
        entry.status === 'pending'
          ? {
              ...entry,
              status: 'interrupted',
              endedAt,
              durationMs: Math.max(0, endedAt - entry.startedAt),
              after: this.state(),
              error: { name: 'Interrupted', message },
            }
          : entry,
      ),
    );
  }
  newSession() {
    if (this.session.entries.some((entry) => entry.status === 'pending'))
      this.interruptPending('Recording was ended before this call settled.');
    const state = this.state();
    const now = this.now();
    this.sequence = 0;
    this.session = freeze({
      format: 'interleave.session.v1',
      id: this.id(),
      adapter: { ...this.options.adapter },
      startedAt: now,
      updatedAt: now,
      initialState: state,
      latestState: state,
      entries: [],
      droppedEntries: 0,
    });
    for (const listener of this.listeners) listener();
  }
}
