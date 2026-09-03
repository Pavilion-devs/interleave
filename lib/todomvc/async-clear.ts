import { type TodoSource, TodoLab } from './lab.ts';

export interface PendingTodoClear {
  id: number;
  startedAt: number;
  dueAt: number | null;
  delayMs: number;
  held: boolean;
}
export function assertTodoDelay(value: unknown): asserts value is number {
  if (!Number.isInteger(value) || Number(value) < 500 || Number(value) > 20000)
    throw new Error(
      'Delay must be a whole number from 500 to 20000 milliseconds.',
    );
}

/** A real pending promise around the TodoMVC clear-completed integration. */
export class AsyncTodoClear {
  private lab: TodoLab;
  private listeners = new Set<() => void>();
  private snapshot: PendingTodoClear | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private finish: (() => void) | null = null;
  private abort: ((reason: string) => void) | null = null;
  private sequence = 0;
  constructor(lab: TodoLab) {
    this.lab = lab;
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(snapshot: PendingTodoClear | null) {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }
  clear(delayMs: number, source: TodoSource, signal?: AbortSignal) {
    assertTodoDelay(delayMs);
    if (signal?.aborted)
      throw new DOMException(
        'Clear cancelled before it started.',
        'AbortError',
      );
    if (this.snapshot || this.lab.getSnapshot().document.pending)
      throw new Error('A clear-completed operation is already running.');
    this.lab.startClear(source);
    const startedAt = Date.now();
    return new Promise<ReturnType<TodoLab['getSnapshot']>>(
      (resolve, reject) => {
        const cleanup = () => {
          if (this.timer) clearTimeout(this.timer);
          this.timer = null;
          this.finish = null;
          this.abort = null;
          signal?.removeEventListener('abort', onAbort);
          this.publish(null);
        };
        const onAbort = () =>
          this.abort?.('The caller cancelled the operation.');
        this.abort = (reason) => {
          this.lab.cancel(source);
          cleanup();
          reject(new DOMException(reason, 'AbortError'));
        };
        this.finish = () => {
          try {
            const result = this.lab.release(source);
            cleanup();
            resolve(result);
          } catch (error) {
            cleanup();
            reject(error);
          }
        };
        this.timer = setTimeout(() => this.finish?.(), delayMs);
        signal?.addEventListener('abort', onAbort, { once: true });
        this.publish(
          Object.freeze({
            id: ++this.sequence,
            startedAt,
            dueAt: startedAt + delayMs,
            delayMs,
            held: false,
          }),
        );
        if (signal?.aborted) onAbort();
      },
    );
  }
  hold() {
    if (!this.snapshot) throw new Error('No delayed clear is running.');
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.publish(Object.freeze({ ...this.snapshot, dueAt: null, held: true }));
    return this.snapshot;
  }
  completeNow() {
    if (!this.finish) throw new Error('No delayed clear is running.');
    this.finish();
  }
  cancel(reason = 'Cancelled from the TodoMVC controls.') {
    if (!this.abort) throw new Error('No delayed clear is running.');
    this.abort(reason);
  }
}
