export type Mode = 'unguarded' | 'guarded';
export type Source = 'manual' | 'native' | 'replay';
export type Actor = 'agent' | 'human' | 'system' | 'guard';
export type Command =
  | { type: 'observe' }
  | { type: 'begin' }
  | { type: 'edit'; quantity: number }
  | { type: 'cancel' }
  | { type: 'release' };
export interface Reservation {
  quantity: number;
  revision: number;
  humanIntent: number;
  confirmed: number | null;
  phase: 'ready' | 'paused' | 'committed' | 'blocked' | 'cancelled';
  pending: { id: number; quantity: number; revision: number } | null;
}
export interface TraceEvent {
  id: number;
  elapsedMs: number;
  actor: Actor;
  source: Source;
  kind: string;
  title: string;
  detail: string;
  before: Reservation;
  after: Reservation;
}
export interface Assertion {
  passed: boolean;
  expected: number;
  actual: number;
  completion: 'blocked' | 'committed';
  message: string;
}
export interface LabSnapshot {
  mode: Mode;
  reservation: Reservation;
  events: TraceEvent[];
  recipe: Command[];
  assertion: Assertion | null;
  runNumber: number;
}
export const SAMPLE_RECIPE: Command[] = [
  { type: 'observe' },
  { type: 'begin' },
  { type: 'observe' },
  { type: 'edit', quantity: 1 },
  { type: 'observe' },
  { type: 'release' },
];
const initialReservation = (): Reservation => ({
  quantity: 2,
  revision: 0,
  humanIntent: 2,
  confirmed: null,
  phase: 'ready',
  pending: null,
});
const copy = <T>(value: T): T => structuredClone(value);
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}
export function assertMode(value: unknown): asserts value is Mode {
  if (value !== 'unguarded' && value !== 'guarded')
    throw new Error('Mode must be unguarded or guarded.');
}
export function assertQuantity(value: unknown): asserts value is number {
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 4)
    throw new Error('Choose a whole number of tickets from 1 to 4.');
}
/** A disposable in-memory fixture. UI and WebMCP share these exact mutations. */
export class ReservationLab {
  private state: LabSnapshot;
  private listeners = new Set<() => void>();
  private startedAt = Date.now();
  private nextOperation = 1;
  constructor(mode: Mode = 'unguarded') {
    assertMode(mode);
    this.state = freeze({
      mode,
      reservation: initialReservation(),
      events: [],
      recipe: [],
      assertion: null,
      runNumber: 1,
    });
  }
  getSnapshot = (): LabSnapshot => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(next: LabSnapshot) {
    this.state = freeze(next);
    for (const listener of this.listeners) listener();
  }
  reset(mode: Mode = this.state.mode) {
    assertMode(mode);
    this.startedAt = Date.now();
    this.nextOperation = 1;
    this.publish({
      mode,
      reservation: initialReservation(),
      events: [],
      recipe: [],
      assertion: null,
      runNumber: this.state.runNumber + 1,
    });
    return this.state;
  }
  private record(
    command: Command,
    source: Source,
    actor: Actor,
    kind: string,
    title: string,
    detail: string,
    next: Reservation,
    assertion: Assertion | null = this.state.assertion,
  ) {
    const event: TraceEvent = {
      id: this.state.events.length + 1,
      elapsedMs: Date.now() - this.startedAt,
      actor,
      source,
      kind,
      title,
      detail,
      before: copy(this.state.reservation),
      after: copy(next),
    };
    this.publish({
      ...this.state,
      reservation: next,
      assertion,
      events: [...this.state.events, event],
      recipe: [...this.state.recipe, copy(command)],
    });
    return this.state;
  }
  observe(source: Source = 'manual') {
    return this.record(
      { type: 'observe' },
      source,
      'system',
      'observation',
      'Inspect current state',
      'The selection is read without changing it.',
      copy(this.state.reservation),
    );
  }
  begin(source: Source = 'manual') {
    const current = this.state.reservation;
    if (current.pending)
      throw new Error(
        'An operation is already paused. Release it before starting another.',
      );
    const pending = {
      id: this.nextOperation++,
      quantity: current.quantity,
      revision: current.revision,
    };
    return this.record(
      { type: 'begin' },
      source,
      'agent',
      'read',
      'Agent captures selection',
      `${current.quantity} tickets captured at revision ${current.revision}. The write is held at a checkpoint.`,
      { ...copy(current), pending, phase: 'paused' },
      null,
    );
  }
  edit(quantity: number, source: Source = 'manual') {
    assertQuantity(quantity);
    const current = this.state.reservation;
    const next = {
      ...copy(current),
      quantity,
      humanIntent: quantity,
      revision: current.revision + 1,
      confirmed: null,
    };
    if (!next.pending) next.phase = 'ready';
    return this.record(
      { type: 'edit', quantity },
      source,
      'human',
      'edit',
      source === 'manual' ? 'Human changes selection' : 'Injected human edit',
      `${current.quantity} → ${quantity} tickets. The live revision advances to ${next.revision}.${source === 'manual' ? '' : ' This human action is injected by the test fixture.'}`,
      next,
      null,
    );
  }
  release(source: Source = 'manual') {
    const current = this.state.reservation;
    const operation = current.pending;
    if (!operation)
      throw new Error(
        'There is no pending write to release. Capture the selection first.',
      );
    if (
      this.state.mode === 'guarded' &&
      operation.revision !== current.revision
    ) {
      const next: Reservation = {
        ...copy(current),
        pending: null,
        phase: 'blocked',
      };
      const assertion: Assertion = {
        passed: true,
        expected: next.humanIntent,
        actual: next.quantity,
        completion: 'blocked',
        message:
          'The stale write was refused. The human selection is intact; the agent must read again to finish.',
      };
      return this.record(
        { type: 'release' },
        source,
        'guard',
        'blocked',
        'Stale write blocked',
        `Captured revision ${operation.revision} does not match live revision ${current.revision}. No reservation was committed.`,
        next,
        assertion,
      );
    }
    // Intentional seeded defect: unguarded mode commits a captured value without revalidation.
    const next: Reservation = {
      ...copy(current),
      quantity: operation.quantity,
      revision: current.revision + 1,
      confirmed: operation.quantity,
      pending: null,
      phase: 'committed',
    };
    const passed = next.quantity === next.humanIntent;
    const assertion: Assertion = {
      passed,
      expected: next.humanIntent,
      actual: next.quantity,
      completion: 'committed',
      message: passed
        ? 'The committed selection matches the latest human intent.'
        : 'The agent committed an old selection and overwrote the newer human choice.',
    };
    return this.record(
      { type: 'release' },
      source,
      'agent',
      passed ? 'commit' : 'violation',
      passed ? 'Reservation committed' : 'Human choice overwritten',
      passed
        ? `${next.confirmed} tickets reserved from the current selection.`
        : `The agent writes ${operation.quantity} tickets from revision ${operation.revision}, replacing the human choice of ${current.humanIntent}.`,
      next,
      assertion,
    );
  }
  execute(command: Command, source: Source = 'replay') {
    switch (command.type) {
      case 'observe':
        return this.observe(source);
      case 'begin':
        return this.begin(source);
      case 'edit':
        return this.edit(command.quantity, source);
      case 'release':
        return this.release(source);
      case 'cancel':
        return this.cancel(source);
      default:
        throw new Error('Unknown scenario command.');
    }
  }
  cancel(source: Source = 'manual') {
    const current = this.state.reservation;
    if (!current.pending)
      throw new Error('There is no pending reservation to cancel.');
    return this.record(
      { type: 'cancel' },
      source,
      'system',
      'cancelled',
      'Pending reservation cancelled',
      'The pending operation was cancelled without committing its captured selection.',
      { ...copy(current), pending: null, phase: 'cancelled' },
      null,
    );
  }
}
export function replayRecipe(
  recipe: readonly Command[],
  mode: Mode,
): LabSnapshot {
  const lab = new ReservationLab(mode);
  for (const command of recipe) lab.execute(command, 'replay');
  return lab.getSnapshot();
}
/** Re-run each candidate and retain only reductions that still witness a violation. */
export function reduceFailure(recipe: readonly Command[]) {
  const fails = (candidate: Command[]) => {
    try {
      return replayRecipe(candidate, 'unguarded').assertion?.passed === false;
    } catch {
      return false;
    }
  };
  let reduced = copy([...recipe]);
  if (!fails(reduced))
    throw new Error(
      'This sequence has no reproducible stale-write violation to reduce.',
    );
  let attempts = 1;
  for (let index = 0; index < reduced.length;) {
    const candidate = reduced.filter((_, i) => i !== index);
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
    baseline: replayRecipe(reduced, 'unguarded').assertion,
    guarded: replayRecipe(reduced, 'guarded').assertion,
  };
}
export function exportRegression(recipe: readonly Command[]) {
  const reduction = reduceFailure(recipe);
  return `// Save in this project's tests/ directory. Run: node --test tests/interleave-regression.test.mjs\n// Seeded reservation fixture; checks actual application state.\nimport test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { replayRecipe } from '../lib/lab-engine.ts';\n\nconst recipe = ${JSON.stringify(reduction.recipe, null, 2)};\n\ntest('the stale-write fixture reproduces the defect', () => {\n  const run = replayRecipe(recipe, 'unguarded');\n  assert.equal(run.assertion.passed, false);\n  assert.notEqual(run.reservation.quantity, run.reservation.humanIntent);\n});\n\ntest('version checking preserves the newer human selection', () => {\n  const run = replayRecipe(recipe, 'guarded');\n  assert.equal(run.assertion.passed, true);\n  assert.equal(run.reservation.quantity, run.reservation.humanIntent);\n  assert.equal(run.reservation.phase, 'blocked');\n  assert.equal(run.reservation.confirmed, null);\n});\n`;
}
