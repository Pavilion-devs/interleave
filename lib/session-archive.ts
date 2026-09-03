import type { Entry, Session } from '../packages/recorder/src/index.ts';
import type { RecordedState } from './reservation-adapter.ts';
import { assertMode, assertQuantity } from './lab-engine.ts';

const KEY = 'interleave.sessions.v1';
const LIMIT = 1500000;
const EMPTY: { sessions: Session<RecordedState>[]; warning: string } = {
  sessions: [],
  warning: '',
};
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid session object.');
  return value as Record<string, unknown>;
}
function state(value: unknown) {
  const s = object(value);
  assertMode(s.mode);
  const r = object(s.reservation);
  assertQuantity(r.quantity);
  assertQuantity(r.humanIntent);
  if (
    !Number.isSafeInteger(r.revision) ||
    Number(r.revision) < 0 ||
    !['ready', 'paused', 'committed', 'blocked', 'cancelled'].includes(
      String(r.phase),
    )
  )
    throw new Error('Invalid recorded reservation state.');
  if (r.confirmed !== null) assertQuantity(r.confirmed);
  if (r.pending !== null) {
    const p = object(r.pending);
    assertQuantity(p.quantity);
    if (!Number.isSafeInteger(p.revision) || !Number.isSafeInteger(p.id))
      throw new Error('Invalid captured state.');
  }
  if (s.assertion !== null) {
    const a = object(s.assertion);
    if (
      typeof a.passed !== 'boolean' ||
      typeof a.message !== 'string' ||
      !['blocked', 'committed'].includes(String(a.completion))
    )
      throw new Error('Invalid assertion.');
    assertQuantity(a.actual);
    assertQuantity(a.expected);
  }
}
export function parseSession(text: string): Session<RecordedState> {
  if (text.length > LIMIT)
    throw new Error('Session files must be smaller than 1.5 MB.');
  const raw: unknown = JSON.parse(text);
  const s = object(raw);
  const adapter = object(s.adapter);
  if (
    s.format !== 'interleave.session.v1' ||
    adapter.id !== 'interleave.reservation' ||
    adapter.version !== 2
  )
    throw new Error(
      'Only Interleave reservation v2 recordings are supported here.',
    );
  if (
    typeof s.id !== 'string' ||
    !s.id ||
    s.id.length > 100 ||
    !Number.isFinite(s.startedAt) ||
    !Number.isFinite(s.updatedAt) ||
    !Number.isSafeInteger(s.droppedEntries) ||
    Number(s.droppedEntries) < 0
  )
    throw new Error('Invalid session metadata.');
  state(s.initialState);
  state(s.latestState);
  if (!Array.isArray(s.entries) || s.entries.length > 500)
    throw new Error('Invalid session entries.');
  const ids = new Set<number>();
  for (const value of s.entries) {
    const e = object(value);
    if (
      !Number.isSafeInteger(e.id) ||
      Number(e.id) < 1 ||
      ids.has(Number(e.id)) ||
      typeof e.name !== 'string' ||
      e.name.length > 500 ||
      !['tool', 'action', 'state'].includes(String(e.kind)) ||
      !['manual', 'native', 'replay', 'system'].includes(String(e.source)) ||
      ![
        'pending',
        'fulfilled',
        'rejected',
        'cancelled',
        'interrupted',
      ].includes(String(e.status))
    )
      throw new Error('Invalid session event.');
    ids.add(Number(e.id));
    if (
      !Number.isFinite(e.startedAt) ||
      (e.endedAt !== null && !Number.isFinite(e.endedAt)) ||
      (e.durationMs !== null &&
        (!Number.isFinite(e.durationMs) || Number(e.durationMs) < 0))
    )
      throw new Error('Invalid event timing.');
    state(e.before);
    if (e.after !== null) state(e.after);
    if (e.error !== null) {
      const error = object(e.error);
      if (typeof error.name !== 'string' || typeof error.message !== 'string')
        throw new Error('Invalid recorded error.');
    }
  }
  return raw as Session<RecordedState>;
}
export function closeInterruptedSession(
  session: Session<RecordedState>,
): Session<RecordedState> {
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
          } as Entry<RecordedState>)
        : entry,
    ),
  };
}
/** Storage is local to this browser and origin. Imported files are data, never executable scenarios. */
export class SessionArchive {
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
  private publish(sessions: Session<RecordedState>[], warning = '') {
    this.snapshot = { sessions, warning };
    for (const listener of this.listeners) listener();
  }
  initialize() {
    if (this.initialized) return;
    this.initialized = true;
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
      if (!Array.isArray(stored)) throw new Error('Invalid archive.');
      const sessions = stored
        .slice(0, 10)
        .map((value) =>
          closeInterruptedSession(parseSession(JSON.stringify(value))),
        );
      this.publish(sessions);
    } catch {
      this.publish(
        [],
        'Saved sessions could not be read. New recordings remain available for JSON download.',
      );
    }
  }
  save(session: Session<RecordedState>) {
    if (!this.initialized || !session.entries.length) return;
    let sessions = [
      session,
      ...this.snapshot.sessions.filter((item) => item.id !== session.id),
    ].slice(0, 10);
    try {
      while (JSON.stringify(sessions).length > LIMIT && sessions.length > 1)
        sessions = sessions.slice(0, -1);
      if (JSON.stringify(sessions).length > LIMIT)
        throw new Error('Session is too large.');
      localStorage.setItem(KEY, JSON.stringify(sessions));
      this.publish(sessions);
    } catch {
      this.publish(
        sessions,
        'Browser storage is full or unavailable. Download the session JSON to keep this recording.',
      );
    }
  }
}
