import {
  SessionRecorder,
  type Provenance,
  type Session,
} from '../../packages/recorder/src/index.ts';
import { assertMode, type Mode } from '../lab-engine.ts';
import { AsyncPlaneCrawl } from './async-crawl.ts';
import {
  PlaneLab,
  assertPlaneTitle,
  type PlaneAssertion,
  type PlaneCommand,
  type PlaneDocument,
  type PlaneSource,
} from './lab.ts';

export interface PlaneRecordedState {
  mode: Mode;
  document: PlaneDocument;
  assertion: PlaneAssertion | null;
}
export const PLANE_ADAPTER = { id: 'interleave.plane.issue-link', version: 1 };

export class PlaneAdapter {
  lab: PlaneLab;
  operation: AsyncPlaneCrawl;
  recorder: SessionRecorder<PlaneRecordedState>;
  private detach: () => void;
  constructor(mode: Mode = 'unguarded') {
    this.lab = new PlaneLab(mode);
    this.operation = new AsyncPlaneCrawl(this.lab);
    this.recorder = new SessionRecorder({
      adapter: PLANE_ADAPTER,
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
            document: event.before,
            assertion: previous.assertion,
          },
          {
            mode: current.mode,
            document: event.after,
            assertion: current.assertion,
          },
          event.source,
        );
      }
      previous = current;
    });
  }
  readState = (): PlaneRecordedState => {
    const { mode, document, assertion } = this.lab.getSnapshot();
    return { mode, document, assertion };
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
  crawl(
    title: string,
    delayMs: number,
    source: PlaneSource = 'manual',
    signal?: AbortSignal,
  ) {
    return this.invoke(
      'plane_patch_link_slow',
      { title, delayMs },
      source,
      async () => {
        await this.operation.crawl(title, delayMs, source, signal);
        return this.readState();
      },
    );
  }
  editMetadata(title: string, source: PlaneSource = 'manual') {
    return this.invoke('plane_set_link_metadata', { title }, source, () => {
      this.lab.editMetadata(title, source);
      return this.readState();
    });
  }
  hold(source: PlaneSource = 'manual') {
    return this.invoke('plane_hold_crawl', {}, source, () =>
      this.operation.hold(),
    );
  }
  complete(source: PlaneSource = 'manual') {
    return this.invoke('plane_complete_crawl', {}, source, () => {
      this.operation.completeNow();
      return this.readState();
    });
  }
  cancel(source: PlaneSource = 'manual') {
    return this.invoke('plane_cancel_crawl', {}, source, () => {
      this.operation.cancel();
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
      this.operation.cancel('The Plane link was closed.');
    this.recorder.interruptPending('The Plane link was closed.');
    this.detach();
  }
}

export async function replayPlaneAsync(
  recipe: readonly PlaneCommand[],
  adapter: PlaneAdapter,
  step?: () => Promise<void>,
) {
  let pending: Promise<PlaneRecordedState> | null = null;
  let ownedId: number | null = null;
  try {
    for (const command of recipe) {
      if (step) await step();
      switch (command.type) {
        case 'observe':
          adapter.lab.observe('replay');
          break;
        case 'start_crawl':
          if (pending)
            throw new Error('The recording starts two Plane crawls.');
          pending = adapter.crawl(command.title, 20000, 'replay');
          void pending.catch(() => {});
          if (!adapter.operation.getSnapshot()) {
            await pending;
            throw new Error('The asynchronous checkpoint was not reached.');
          }
          ownedId = adapter.operation.getSnapshot()!.id;
          adapter.operation.hold();
          break;
        case 'edit_metadata':
          adapter.editMetadata(command.title, 'replay');
          break;
        case 'release':
          if (!pending)
            throw new Error('The recording completes before dispatch.');
          adapter.complete('replay');
          await pending;
          pending = null;
          ownedId = null;
          break;
        case 'cancel':
          if (!pending)
            throw new Error('The recording cancels before dispatch.');
          adapter.cancel('replay');
          await pending.catch(() => {});
          pending = null;
          ownedId = null;
          break;
      }
    }
    if (pending) throw new Error('The recording ends with unfinished work.');
    return adapter.lab.getSnapshot();
  } finally {
    if (ownedId !== null && adapter.operation.getSnapshot()?.id === ownedId)
      adapter.operation.cancel('Replay stopped before completion.');
    if (pending) await pending.catch(() => {});
  }
}

export function planeRecipeFromSession(
  session: Session<PlaneRecordedState>,
): PlaneCommand[] {
  if (
    session.adapter.id !== PLANE_ADAPTER.id ||
    session.adapter.version !== PLANE_ADAPTER.version
  )
    throw new Error('This recording needs a different application adapter.');
  if (session.droppedEntries)
    throw new Error(
      'This recording was truncated and cannot be replayed reliably.',
    );
  if (
    session.entries.some(
      (entry) => entry.status === 'pending' || entry.status === 'interrupted',
    )
  )
    throw new Error(
      'Finish every recorded call before replaying this session.',
    );
  const recipe = session.entries
    .filter((entry) => entry.kind === 'state')
    .map((entry) => {
      const command = entry.input as unknown as PlaneCommand;
      if (
        !command ||
        ![
          'observe',
          'start_crawl',
          'edit_metadata',
          'release',
          'cancel',
        ].includes(command.type)
      )
        throw new Error('The recording contains an unsupported action.');
      if (command.type === 'start_crawl' || command.type === 'edit_metadata')
        assertPlaneTitle(command.title);
      return structuredClone(command);
    });
  if (!recipe.length)
    throw new Error('This recording has no application actions.');
  const initial = session.initialState.document;
  if (
    initial.link.id !== 'link-9674' ||
    initial.link.revision !== 0 ||
    initial.pending
  )
    throw new Error(
      'This recording requires a different Plane starting state.',
    );
  return recipe;
}
