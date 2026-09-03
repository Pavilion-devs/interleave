import { type PlaneSource, PlaneLab } from './lab.ts';

export interface PendingPlaneOperation {
  id: number;
  startedAt: number;
  dueAt: number | null;
  delayMs: number;
  held: boolean;
}
export function assertPlaneDelay(value: unknown): asserts value is number {
  if (!Number.isInteger(value) || Number(value) < 500 || Number(value) > 20000)
    throw new Error(
      'Delay must be a whole number from 500 to 20000 milliseconds.',
    );
}

/** A real pending promise around Plane's queued metadata crawler. */
export class AsyncPlaneCrawl {
  private lab: PlaneLab;
  private listeners = new Set<() => void>();
  private snapshot: PendingPlaneOperation | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private finish: (() => void) | null = null;
  private abort: ((reason: string) => void) | null = null;
  private sequence = 0;
  constructor(lab: PlaneLab) {
    this.lab = lab;
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(snapshot: PendingPlaneOperation | null) {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }
  crawl(
    title: string,
    delayMs: number,
    source: PlaneSource,
    signal?: AbortSignal,
  ) {
    assertPlaneDelay(delayMs);
    if (signal?.aborted)
      throw new DOMException(
        'Plane crawl cancelled before it started.',
        'AbortError',
      );
    if (this.snapshot || this.lab.getSnapshot().document.pending)
      throw new Error('A Plane metadata crawl is already queued.');
    this.lab.startCrawl(title, source);
    const startedAt = Date.now();
    return new Promise<ReturnType<PlaneLab['getSnapshot']>>(
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
          this.abort?.('The caller cancelled the Plane operation.');
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
    if (!this.snapshot) throw new Error('No Plane metadata crawl is running.');
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.publish(Object.freeze({ ...this.snapshot, dueAt: null, held: true }));
    return this.snapshot;
  }
  completeNow() {
    if (!this.finish) throw new Error('No Plane metadata crawl is running.');
    this.finish();
  }
  cancel(reason = 'Cancelled from the Plane controls.') {
    if (!this.abort) throw new Error('No Plane metadata crawl is running.');
    this.abort(reason);
  }
}
