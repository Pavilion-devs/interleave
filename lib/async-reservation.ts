import { ReservationLab, type Source } from './lab-engine.ts';

export interface PendingReservation {
  id: number;
  startedAt: number;
  dueAt: number | null;
  delayMs: number;
  held: boolean;
}
export function assertDelay(value: unknown): asserts value is number {
  if (!Number.isInteger(value) || Number(value) < 500 || Number(value) > 30000)
    throw new Error(
      'Completion delay must be a whole number from 500 to 30000 milliseconds.',
    );
}
/** The promise stays pending across the human edit. The timer models delayed application work, not a network request. */
export class AsyncReservation {
  private lab: ReservationLab;
  private listeners = new Set<() => void>();
  private snapshot: PendingReservation | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private finish: (() => void) | null = null;
  private abort: ((reason: string) => void) | null = null;
  private sequence = 0;
  constructor(lab: ReservationLab) {
    this.lab = lab;
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(snapshot: PendingReservation | null) {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }
  reserve(
    delayMs: number,
    source: Source,
    signal?: AbortSignal,
  ): Promise<ReturnType<ReservationLab['getSnapshot']>> {
    assertDelay(delayMs);
    if (signal?.aborted)
      throw new DOMException(
        'Reservation cancelled before it started.',
        'AbortError',
      );
    if (this.snapshot || this.lab.getSnapshot().reservation.pending)
      throw new Error(
        'A reservation is already pending. Finish or cancel it first.',
      );
    this.lab.begin(source);
    const startedAt = Date.now();
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;
        this.finish = null;
        this.abort = null;
        signal?.removeEventListener('abort', onAbort);
        this.publish(null);
      };
      const onAbort = () =>
        this.abort?.('The caller cancelled the reservation.');
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
    });
  }
  hold() {
    if (!this.snapshot)
      throw new Error('No asynchronous reservation is running.');
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.publish(Object.freeze({ ...this.snapshot, dueAt: null, held: true }));
    return this.snapshot;
  }
  completeNow() {
    if (!this.finish)
      throw new Error('No asynchronous reservation is running.');
    this.finish();
  }
  cancel(reason = 'Cancelled from the lab controls.') {
    if (!this.abort) throw new Error('No asynchronous reservation is running.');
    this.abort(reason);
  }
}
