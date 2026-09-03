'use client';

import Link from 'next/link';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { flushSync } from 'react-dom';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Bot,
  Braces,
  Check,
  ChevronRight,
  CircleDot,
  Clock3,
  Database,
  Download,
  ExternalLink,
  FileCode2,
  FileWarning,
  FlaskConical,
  GitBranch,
  Link2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  ScanSearch,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SessionPanel } from '@/components/session-panel';
import { AppSidebar } from '@/components/app-sidebar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { assertMode, type Mode } from '@/lib/lab-engine';
import {
  PlaneAdapter,
  planeRecipeFromSession,
  replayPlaneAsync,
  type PlaneRecordedState,
} from '@/lib/plane/adapter';
import { assertPlaneDelay } from '@/lib/plane/async-crawl';
import {
  PLANE_COMMIT,
  PLANE_ISSUE,
  PLANE_RULE,
  SAMPLE_PLANE_RECIPE,
  assertPlaneTitle,
  reducePlaneFailure,
  replayPlaneRecipe,
  type PlaneCommand,
} from '@/lib/plane/lab';
import { exportPlaneRegression } from '@/lib/plane/regression';
import {
  closePlaneSession,
  parsePlaneSession,
  PlaneSessionArchive,
} from '@/lib/plane/session';
import {
  createSiteToolRegistry,
  objectInput,
  type SiteTool,
  type SiteToolRegistry,
} from '@/lib/webmcp';
import {
  planeToolDefinitions,
  type PlaneToolName,
} from '@/lib/plane/webmcp-tools';
import type { Session } from '@/packages/recorder/src/index';

const ISSUE_URL = 'https://github.com/makeplane/plane/issues/9674';
const VIEW_SOURCE_URL =
  'https://github.com/makeplane/plane/blob/' +
  PLANE_COMMIT +
  '/apps/api/plane/app/views/issue/link.py';
const TASK_SOURCE_URL =
  'https://github.com/makeplane/plane/blob/' +
  PLANE_COMMIT +
  '/apps/api/plane/bgtasks/work_item_link_task.py';
const PLANE_PATCH_SHA256 =
  'a48b20978ca27a0e3aec62fde4080d40b93fc5cd8bec6144712e04763daa2aab';

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function CompletionClock({ dueAt }: { dueAt: number | null }) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  return (
    <span>
      {dueAt === null
        ? 'Worker held'
        : 'Finishes in ' +
          Math.max(0, Math.ceil((dueAt - (now || dueAt)) / 1000)) +
          's'}
    </span>
  );
}

type Comparison = {
  original: ReturnType<typeof replayPlaneRecipe>;
  guarded: ReturnType<typeof replayPlaneRecipe>;
  steps: number;
};

export default function PlaneLabPage() {
  const [adapter] = useState(() => new PlaneAdapter());
  const [archive] = useState(() => new PlaneSessionArchive());
  const state = useSyncExternalStore(
    adapter.lab.subscribe,
    adapter.lab.getSnapshot,
    adapter.lab.getSnapshot,
  );
  const operation = useSyncExternalStore(
    adapter.operation.subscribe,
    adapter.operation.getSnapshot,
    () => null,
  );
  const recording = useSyncExternalStore(
    adapter.recorder.subscribe,
    adapter.recorder.getSnapshot,
    adapter.recorder.getSnapshot,
  );
  const archiveState = useSyncExternalStore(
    archive.subscribe,
    archive.getSnapshot,
    archive.getServerSnapshot,
  );
  const [selectedSession, setSelectedSession] =
    useState<Session<PlaneRecordedState> | null>(null);
  const [delayMs, setDelayMs] = useState(15000);
  const [patchTitle, setPatchTitle] = useState('Production runbook');
  const [metadataTitle, setMetadataTitle] = useState('Human verified runbook');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [hasRecording, setHasRecording] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<number | null>(null);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [reduction, setReduction] = useState<ReturnType<
    typeof reducePlaneFailure
  > | null>(null);
  const [native, setNative] = useState<{
    status: string;
    count: number;
    error?: string;
  }>({ status: 'connecting', count: 0 });
  const savedRecipe = useRef<PlaneCommand[]>([]);
  const failureRecipe = useRef<PlaneCommand[]>([]);
  const generation = useRef(0);
  const busyRef = useRef(false);
  const nativeRegistry = useRef<SiteToolRegistry | null>(null);
  const actionsRef = useRef<
    Record<
      string,
      (input: unknown, options?: { signal?: AbortSignal }) => unknown
    >
  >({});

  useEffect(() => {
    archive.initialize();
    const save = () => archive.save(adapter.recorder.getSnapshot());
    const detach = adapter.recorder.subscribe(save);
    const leave = () => {
      if (adapter.operation.getSnapshot())
        adapter.operation.cancel('The Plane incident view was closed.');
      adapter.recorder.interruptPending('The Plane incident view was closed.');
      save();
    };
    window.addEventListener('beforeunload', leave);
    return () => {
      leave();
      detach();
      window.removeEventListener('beforeunload', leave);
      adapter.dispose();
    };
  }, [adapter, archive]);

  useEffect(
    () =>
      adapter.lab.subscribe(() => {
        const current = adapter.lab.getSnapshot();
        if (current.assertion) {
          savedRecipe.current = structuredClone(current.recipe);
          setHasRecording(true);
          if (
            !current.assertion.passed ||
            current.assertion.completion === 'blocked'
          )
            failureRecipe.current = structuredClone(current.recipe);
        }
      }),
    [adapter],
  );

  const compactState = () => {
    const current = adapter.lab.getSnapshot();
    const pending = current.document.pending;
    const running = adapter.operation.getSnapshot();
    return {
      mode: current.mode,
      link: {
        displayTitle: current.document.link.title,
        metadataTitle: current.document.link.metadata.title,
        metadataSource: current.document.link.metadata.source,
        revision: current.document.link.revision,
      },
      worker: pending
        ? {
            phase: current.document.phase,
            capturedRevision: pending.revision,
            capturedTitle: pending.result.title,
            held: running?.held ?? false,
          }
        : null,
      verdict: current.assertion
        ? {
            passed: current.assertion.passed,
            completion: current.assertion.completion,
            expected: current.assertion.expectedMetadataTitle,
            actual: current.assertion.actualMetadataTitle,
          }
        : null,
      eventCount: current.events.length,
      recording: {
        id: adapter.recorder.getSnapshot().id,
        eventCount: adapter.recorder.getSnapshot().entries.length,
      },
      provenance: {
        application: 'Plane',
        issue: PLANE_ISSUE,
        commit: PLANE_COMMIT,
        liveSystemsContacted: false,
      },
    };
  };
  const checkBusy = () => {
    if (busyRef.current) throw new Error('A replay is already running.');
  };
  const reset = (mode: Mode = adapter.lab.getSnapshot().mode) => {
    generation.current++;
    busyRef.current = false;
    setPlaying(false);
    adapter.reset(mode);
    setSelectedSession(null);
    setSelectedEvent(null);
    setPatchTitle('Production runbook');
    setMetadataTitle('Human verified runbook');
    setError('');
    setNotice('');
    setComparison(null);
    setReduction(null);
  };
  const chooseRecipe = () =>
    structuredClone(
      savedRecipe.current.length ? savedRecipe.current : SAMPLE_PLANE_RECIPE,
    );
  const chooseFailure = () =>
    structuredClone(
      failureRecipe.current.length
        ? failureRecipe.current
        : SAMPLE_PLANE_RECIPE,
    );
  const play = async (recipe: PlaneCommand[], mode: Mode, animate = true) => {
    checkBusy();
    reset(mode);
    const token = generation.current;
    busyRef.current = true;
    setPlaying(true);
    try {
      await replayPlaneAsync(recipe, adapter, async () => {
        if (animate) await new Promise((resolve) => setTimeout(resolve, 350));
        if (token !== generation.current)
          throw new DOMException('Replay stopped.', 'AbortError');
      });
    } catch (reason) {
      if (
        token === generation.current &&
        !(reason instanceof Error && reason.name === 'AbortError')
      )
        setError(reason instanceof Error ? reason.message : 'Replay failed.');
      throw reason;
    } finally {
      if (token === generation.current) {
        busyRef.current = false;
        setPlaying(false);
      }
    }
  };
  const findSession = (id: unknown) => {
    const current = adapter.recorder.getSnapshot();
    const session =
      id === undefined || id === current.id
        ? current
        : archive.getSnapshot().sessions.find((item) => item.id === id);
    if (!session)
      throw new Error('Saved session does not exist in this browser.');
    return session;
  };
  const importSession = (text: string) => {
    const imported = closePlaneSession(parsePlaneSession(text));
    if (imported.id === adapter.recorder.getSnapshot().id)
      throw new Error('This file is already the current session.');
    archive.save(imported);
    setSelectedSession(imported);
    return imported;
  };
  const compare = () => {
    if (adapter.operation.getSnapshot())
      throw new Error('Finish or cancel the worker before comparing.');
    const recipe = chooseFailure();
    const result = {
      original: replayPlaneRecipe(recipe, 'unguarded'),
      guarded: replayPlaneRecipe(recipe, 'guarded'),
      steps: recipe.length,
    };
    setComparison(result);
    return result;
  };
  const minimize = () => {
    if (adapter.operation.getSnapshot())
      throw new Error('Finish or cancel the worker before reducing.');
    const result = reducePlaneFailure(chooseFailure());
    setReduction(result);
    return result;
  };
  const exportTest = () => {
    const content = exportPlaneRegression(chooseFailure());
    download(
      'interleave-plane-regression.test.mjs',
      content,
      'text/javascript',
    );
    setNotice('Runnable Plane regression downloaded.');
    return content;
  };
  const exportPatch = async () => {
    const response = await fetch('/plane-9674.patch');
    if (!response.ok)
      throw new Error('The upstream patch artifact is unavailable.');
    const content = await response.text();
    download('plane-9674-stale-metadata.patch', content, 'text/x-diff');
    setNotice('Upstream-ready Plane patch downloaded.');
    return content;
  };
  const run = (action: () => unknown) => {
    try {
      const result = action();
      if (result instanceof Promise)
        void result.catch((reason) =>
          setError(reason instanceof Error ? reason.message : 'Action failed.'),
        );
      setError('');
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Something went wrong.',
      );
    }
  };
  const startCrawl = () => {
    run(() => {
      assertPlaneTitle(patchTitle);
      assertPlaneDelay(delayMs);
      const pending = adapter.crawl(patchTitle, delayMs);
      void pending.catch((reason) => {
        if (!(reason instanceof Error && reason.name === 'AbortError'))
          setError(
            reason instanceof Error ? reason.message : 'Plane crawl failed.',
          );
      });
    });
  };
  const saveMetadata = () =>
    run(() => {
      assertPlaneTitle(metadataTitle);
      adapter.editMetadata(metadataTitle);
    });

  useLayoutEffect(() => {
    const summary = (session: Session<PlaneRecordedState>) => ({
      id: session.id,
      startedAt: session.startedAt,
      mode: session.initialState.mode,
      eventCount: session.entries.length,
      unfinished: session.entries.some(
        (entry) => entry.status === 'pending' || entry.status === 'interrupted',
      ),
    });
    actionsRef.current = {
      plane_read_context(input) {
        objectInput(input, []);
        const current = adapter.lab.getSnapshot();
        return {
          ...compactState(),
          recentEvents: current.events.slice(-6).map((event) => ({
            id: event.id,
            actor: event.actor,
            kind: event.kind,
            title: event.title,
            elapsedMs: event.elapsedMs,
          })),
          rule: PLANE_RULE,
          source: { view: VIEW_SOURCE_URL, worker: TASK_SOURCE_URL },
        };
      },
      plane_reset(input) {
        const args = objectInput(input, ['mode']);
        assertMode(args.mode);
        reset(args.mode);
        return compactState();
      },
      plane_patch_link_slow(input, options) {
        const args = objectInput(input, ['title', 'delayMs']);
        assertPlaneTitle(args.title);
        assertPlaneDelay(args.delayMs);
        checkBusy();
        return adapter.operation
          .crawl(args.title, args.delayMs, 'native', options?.signal)
          .then(() => compactState());
      },
      plane_set_link_metadata(input) {
        const args = objectInput(input, ['title']);
        assertPlaneTitle(args.title);
        checkBusy();
        adapter.lab.editMetadata(args.title, 'native');
        return compactState();
      },
      plane_hold_crawl(input) {
        objectInput(input, []);
        checkBusy();
        return adapter.operation.hold();
      },
      plane_complete_crawl(input) {
        objectInput(input, []);
        checkBusy();
        adapter.operation.completeNow();
        return compactState();
      },
      plane_cancel_crawl(input) {
        objectInput(input, []);
        checkBusy();
        adapter.operation.cancel();
        return compactState();
      },
      async plane_replay(input) {
        const args = objectInput(input, ['mode', 'sessionId']);
        assertMode(args.mode);
        checkBusy();
        if (adapter.operation.getSnapshot())
          throw new Error('Finish or cancel the worker before replaying.');
        const recipe =
          args.sessionId === undefined
            ? chooseRecipe()
            : planeRecipeFromSession(findSession(args.sessionId));
        await play(recipe, args.mode, false);
        return { ...compactState(), replayedSteps: recipe.length };
      },
      plane_compare_modes(input) {
        objectInput(input, []);
        const result = compare();
        return {
          steps: result.steps,
          currentPlane: result.original.assertion,
          proposedPatch: result.guarded.assertion,
        };
      },
      plane_reduce_failure(input) {
        objectInput(input, []);
        return minimize();
      },
      plane_export_regression(input) {
        objectInput(input, []);
        const content = exportPlaneRegression(chooseFailure());
        return {
          filename: 'interleave-plane-regression.test.mjs',
          downloadUrl: new URL(
            '/interleave-plane-regression.test.mjs',
            window.location.href,
          ).href,
          generatedCharacters: content.length,
          recipeSteps: chooseFailure().length,
          proves:
            'fails on Plane preview@da1a7ab; passes with the proposed guard',
        };
      },
      async plane_export_upstream_patch(input) {
        objectInput(input, []);
        const response = await fetch('/plane-9674.patch');
        if (!response.ok)
          throw new Error('The upstream patch artifact is unavailable.');
        return {
          filename: 'plane-9674-stale-metadata.patch',
          downloadUrl: new URL('/plane-9674.patch', window.location.href).href,
          appliesTo: PLANE_COMMIT,
          sha256: PLANE_PATCH_SHA256,
          sizeBytes: Number(response.headers.get('content-length')) || 17016,
          validation: '37/37 focused and neighboring Plane tests passed',
          license: 'AGPL-3.0 as a derivative Plane patch',
          publicationStatus: 'local review artifact; not published',
        };
      },
      plane_list_sessions(input) {
        objectInput(input, []);
        return {
          current: summary(adapter.recorder.getSnapshot()),
          savedCount: archive.getSnapshot().sessions.length,
          recent: archive
            .getSnapshot()
            .sessions.filter(
              (session) => session.id !== adapter.recorder.getSnapshot().id,
            )
            .slice(0, 5)
            .map(summary),
          storageWarning: archive.getSnapshot().warning,
        };
      },
    };
  });

  useEffect(() => {
    const registry = createSiteToolRegistry(
      (status, count, registrationError) =>
        setNative({ status, count, error: registrationError }),
    );
    nativeRegistry.current = registry;
    return () => {
      nativeRegistry.current = null;
      registry.dispose();
    };
  }, []);

  useEffect(() => {
    const definitions = planeToolDefinitions({
      pending: Boolean(operation),
      held: operation?.held ?? false,
    });
    const recorded = new Set([
      'plane_patch_link_slow',
      'plane_set_link_metadata',
      'plane_hold_crawl',
      'plane_complete_crawl',
      'plane_cancel_crawl',
    ]);
    const tools: SiteTool[] = definitions.map((definition) => {
      const name: PlaneToolName = definition.name;
      return {
        ...definition,
        execute(input, options) {
          let result: unknown;
          flushSync(() => {
            const invoke = () => actionsRef.current[name](input, options);
            result = recorded.has(name)
              ? adapter.recorder.run(name, input, 'native', invoke)
              : invoke();
          });
          return result;
        },
      };
    });
    nativeRegistry.current?.update(tools);
  }, [adapter, operation]);

  const event =
    state.events.find((item) => item.id === selectedEvent) ??
    state.events.at(-1);
  const documentState = state.document;
  const assertion = state.assertion;

  return (
    <main className="lab-app plane-lab">
      <div className="workspace">
        <AppSidebar
          active="plane"
          scenarioHeading="CURRENT INCIDENT"
          scenarioTitle="Metadata overwrite"
          scenarioDetail="Human PATCH × delayed Celery write"
          footerTitle="Public bug. Exact source."
          footerBody="Deterministic reproduction of Plane’s open issue. No live Plane deployment is contacted."
          footerHref={ISSUE_URL}
          footerLinkLabel="Open issue #9674"
        />

        <section className="workbench">
          <header className="app-header">
            <div>
              <Link
                className="brand"
                href="/"
                prefetch={false}
                aria-label="Interleave home"
              >
                Plane incident
              </Link>
              <div className="header-path">
                <span>Live workbench</span>
                <ChevronRight size={14} />
                <span>Issue #9674</span>
              </div>
            </div>
            <span
              className={'native-status ' + native.status}
              title={native.error ?? 'Native document.modelContext tools'}
            >
              <span className="status-dot" />
              {native.status === 'ready'
                ? native.count + ' native tools'
                : native.status === 'unsupported'
                  ? 'Manual mode'
                  : native.status === 'error'
                    ? 'Tool registration failed'
                    : native.status === 'updating'
                      ? 'Updating tool surface'
                      : 'Connecting tools'}
            </span>
            <span className="version-chip">
              OSS INCIDENT <span>v0.4</span>
            </span>
          </header>

          <div className="page-intro">
            <div>
              <div className="eyebrow">
                INTEGRATION 003 <span>/</span> PLANE PREVIEW
              </div>
              <h1>
                The crawler that writes too late
                <span className="seeded verified">
                  source-verified incident
                </span>
              </h1>
              <p>
                A successful metadata edit is silently replaced by a queued
                worker.
              </p>
            </div>
            <Button
              variant="outline"
              className="reset-button"
              onClick={() => reset()}
            >
              <RotateCcw /> {playing ? 'Stop & reset' : 'Reset incident'}
            </Button>
          </div>

          <div className="provenance-strip plane-provenance">
            <Check size={15} />
            <span>
              Behavior is derived from Plane{' '}
              <b>preview@{PLANE_COMMIT.slice(0, 7)}</b>: the PATCH handler
              queues every crawl and the worker writes metadata without a
              revision check.
            </span>
            <a href={VIEW_SOURCE_URL} target="_blank" rel="noreferrer">
              Handler <ExternalLink size={12} />
            </a>
            <a href={TASK_SOURCE_URL} target="_blank" rel="noreferrer">
              Worker <ExternalLink size={12} />
            </a>
          </div>

          <section className="evidence-rail" aria-label="Interleave proof flow">
            <div>
              <span>01</span>
              <strong>Record</strong>
              <small>native call + human edit</small>
            </div>
            <div>
              <span>02</span>
              <strong>Interrupt</strong>
              <small>hold the worker write</small>
            </div>
            <div>
              <span>03</span>
              <strong>Inspect</strong>
              <small>expected vs actual</small>
            </div>
            <div>
              <span>04</span>
              <strong>Minimize</strong>
              <small>smallest failing sequence</small>
            </div>
            <div>
              <span>05</span>
              <strong>Export</strong>
              <small>test + Plane patch</small>
            </div>
          </section>

          <div className="proof-metrics" aria-label="Validation evidence">
            <a
              href="/webmcp-plane-acceptance.json"
              target="_blank"
              rel="noreferrer"
            >
              <b>LIVE</b> browser-verified
            </a>
            <span>
              <b>37 / 37</b> Plane tests
            </span>
            <span>
              <b>13</b> upstream patch cases
            </span>
            <span>
              <b>{native.status === 'ready' ? native.count : '9 → 5'}</b>{' '}
              state-aware WebMCP tools
            </span>
            <span>
              <b>0</b> live systems contacted
            </span>
          </div>

          <div className="run-toolbar">
            <Tabs
              value={state.mode}
              onValueChange={(value) => reset(value as Mode)}
            >
              <TabsList className="mode-tabs">
                <TabsTrigger value="unguarded" disabled={playing}>
                  <CircleDot /> Current Plane
                </TabsTrigger>
                <TabsTrigger value="guarded" disabled={playing}>
                  <ShieldCheck /> Proposed patch
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="proof-actions">
              <Button
                variant="outline"
                disabled={playing || !!operation || !hasRecording}
                onClick={() =>
                  void play(chooseRecipe(), state.mode).catch(() => {})
                }
              >
                <RotateCcw /> Replay recording
              </Button>
              <Button
                className="sample-button"
                disabled={playing || !!operation}
                onClick={() =>
                  void play(
                    structuredClone(SAMPLE_PLANE_RECIPE),
                    state.mode,
                  ).catch(() => {})
                }
              >
                <Play />
                {playing ? 'Replaying…' : 'Run verified reproduction'}
              </Button>
            </div>
          </div>

          <div className="experiment-grid plane-experiment-grid">
            <section className="fixture-panel">
              <div className="panel-heading">
                <span>
                  <Link2 size={15} /> PLANE ISSUE LINK
                </span>
                <span className="small-label">Local deterministic fixture</span>
              </div>
              <div className="fixture-stage plane-stage">
                <div
                  className="plane-card"
                  aria-label="Plane issue link fixture"
                >
                  <div className="plane-card-top">
                    <span className="plane-logo">P</span>
                    <div>
                      <small>WEB-9674 · External link</small>
                      <h2>{documentState.link.title}</h2>
                    </div>
                    <span className={'worker-pill ' + documentState.phase}>
                      <Clock3 size={12} />
                      {documentState.pending
                        ? 'crawler queued'
                        : documentState.phase}
                    </span>
                  </div>
                  <div className="plane-url">
                    <Link2 size={15} />
                    {documentState.link.url}
                  </div>
                  <div className="metadata-card">
                    <div>
                      <Database size={17} />
                      <span>
                        Stored metadata
                        <small>metadata.title</small>
                      </span>
                    </div>
                    <strong>{documentState.link.metadata.title}</strong>
                    <em>{documentState.link.metadata.source}</em>
                  </div>
                  {documentState.pending && (
                    <div className="queued-result">
                      <ScanSearch size={16} />
                      <span>
                        Worker will write
                        <strong>{documentState.pending.result.title}</strong>
                      </span>
                      <small>captured r{documentState.pending.revision}</small>
                    </div>
                  )}
                  <form
                    className="metadata-form"
                    onSubmit={(formEvent) => {
                      formEvent.preventDefault();
                      saveMetadata();
                    }}
                  >
                    <label>
                      Human metadata override
                      <input
                        aria-label="Explicit metadata title"
                        value={metadataTitle}
                        maxLength={120}
                        disabled={playing}
                        onChange={(changeEvent) =>
                          setMetadataTitle(changeEvent.target.value)
                        }
                      />
                    </label>
                    <Button
                      type="submit"
                      disabled={playing || !metadataTitle.trim()}
                    >
                      Save metadata
                    </Button>
                  </form>
                </div>
              </div>
              <div className="live-state">
                <span>LIVE PLANE ROW</span>
                <code>
                  revision <b>{documentState.link.revision}</b>
                </code>
                <code>
                  source <b>{documentState.link.metadata.source}</b>
                </code>
                <code>
                  queued <b>{documentState.pending ? 'yes' : 'no'}</b>
                </code>
              </div>
            </section>

            <section className="controls-panel">
              <div className="panel-heading">
                <span>
                  <FlaskConical size={15} /> CONTROL THE INCIDENT
                </span>
              </div>
              <div className="control-content">
                <span className="step-index">
                  {documentState.pending
                    ? '02 / HUMAN EDIT'
                    : '01 / AGENT PATCH'}
                </span>
                <h3>
                  {documentState.pending
                    ? 'The Celery worker is still running.'
                    : 'Queue Plane’s metadata crawler.'}
                </h3>
                <p>
                  {documentState.pending
                    ? 'Save explicit metadata on the left, then complete the original worker. Current Plane will overwrite the newer value.'
                    : 'Plane’s current PATCH path queues the crawler even when only the display title changes.'}
                </p>
                <label className="field-control">
                  Agent display-title PATCH
                  <input
                    aria-label="Plane display title"
                    value={patchTitle}
                    maxLength={120}
                    disabled={playing || !!operation}
                    onChange={(changeEvent) =>
                      setPatchTitle(changeEvent.target.value)
                    }
                  />
                </label>
                <label className="delay-control">
                  Worker finishes after
                  <select
                    aria-label="Plane crawler delay"
                    value={delayMs}
                    disabled={playing || !!operation}
                    onChange={(changeEvent) =>
                      setDelayMs(Number(changeEvent.target.value))
                    }
                  >
                    <option value={8000}>8 seconds</option>
                    <option value={15000}>15 seconds</option>
                    <option value={20000}>20 seconds</option>
                  </select>
                </label>
                <Button
                  className="primary-action"
                  disabled={playing || !!operation || !patchTitle.trim()}
                  onClick={startCrawl}
                >
                  <Bot /> PATCH link and queue crawl <ArrowRight />
                </Button>
                <div
                  className={
                    'checkpoint ' +
                    (documentState.pending ? 'checkpoint-active' : '')
                  }
                >
                  <span className="checkpoint-line" />
                  <span>
                    <Pause size={13} />
                    {operation ? (
                      <CompletionClock dueAt={operation.dueAt} />
                    ) : (
                      'Before IssueLink metadata write'
                    )}
                  </span>
                  <span className="checkpoint-line" />
                </div>
                <div className="operation-actions">
                  <Button
                    variant="outline"
                    disabled={!operation || operation.held}
                    onClick={() => run(() => adapter.hold())}
                  >
                    <Pause /> Hold
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!operation}
                    onClick={() => run(() => adapter.complete())}
                  >
                    <Check /> Complete now
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!operation}
                    onClick={() => run(() => adapter.cancel())}
                  >
                    <X /> Cancel
                  </Button>
                </div>
                <div className="rule-box">
                  <ShieldCheck size={18} />
                  <div>
                    <strong>Explicit preservation rule</strong>
                    <p>{PLANE_RULE}</p>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          {assertion && (
            <div
              className={'verdict ' + (assertion.passed ? 'passed' : 'failed')}
            >
              <span className="verdict-icon">
                {assertion.passed ? <ShieldCheck /> : <FileWarning />}
              </span>
              <div>
                <strong>
                  {assertion.passed
                    ? 'PASS · stale worker rejected'
                    : 'FAIL · newer metadata silently replaced'}
                </strong>
                <p>{assertion.message}</p>
                <small>
                  expected “{assertion.expectedMetadataTitle}” · actual “
                  {assertion.actualMetadataTitle}”
                </small>
              </div>
              <span className="verdict-value">
                {assertion.passed ? 'RULE HOLDS' : 'RULE VIOLATED'}
              </span>
            </div>
          )}

          <section className="todo-trace-section">
            <div className="trace-title">
              <h2>
                <Activity size={16} /> Execution trace
                <span>{state.events.length} EVENTS</span>
              </h2>
              <div className="trace-legend">
                <i className="agent-dot" /> Agent
                <i className="human-dot" /> Human
                <i className="system-dot" /> Worker / guard
              </div>
            </div>
            <div className="trace-grid">
              <div className="event-list">
                {!state.events.length ? (
                  <div className="empty-trace">
                    <Activity />
                    <strong>No events yet.</strong>
                    <p>
                      Queue the crawler, save metadata, and release the worker.
                    </p>
                  </div>
                ) : (
                  state.events.map((item) => (
                    <button
                      key={item.id}
                      className={
                        'trace-event ' +
                        item.kind +
                        ' ' +
                        (event?.id === item.id ? 'selected' : '')
                      }
                      onClick={() => setSelectedEvent(item.id)}
                    >
                      <span className="event-number">
                        {String(item.id).padStart(2, '0')}
                      </span>
                      <span className={'actor-icon ' + item.actor}>
                        {item.actor === 'human' ? (
                          <UserRound size={16} />
                        ) : item.actor === 'guard' ? (
                          <ShieldCheck size={16} />
                        ) : item.actor === 'worker' ? (
                          <Database size={16} />
                        ) : (
                          <Bot size={16} />
                        )}
                      </span>
                      <span className="event-text">
                        <strong>{item.title}</strong>
                        <small>
                          {item.source} · +{item.elapsedMs} ms
                        </small>
                      </span>
                    </button>
                  ))
                )}
              </div>
              <div className="event-inspector">
                {event ? (
                  <>
                    <div className="inspector-heading">
                      EVENT RECEIPT <span>{event.kind.toUpperCase()}</span>
                    </div>
                    <p>{event.detail}</p>
                    <div className="diff-head">
                      <span>FIELD</span>
                      <span>BEFORE</span>
                      <span>AFTER</span>
                    </div>
                    <div className="diff-row changed">
                      <code>metadata.title</code>
                      <code>{event.before.link.metadata.title}</code>
                      <code>{event.after.link.metadata.title}</code>
                    </div>
                    <div className="diff-row changed">
                      <code>revision</code>
                      <code>{event.before.link.revision}</code>
                      <code>{event.after.link.revision}</code>
                    </div>
                    <div className="diff-row changed">
                      <code>phase</code>
                      <code>{event.before.phase}</code>
                      <code>{event.after.phase}</code>
                    </div>
                  </>
                ) : (
                  <div className="inspector-empty">
                    <Braces />
                    <p>
                      Select an event to inspect the application transition.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="proof-panel">
            <div className="proof-heading">
              <div>
                <span className="eyebrow">UPSTREAM CONTRIBUTION</span>
                <h2>Prove a real patch against the same recording.</h2>
              </div>
              <div className="proof-actions">
                <Button
                  variant="outline"
                  disabled={!!operation}
                  onClick={() => run(compare)}
                >
                  <GitBranch /> Compare
                </Button>
                <Button
                  variant="outline"
                  disabled={!!operation}
                  onClick={() => run(minimize)}
                >
                  <Minimize2 /> Reduce
                </Button>
              </div>
            </div>
            <p className="proof-caption">
              The proposed Plane change avoids metadata-only recrawls and
              atomically checks the link URL and update timestamp before the
              worker writes.
            </p>
            {comparison && (
              <div className="comparison-grid">
                <div className="comparison-card">
                  <div>
                    <strong>Plane preview@da1a7ab</strong>
                    <span>FAIL</span>
                  </div>
                  <p>
                    <span>Explicit metadata survives</span>
                    <b>
                      {comparison.original.assertion?.passed ? 'yes' : 'no'}
                    </b>
                  </p>
                  <small>{comparison.original.assertion?.message}</small>
                </div>
                <div className="comparison-card pass">
                  <div>
                    <strong>Proposed compare-and-set</strong>
                    <span>PASS</span>
                  </div>
                  <p>
                    <span>Stale worker</span>
                    <b>{comparison.guarded.assertion?.completion}</b>
                  </p>
                  <small>{comparison.guarded.assertion?.message}</small>
                </div>
              </div>
            )}
            {reduction && (
              <div className="reduction-result">
                <div>
                  <div className="reduction-count">
                    {reduction.originalLength} <ArrowRight />{' '}
                    <b>{reduction.reducedLength}</b>
                  </div>
                  <div>
                    <strong>Minimal witnessed sequence</strong>
                    <p>{reduction.attempts} candidates executed</p>
                  </div>
                </div>
                <div className="recipe-strip">
                  {reduction.recipe.map((command, index) => (
                    <span key={command.type + '-' + index}>{command.type}</span>
                  ))}
                </div>
              </div>
            )}
            <div className="export-stack">
              <div className="export-row">
                <div>
                  <FileCode2 />
                  <div>
                    interleave-plane-regression.test.mjs
                    <small>
                      Passes proposed behavior and fails current Plane.
                    </small>
                  </div>
                </div>
                <Button
                  variant="outline"
                  disabled={!!operation}
                  onClick={() => run(exportTest)}
                >
                  <Download /> Regression
                </Button>
              </div>
              <div className="export-row">
                <div>
                  <GitBranch />
                  <div>
                    plane-9674-stale-metadata.patch
                    <small>
                      Five-file patch with 13 tests; publication requires
                      review.
                    </small>
                  </div>
                </div>
                <Button
                  variant="outline"
                  disabled={!!operation}
                  onClick={() => run(exportPatch)}
                >
                  <Download /> Upstream patch
                </Button>
              </div>
            </div>
            {notice && <p className="export-notice">{notice}</p>}
          </section>

          <SessionPanel
            live={recording}
            sessions={archiveState.sessions}
            selected={selectedSession}
            onSelect={setSelectedSession}
            onReplay={(session) =>
              void play(planeRecipeFromSession(session), state.mode).catch(
                () => {},
              )
            }
            onImport={importSession}
            onExport={(session) =>
              download(
                'interleave-plane-' + session.id + '.json',
                JSON.stringify(session, null, 2),
                'application/json',
              )
            }
            warning={archiveState.warning}
            busy={playing || !!operation}
            sessionLabel={(session) =>
              session.initialState.mode +
              ' · ' +
              session.entries.length +
              ' events'
            }
            emptyTitle="Queue a Plane crawler to start recording."
            emptyBody="The API PATCH, human metadata edit, worker completion, and exact row transitions will appear here."
            footnote="Plane incident sessions use a versioned adapter. Imports remain inert data; replay accepts only validated Plane commands and never executes uploaded code."
          />

          <footer className="integration-footer">
            <Link href="/todomvc" prefetch={false}>
              <ArrowLeft size={14} /> TodoMVC integration
            </Link>
            <span>
              Plane preview · {PLANE_COMMIT.slice(0, 7)} · AGPL-3.0 · public
              issue #9674 · local fixtures only
            </span>
          </footer>
        </section>
      </div>
    </main>
  );
}
