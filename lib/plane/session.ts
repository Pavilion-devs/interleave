import type { Entry, Session } from '../../packages/recorder/src/index.ts';
import { assertMode } from '../lab-engine.ts';
import { PLANE_ADAPTER, type PlaneRecordedState } from './adapter.ts';

const KEY = 'interleave.plane.sessions.v1';
const LIMIT = 1500000;
const EMPTY: { sessions: Session<PlaneRecordedState>[]; warning: string } = {
  sessions: [],
  warning: '',
};
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid session object.');
  return value as Record<string, unknown>;
}
function metadata(value: unknown) {
  const item = object(value);
  if (
    typeof item.title !== 'string' ||
    item.title.length > 120 ||
    typeof item.url !== 'string' ||
    item.url.length > 500 ||
    typeof item.favicon !== 'string' ||
    item.favicon.length > 500 ||
    !['crawler', 'human'].includes(String(item.source))
  )
    throw new Error('Invalid Plane metadata.');
}
function validateState(value: unknown) {
  const state = object(value);
  assertMode(state.mode);
  const document = object(state.document);
  if (
    !['ready', 'crawling', 'applied', 'blocked', 'cancelled'].includes(
      String(document.phase),
    )
  )
    throw new Error('Invalid Plane document state.');
  const link = object(document.link);
  if (
    typeof link.id !== 'string' ||
    typeof link.issue !== 'string' ||
    typeof link.title !== 'string' ||
    link.title.length > 120 ||
    typeof link.url !== 'string' ||
    link.url.length > 500 ||
    !Number.isSafeInteger(link.revision) ||
    Number(link.revision) < 0
  )
    throw new Error('Invalid Plane issue link.');
  metadata(link.metadata);
  if (document.pending !== null) {
    const pending = object(document.pending);
    if (
      !Number.isSafeInteger(pending.id) ||
      !Number.isSafeInteger(pending.revision) ||
      typeof pending.url !== 'string'
    )
      throw new Error('Invalid queued Plane crawl.');
    metadata(pending.result);
  }
  if (state.assertion !== null) {
    const assertion = object(state.assertion);
    if (
      typeof assertion.passed !== 'boolean' ||
      !['blocked', 'applied'].includes(String(assertion.completion)) ||
      typeof assertion.rule !== 'string' ||
      typeof assertion.message !== 'string' ||
      typeof assertion.expectedMetadataTitle !== 'string' ||
      typeof assertion.actualMetadataTitle !== 'string'
    )
      throw new Error('Invalid Plane assertion.');
  }
}
export function parsePlaneSession(text: string): Session<PlaneRecordedState> {
  if (text.length > LIMIT)
    throw new Error('Session files must be smaller than 1.5 MB.');
  const raw: unknown = JSON.parse(text);
  const session = object(raw);
  const adapter = object(session.adapter);
  if (
    session.format !== 'interleave.session.v1' ||
    adapter.id !== PLANE_ADAPTER.id ||
    adapter.version !== PLANE_ADAPTER.version
  )
    throw new Error(
      'Only Interleave Plane issue-link v1 recordings are supported here.',
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
  return raw as Session<PlaneRecordedState>;
}
export function closePlaneSession(
  session: Session<PlaneRecordedState>,
): Session<PlaneRecordedState> {
  return {
    ...session,
    entries: session.entries.map((entry) =>
      entry.status === 'pending'
        ? ({
            ...entry,
            status: 'interrupted',
            error: {
              name: 'DocumentClosed',
              message: 'The Plane link closed before the result was recorded.',
            },
          } as Entry<PlaneRecordedState>)
        : entry,
    ),
  };
}
export class PlaneSessionArchive {
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
  private publish(sessions: Session<PlaneRecordedState>[], warning = '') {
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
            closePlaneSession(parsePlaneSession(JSON.stringify(value))),
          ),
      );
    } catch {
      this.publish(
        [],
        'Saved Plane sessions could not be read. JSON download remains available.',
      );
    }
  }
  save(session: Session<PlaneRecordedState>) {
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
