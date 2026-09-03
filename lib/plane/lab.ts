import { assertMode, type Mode } from '../lab-engine.ts';

export type PlaneSource = 'manual' | 'native' | 'replay';
export type PlaneActor = 'agent' | 'human' | 'worker' | 'guard' | 'system';
export type PlanePhase =
  | 'ready'
  | 'crawling'
  | 'applied'
  | 'blocked'
  | 'cancelled';
export type PlaneCommand =
  | { type: 'observe' }
  | { type: 'start_crawl'; title: string }
  | { type: 'edit_metadata'; title: string }
  | { type: 'release' }
  | { type: 'cancel' };

export interface PlaneMetadata {
  title: string;
  url: string;
  favicon: string;
  source: 'crawler' | 'human';
}
export interface PlaneIssueLink {
  id: string;
  issue: string;
  title: string;
  url: string;
  metadata: PlaneMetadata;
  revision: number;
}
export interface PendingPlaneCrawl {
  id: number;
  url: string;
  revision: number;
  result: PlaneMetadata;
}
export interface PlaneDocument {
  link: PlaneIssueLink;
  phase: PlanePhase;
  pending: PendingPlaneCrawl | null;
}
export interface PlaneAssertion {
  passed: boolean;
  completion: 'blocked' | 'applied';
  rule: string;
  expectedMetadataTitle: string;
  actualMetadataTitle: string;
  message: string;
}
export interface PlaneTraceEvent {
  id: number;
  elapsedMs: number;
  actor: PlaneActor;
  source: PlaneSource;
  kind: string;
  title: string;
  detail: string;
  before: PlaneDocument;
  after: PlaneDocument;
}
export interface PlaneLabSnapshot {
  mode: Mode;
  document: PlaneDocument;
  events: PlaneTraceEvent[];
  recipe: PlaneCommand[];
  assertion: PlaneAssertion | null;
  runNumber: number;
}

export const PLANE_COMMIT = 'da1a7ab85012d16836459a10dd92ec55eb739c69';
export const PLANE_ISSUE = 'makeplane/plane#9674';
export const PLANE_RULE =
  'Metadata explicitly saved after a crawl is queued must not be overwritten by that stale crawl.';
export const PLANE_CRAWLED_METADATA: PlaneMetadata = {
  title: 'Plane documentation',
  url: 'https://docs.plane.so',
  favicon: 'plane',
  source: 'crawler',
};
export const SAMPLE_PLANE_RECIPE: PlaneCommand[] = [
  { type: 'observe' },
  { type: 'start_crawl', title: 'Production runbook' },
  { type: 'edit_metadata', title: 'Human verified runbook' },
  { type: 'observe' },
  { type: 'release' },
];

const copy = <T>(value: T): T => structuredClone(value);
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}
export function assertPlaneTitle(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 120)
    throw new Error('Title must contain 1 to 120 characters.');
}
const initialDocument = (): PlaneDocument => ({
  link: {
    id: 'link-9674',
    issue: 'WEB-9674',
    title: 'Incident response',
    url: 'https://docs.plane.so',
    metadata: copy(PLANE_CRAWLED_METADATA),
    revision: 0,
  },
  phase: 'ready',
  pending: null,
});

/**
 * Executable model of Plane preview@da1a7ab's issue-link PATCH + Celery task.
 * Current mode mirrors the unconditional metadata assignment. Guarded mode
 * mirrors the compare-and-set patch generated alongside this integration.
 */
export class PlaneLab {
  private state: PlaneLabSnapshot;
  private listeners = new Set<() => void>();
  private startedAt = Date.now();
  private nextOperation = 1;
  constructor(mode: Mode = 'unguarded') {
    assertMode(mode);
    this.state = freeze({
      mode,
      document: initialDocument(),
      events: [],
      recipe: [],
      assertion: null,
      runNumber: 1,
    });
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(next: PlaneLabSnapshot) {
    this.state = freeze(next);
    for (const listener of this.listeners) listener();
  }
  reset(mode: Mode = this.state.mode) {
    assertMode(mode);
    this.startedAt = Date.now();
    this.nextOperation = 1;
    this.publish({
      mode,
      document: initialDocument(),
      events: [],
      recipe: [],
      assertion: null,
      runNumber: this.state.runNumber + 1,
    });
    return this.state;
  }
  private record(
    command: PlaneCommand,
    source: PlaneSource,
    actor: PlaneActor,
    kind: string,
    title: string,
    detail: string,
    document: PlaneDocument,
    assertion: PlaneAssertion | null = this.state.assertion,
  ) {
    const event: PlaneTraceEvent = {
      id: this.state.events.length + 1,
      elapsedMs: Date.now() - this.startedAt,
      actor,
      source,
      kind,
      title,
      detail,
      before: copy(this.state.document),
      after: copy(document),
    };
    this.publish({
      ...this.state,
      document,
      events: [...this.state.events, event],
      recipe: [...this.state.recipe, copy(command)],
      assertion,
    });
    return this.state;
  }
  observe(source: PlaneSource = 'manual') {
    return this.record(
      { type: 'observe' },
      source,
      'system',
      'observation',
      'Inspect Plane issue link',
      'The link, metadata, revision, and queued worker are read without mutation.',
      copy(this.state.document),
    );
  }
  startCrawl(title: string, source: PlaneSource = 'manual') {
    assertPlaneTitle(title);
    const current = this.state.document;
    if (current.pending)
      throw new Error('A Plane metadata crawl is already queued.');
    const clean = title.trim();
    const link: PlaneIssueLink = {
      ...copy(current.link),
      title: clean,
      revision: current.link.revision + 1,
    };
    const pending: PendingPlaneCrawl = {
      id: this.nextOperation++,
      url: link.url,
      revision: link.revision,
      result: copy(PLANE_CRAWLED_METADATA),
    };
    return this.record(
      { type: 'start_crawl', title: clean },
      source,
      'agent',
      'dispatch',
      'Plane PATCH queues a crawler',
      `PATCH changes only the display title, but link.py queues crawl_work_item_link_title anyway. The worker captures revision ${pending.revision}.`,
      { link, pending, phase: 'crawling' },
      null,
    );
  }
  editMetadata(title: string, source: PlaneSource = 'manual') {
    assertPlaneTitle(title);
    const current = this.state.document;
    const clean = title.trim();
    const link: PlaneIssueLink = {
      ...copy(current.link),
      metadata: {
        ...copy(current.link.metadata),
        title: clean,
        source: 'human',
      },
      revision: current.link.revision + 1,
    };
    return this.record(
      { type: 'edit_metadata', title: clean },
      source,
      'human',
      'edit',
      source === 'manual'
        ? 'Human saves explicit metadata'
        : 'Injected metadata edit',
      `The API accepts “${clean}” and returns success. Revision ${current.link.revision} → ${link.revision}.`,
      { ...copy(current), link, phase: current.pending ? 'crawling' : 'ready' },
      null,
    );
  }
  release(source: PlaneSource = 'manual') {
    const current = this.state.document;
    const pending = current.pending;
    if (!pending) throw new Error('No Plane metadata crawl is queued.');
    const expected = current.link.metadata.title;
    if (
      this.state.mode === 'guarded' &&
      pending.revision !== current.link.revision
    ) {
      const document: PlaneDocument = {
        ...copy(current),
        pending: null,
        phase: 'blocked',
      };
      const assertion: PlaneAssertion = {
        passed: true,
        completion: 'blocked',
        rule: PLANE_RULE,
        expectedMetadataTitle: expected,
        actualMetadataTitle: document.link.metadata.title,
        message:
          'The link changed after dispatch, so the compare-and-set rejected the stale crawl. Human metadata is intact.',
      };
      return this.record(
        { type: 'release' },
        source,
        'guard',
        'blocked',
        'Stale Plane worker write blocked',
        `Queued revision ${pending.revision} does not match live revision ${current.link.revision}. No row is updated.`,
        document,
        assertion,
      );
    }

    // Plane preview@da1a7ab: issue_link.metadata = meta_data; issue_link.save()
    const link: PlaneIssueLink = {
      ...copy(current.link),
      metadata: copy(pending.result),
      revision: current.link.revision + 1,
    };
    const passed = link.metadata.title === expected;
    const document: PlaneDocument = { link, pending: null, phase: 'applied' };
    const assertion: PlaneAssertion = {
      passed,
      completion: 'applied',
      rule: PLANE_RULE,
      expectedMetadataTitle: expected,
      actualMetadataTitle: link.metadata.title,
      message: passed
        ? 'The crawler completed without replacing newer metadata.'
        : `The delayed worker replaced “${expected}” with “${link.metadata.title}”.`,
    };
    return this.record(
      { type: 'release' },
      source,
      'worker',
      passed ? 'commit' : 'violation',
      passed ? 'Crawler metadata applied' : 'Explicit metadata overwritten',
      passed
        ? 'The worker result matches the current intent.'
        : 'work_item_link_task.py assigns the fetched object to metadata without checking the dispatch revision.',
      document,
      assertion,
    );
  }
  cancel(source: PlaneSource = 'manual') {
    const current = this.state.document;
    if (!current.pending) throw new Error('No Plane metadata crawl is queued.');
    return this.record(
      { type: 'cancel' },
      source,
      'system',
      'cancelled',
      'Queued Plane crawl cancelled',
      'The worker result is discarded without changing the issue link.',
      { ...copy(current), pending: null, phase: 'cancelled' },
      null,
    );
  }
  execute(command: PlaneCommand, source: PlaneSource = 'replay') {
    switch (command.type) {
      case 'observe':
        return this.observe(source);
      case 'start_crawl':
        return this.startCrawl(command.title, source);
      case 'edit_metadata':
        return this.editMetadata(command.title, source);
      case 'release':
        return this.release(source);
      case 'cancel':
        return this.cancel(source);
    }
  }
}

export function replayPlaneRecipe(recipe: readonly PlaneCommand[], mode: Mode) {
  const lab = new PlaneLab(mode);
  for (const command of recipe) lab.execute(command, 'replay');
  return lab.getSnapshot();
}

export function reducePlaneFailure(recipe: readonly PlaneCommand[]) {
  const fails = (candidate: PlaneCommand[]) => {
    try {
      return (
        replayPlaneRecipe(candidate, 'unguarded').assertion?.passed === false
      );
    } catch {
      return false;
    }
  };
  let reduced = copy([...recipe]);
  if (!fails(reduced))
    throw new Error('This recording contains no reproducible Plane violation.');
  let attempts = 1;
  for (let index = 0; index < reduced.length;) {
    const candidate = reduced.filter((_, item) => item !== index);
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
    original: replayPlaneRecipe(reduced, 'unguarded').assertion,
    guarded: replayPlaneRecipe(reduced, 'guarded').assertion,
  };
}
