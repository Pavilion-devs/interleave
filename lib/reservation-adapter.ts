import {
  SessionRecorder,
  type Session,
  type Provenance,
} from '../packages/recorder/src/index.ts';
import { AsyncReservation } from './async-reservation.ts';
import {
  ReservationLab,
  assertMode,
  assertQuantity,
  type Command,
  type Mode,
  type Source,
  type Reservation,
  type Assertion,
} from './lab-engine.ts';

export interface RecordedState {
  mode: Mode;
  reservation: Reservation;
  assertion: Assertion | null;
}
export const RESERVATION_ADAPTER = { id: 'interleave.reservation', version: 2 };
export class ReservationAdapter {
  lab: ReservationLab;
  operation: AsyncReservation;
  recorder: SessionRecorder<RecordedState>;
  private detach: () => void;
  constructor(mode: Mode = 'unguarded') {
    this.lab = new ReservationLab(mode);
    this.operation = new AsyncReservation(this.lab);
    this.recorder = new SessionRecorder({
      adapter: RESERVATION_ADAPTER,
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
            reservation: event.before,
            assertion: previous.assertion,
          },
          {
            mode: current.mode,
            reservation: event.after,
            assertion: current.assertion,
          },
          event.source,
        );
      }
      previous = current;
    });
  }
  readState = (): RecordedState => {
    const { mode, reservation, assertion } = this.lab.getSnapshot();
    return { mode, reservation, assertion };
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
  reserve(delayMs: number, source: Source = 'manual', signal?: AbortSignal) {
    return this.invoke('reservation_reserve', { delayMs }, source, async () => {
      await this.operation.reserve(delayMs, source, signal);
      return this.readState();
    });
  }
  edit(quantity: number, source: Source = 'manual') {
    return this.invoke('selection_change', { quantity }, source, () => {
      this.lab.edit(quantity, source);
      return this.readState();
    });
  }
  capture(source: Source = 'manual') {
    return this.invoke('reservation_capture', {}, source, () => {
      this.lab.begin(source);
      return this.readState();
    });
  }
  release(source: Source = 'manual') {
    return this.invoke('reservation_release', {}, source, () => {
      if (this.operation.getSnapshot()) this.operation.completeNow();
      else this.lab.release(source);
      return this.readState();
    });
  }
  hold(source: Source = 'manual') {
    return this.invoke('lab_hold_response', {}, source, () =>
      this.operation.hold(),
    );
  }
  cancel(source: Source = 'manual') {
    return this.invoke('reservation_cancel', {}, source, () => {
      if (this.operation.getSnapshot()) this.operation.cancel();
      else this.lab.cancel(source);
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
      this.operation.cancel('The document was closed.');
    this.recorder.interruptPending('The document was closed.');
    this.detach();
  }
}

/** Reproduce command ordering at real asynchronous checkpoints; wall-clock timing and model decisions are not replayed. */
export async function replayAsyncRecipe(
  recipe: readonly Command[],
  adapter: ReservationAdapter,
  step?: () => Promise<void>,
) {
  let pending: Promise<RecordedState> | null = null;
  let ownedOperationId: number | null = null;
  try {
    for (const command of recipe) {
      if (step) await step();
      switch (command.type) {
        case 'begin':
          if (pending)
            throw new Error(
              'A reservation is already pending in the recording.',
            );
          pending = adapter.reserve(30000, 'replay');
          // Attach a rejection handler immediately, including on cancelled or invalid recordings.
          void pending.catch(() => {});
          if (!adapter.operation.getSnapshot()) {
            await pending;
            throw new Error('Capture checkpoint was not reached.');
          }
          ownedOperationId = adapter.operation.getSnapshot()!.id;
          adapter.operation.hold();
          break;
        case 'edit':
          adapter.edit(command.quantity, 'replay');
          break;
        case 'release':
          if (!pending)
            throw new Error(
              'Recording releases a reservation before starting it.',
            );
          adapter.release('replay');
          await pending;
          pending = null;
          ownedOperationId = null;
          break;
        case 'cancel':
          if (!pending)
            throw new Error(
              'Recording cancels a reservation before starting it.',
            );
          adapter.cancel('replay');
          await pending.catch(() => {});
          pending = null;
          ownedOperationId = null;
          break;
        case 'observe':
          adapter.lab.observe('replay');
          break;
      }
    }
    if (pending)
      throw new Error('Recording ends before the pending operation finishes.');
    return adapter.lab.getSnapshot();
  } finally {
    if (
      ownedOperationId !== null &&
      adapter.operation.getSnapshot()?.id === ownedOperationId
    )
      adapter.operation.cancel('Replay stopped before completion.');
    if (pending) await pending.catch(() => {});
  }
}
export function recipeFromSession(session: Session<RecordedState>): Command[] {
  if (
    session.adapter.id !== RESERVATION_ADAPTER.id ||
    session.adapter.version !== RESERVATION_ADAPTER.version
  )
    throw new Error('This session needs a different application adapter.');
  if (session.droppedEntries)
    throw new Error(
      'This recording was truncated. It cannot be replayed reliably.',
    );
  if (
    session.entries.some(
      (entry) => entry.status === 'pending' || entry.status === 'interrupted',
    )
  )
    throw new Error(
      'This session contains unfinished calls. Save a completed run to replay it.',
    );
  const recipe = session.entries
    .filter((entry) => entry.kind === 'state')
    .map((entry) => {
      const command = entry.input as unknown as Command;
      if (
        !command ||
        !['observe', 'begin', 'edit', 'release', 'cancel'].includes(
          command.type,
        )
      )
        throw new Error('Unsupported recorded action.');
      if (command.type === 'edit') assertQuantity(command.quantity);
      return structuredClone(command);
    });
  if (!recipe.length)
    throw new Error('This recording has no application actions to replay.');
  const initial = session.initialState.reservation;
  if (
    initial.quantity !== 2 ||
    initial.revision !== 0 ||
    initial.pending ||
    initial.confirmed !== null
  )
    throw new Error('This recording requires a different starting state.');
  return recipe;
}
