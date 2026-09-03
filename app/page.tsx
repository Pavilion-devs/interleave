'use client';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import Link from 'next/link';
import { flushSync } from 'react-dom';
import {
  Activity,
  ArrowRight,
  Bot,
  Braces,
  Check,
  ChevronRight,
  CircleDot,
  Download,
  FileCode2,
  FlaskConical,
  GitBranch,
  Layers,
  Minimize2,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  ShieldCheck,
  Ticket,
  UserRound,
  X,
  Workflow,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  SAMPLE_RECIPE,
  assertMode,
  assertQuantity,
  replayRecipe,
  reduceFailure,
  type Command,
  type Mode,
} from '@/lib/lab-engine';
import { objectInput, registerSiteTools, type SiteTool } from '@/lib/webmcp';
import {
  ReservationAdapter,
  replayAsyncRecipe,
  recipeFromSession,
  type RecordedState,
} from '@/lib/reservation-adapter';
import {
  SessionArchive,
  parseSession,
  closeInterruptedSession,
} from '@/lib/session-archive';
import { exportAsyncRegression } from '@/lib/async-regression';
import { SessionPanel } from '@/components/session-panel';
import type { Session } from '@/packages/recorder/src/index';

type Comparison = {
  baseline: ReturnType<typeof replayRecipe>;
  guarded: ReturnType<typeof replayRecipe>;
  steps: number;
};
function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function CompletionClock({
  dueAt,
  delayMs,
}: {
  dueAt: number | null;
  delayMs: number;
}) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  return (
    <span>
      {dueAt === null
        ? 'Completion held'
        : `Finishes in ${Math.max(0, Math.ceil((dueAt - (now || dueAt - delayMs)) / 1000))}s`}
    </span>
  );
}

export default function Home() {
  const [adapter] = useState(() => new ReservationAdapter());
  const lab = adapter.lab;
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
  const [archive] = useState(() => new SessionArchive());
  const archiveState = useSyncExternalStore(
    archive.subscribe,
    archive.getSnapshot,
    archive.getServerSnapshot,
  );
  const [selectedSession, setSelectedSession] =
    useState<Session<RecordedState> | null>(null);
  const [delayMs, setDelayMs] = useState(15000);
  const state = useSyncExternalStore(
    lab.subscribe,
    lab.getSnapshot,
    lab.getSnapshot,
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [native, setNative] = useState<{
    status: string;
    count: number;
    error?: string;
  }>({ status: 'connecting', count: 0 });
  const [reduction, setReduction] = useState<ReturnType<
    typeof reduceFailure
  > | null>(null);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [notice, setNotice] = useState('');
  const [hasRecording, setHasRecording] = useState(false);
  const savedRecipe = useRef<Command[]>([]);
  const failureRecipe = useRef<Command[]>([]);
  const generation = useRef(0);
  const selectedRef = useRef<number | null>(null);
  const busyRef = useRef(false);
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
        adapter.operation.cancel('The document was closed.');
      adapter.recorder.interruptPending('The document was closed.');
      save();
    };
    window.addEventListener('beforeunload', leave);
    return () => {
      leave();
      detach();
      window.removeEventListener('beforeunload', leave);
    };
  }, [adapter, archive]);
  useLayoutEffect(() => {
    selectedRef.current = selected;
  }, [selected]);
  useEffect(
    () =>
      lab.subscribe(() => {
        const s = lab.getSnapshot();
        if (s.assertion) {
          savedRecipe.current = structuredClone(s.recipe);
          setHasRecording(true);
          if (!s.assertion.passed || s.assertion.completion === 'blocked')
            failureRecipe.current = structuredClone(s.recipe);
        }
      }),
    [lab],
  );
  const chooseRecipe = () =>
    structuredClone(
      savedRecipe.current.length ? savedRecipe.current : SAMPLE_RECIPE,
    );
  const chooseFailureRecipe = () =>
    structuredClone(
      failureRecipe.current.length ? failureRecipe.current : SAMPLE_RECIPE,
    );
  const checkBusy = () => {
    if (busyRef.current)
      throw new Error('A replay is in progress. Wait for it to finish.');
  };
  const reset = (mode: Mode = lab.getSnapshot().mode) => {
    generation.current++;
    busyRef.current = false;
    setPlaying(false);
    adapter.reset(mode);
    setSelectedSession(null);
    setSelected(null);
    selectedRef.current = null;
    setError('');
    setNotice('');
    setComparison(null);
    setReduction(null);
  };
  const playSequence = async (
    recipe: Command[],
    mode: Mode,
    animate = true,
  ) => {
    checkBusy();
    reset(mode);
    const token = generation.current;
    busyRef.current = true;
    setPlaying(true);
    try {
      await replayAsyncRecipe(recipe, adapter, async () => {
        if (animate) await new Promise((resolve) => setTimeout(resolve, 350));
        if (token !== generation.current)
          throw new DOMException('Replay stopped.', 'AbortError');
      });
    } catch (e) {
      if (
        token === generation.current &&
        !(e instanceof Error && e.name === 'AbortError')
      )
        setError(e instanceof Error ? e.message : 'Replay failed.');
      throw e;
    } finally {
      if (token === generation.current) {
        busyRef.current = false;
        setPlaying(false);
      }
    }
  };
  const compare = () => {
    if (adapter.operation.getSnapshot())
      throw new Error(
        'Finish or cancel the pending operation before comparing recordings.',
      );
    const recipe = chooseFailureRecipe();
    const result = {
      baseline: replayRecipe(recipe, 'unguarded'),
      guarded: replayRecipe(recipe, 'guarded'),
      steps: recipe.length,
    };
    setComparison(result);
    return result;
  };
  const minimize = () => {
    if (adapter.operation.getSnapshot())
      throw new Error(
        'Finish or cancel the pending operation before reducing it.',
      );
    const result = reduceFailure(chooseFailureRecipe());
    setReduction(result);
    return result;
  };
  const compactState = () => {
    const current = lab.getSnapshot();
    return {
      mode: current.mode,
      reservation: current.reservation,
      assertion: current.assertion,
      eventCount: current.events.length,
      operation: adapter.operation.getSnapshot(),
      recording: {
        id: adapter.recorder.getSnapshot().id,
        eventCount: adapter.recorder.getSnapshot().entries.length,
      },
      source: 'disposable_browser_fixture',
    };
  };
  const recipeName = 'interleave-async-regression.test.mjs';
  const findSession = (id: unknown) => {
    const current = adapter.recorder.getSnapshot();
    const match =
      id === undefined || id === current.id
        ? current
        : archive.getSnapshot().sessions.find((item) => item.id === id);
    if (!match)
      throw new Error('Saved session does not exist in this browser.');
    return match;
  };
  const importSession = (text: string) => {
    const imported = closeInterruptedSession(parseSession(text));
    if (imported.id === adapter.recorder.getSnapshot().id)
      throw new Error(
        'This file is the current session. Start a new run before importing it.',
      );
    archive.save(imported);
    setSelectedSession(imported);
    return imported;
  };
  const sessionSummary = (session: Session<RecordedState>) => ({
    id: session.id,
    startedAt: session.startedAt,
    mode: session.initialState.mode,
    eventCount: session.entries.length,
    pending: session.entries.some(
      (entry) => entry.status === 'pending' || entry.status === 'interrupted',
    ),
  });
  useLayoutEffect(() => {
    actionsRef.current = {
      lab_read_context(input) {
        objectInput(input, []);
        const current = lab.getSnapshot();
        return {
          ...compactState(),
          replaying: busyRef.current,
          selectedEvent:
            current.events.find((e) => e.id === selectedRef.current) ??
            current.events.at(-1) ??
            null,
          events: current.events,
        };
      },
      lab_reset(input) {
        const args = objectInput(input, ['mode']);
        assertMode(args.mode);
        reset(args.mode);
        return compactState();
      },
      reservation_capture(input) {
        objectInput(input, []);
        checkBusy();
        lab.begin('native');
        return compactState();
      },
      lab_inject_human_edit(input) {
        const args = objectInput(input, ['quantity']);
        assertQuantity(args.quantity);
        checkBusy();
        lab.edit(args.quantity, 'native');
        return compactState();
      },
      reservation_release(input) {
        objectInput(input, []);
        checkBusy();
        if (adapter.operation.getSnapshot()) adapter.operation.completeNow();
        else lab.release('native');
        return compactState();
      },
      reservation_reserve(input, options) {
        const args = objectInput(input, ['delayMs']);
        checkBusy();
        return adapter.operation
          .reserve(args.delayMs as number, 'native', options?.signal)
          .then(() => compactState());
      },
      reservation_cancel(input) {
        objectInput(input, []);
        checkBusy();
        if (adapter.operation.getSnapshot()) adapter.operation.cancel();
        else lab.cancel('native');
        return compactState();
      },
      lab_hold_response(input) {
        objectInput(input, []);
        checkBusy();
        adapter.operation.hold();
        return compactState();
      },
      lab_select_event(input) {
        const args = objectInput(input, ['eventId']);
        const target = lab
          .getSnapshot()
          .events.find((e) => e.id === args.eventId);
        if (!target) throw new Error('Event does not exist in this run.');
        setSelected(target.id);
        selectedRef.current = target.id;
        return target;
      },
      async lab_replay(input) {
        const args = objectInput(input, ['mode', 'sessionId']);
        assertMode(args.mode);
        checkBusy();
        if (adapter.operation.getSnapshot())
          throw new Error(
            'Finish or cancel the pending operation before replaying.',
          );
        const recipe =
          args.sessionId === undefined
            ? chooseRecipe()
            : recipeFromSession(findSession(args.sessionId));
        await playSequence(recipe, args.mode, false);
        return { ...compactState(), replayedSteps: recipe.length };
      },
      lab_compare_modes(input) {
        objectInput(input, []);
        checkBusy();
        const result = compare();
        return {
          steps: result.steps,
          baseline: result.baseline.assertion,
          guarded: result.guarded.assertion,
        };
      },
      lab_reduce_failure(input) {
        objectInput(input, []);
        checkBusy();
        return minimize();
      },
      lab_export_regression(input) {
        objectInput(input, []);
        checkBusy();
        if (adapter.operation.getSnapshot())
          throw new Error(
            'Finish or cancel the pending operation before exporting a test.',
          );
        return {
          filename: recipeName,
          content: exportAsyncRegression(chooseFailureRecipe()),
          instructions:
            'Save under tests/ and run node --test tests/interleave-async-regression.test.mjs. It checks intent preservation and completed recovery through the asynchronous adapter. Set INTERLEAVE_IMPLEMENTATION=unguarded to witness a failing test. Requires this project and Node 22.13+.',
        };
      },
      lab_list_sessions(input) {
        objectInput(input, []);
        return {
          current: sessionSummary(adapter.recorder.getSnapshot()),
          saved: archive
            .getSnapshot()
            .sessions.filter(
              (session) => session.id !== adapter.recorder.getSnapshot().id,
            )
            .map(sessionSummary),
          storageWarning: archive.getSnapshot().warning,
        };
      },
      lab_open_session(input) {
        const args = objectInput(input, ['sessionId']);
        if (typeof args.sessionId !== 'string')
          throw new Error('A sessionId is required.');
        const session = findSession(args.sessionId);
        setSelectedSession(
          session.id === adapter.recorder.getSnapshot().id ? null : session,
        );
        return sessionSummary(session);
      },
      lab_export_session(input) {
        const args = objectInput(input, ['sessionId']);
        const session = findSession(args.sessionId);
        return {
          filename: `interleave-session-${session.id}.json`,
          json: JSON.stringify(session, null, 2),
        };
      },
      lab_import_session(input) {
        const args = objectInput(input, ['json']);
        checkBusy();
        if (adapter.operation.getSnapshot())
          throw new Error(
            'Finish or cancel the pending operation before importing.',
          );
        if (typeof args.json !== 'string')
          throw new Error('Session JSON must be a string.');
        return sessionSummary(importSession(args.json));
      },
    };
  });
  useEffect(() => {
    const schema = (properties: object = {}, required: string[] = []) => ({
      type: 'object',
      properties,
      required,
      additionalProperties: false,
    });
    const modes = { type: 'string', enum: ['unguarded', 'guarded'] };
    const definitions: Array<[string, string, object, boolean]> = [
      [
        'lab_read_context',
        'Read the live lab state, timeline, and selected event without changing anything. All data belongs to the disposable reservation test fixture.',
        schema(),
        true,
      ],
      [
        'lab_reset',
        'Reset only this disposable test run, clearing its timeline and reservation. Choose unguarded or guarded behavior. This never books real tickets.',
        schema({ mode: modes }, ['mode']),
        false,
      ],
      [
        'reservation_capture',
        'Capture the current sample ticket selection and its revision, leaving a pending write at a checkpoint. Call reservation_release to finish. This only changes the in-memory fixture.',
        schema(),
        false,
      ],
      [
        'reservation_reserve',
        'Reserve the current sample ticket selection after a controlled delay. This single call remains pending while the human can edit the visible ticket count. Returns only after committing or rejecting a stale write. Native delay is limited to 20 seconds to stay inside browser tool-call transport limits. The delay models application work; no network booking or payment happens.',
        schema({ delayMs: { type: 'integer', minimum: 500, maximum: 20000 } }, [
          'delayMs',
        ]),
        false,
      ],
      [
        'reservation_cancel',
        'Cancel the pending sandbox reservation without committing its captured selection. A pending reservation_reserve call will reject with AbortError. The current human selection is preserved.',
        schema(),
        false,
      ],
      [
        'lab_hold_response',
        'Hold completion of a running asynchronous reservation at its current checkpoint. The original reservation_reserve call stays pending until reservation_release or reservation_cancel. Only changes this test fixture.',
        schema(),
        false,
      ],
      [
        'lab_inject_human_edit',
        'Simulate a human changing the sample ticket quantity during an experiment. Records this as an injected action, not a real human interaction. Only the disposable fixture changes.',
        schema({ quantity: { type: 'integer', minimum: 1, maximum: 4 } }, [
          'quantity',
        ]),
        false,
      ],
      [
        'reservation_release',
        'Release the pending write in the disposable reservation fixture. Unguarded mode can demonstrate the seeded stale-write bug. Guarded mode rejects stale input. No real booking or payment occurs.',
        schema(),
        false,
      ],
      [
        'lab_select_event',
        'Select an existing trace event in the visible state inspector.',
        schema({ eventId: { type: 'integer', minimum: 1 } }, ['eventId']),
        false,
      ],
      [
        'lab_replay',
        'Reset this disposable fixture and replay the last completed recorded sequence under the selected implementation. Uses the included sample when there is no recording. Replayed actions are labeled scripted, not live agent actions.',
        schema({ mode: modes, sessionId: { type: 'string' } }, ['mode']),
        false,
      ],
      [
        'lab_compare_modes',
        'Replay the last recorded sequence (or sample) on two isolated fixtures, and show actual original and guarded outcomes in the comparison panel. Leaves the current trace intact.',
        schema(),
        false,
      ],
      [
        'lab_reduce_failure',
        'Reduce the recorded failing sequence (or sample), rerunning candidates and retaining a witnessed stale-write violation. Show the reduced recipe and verification outcomes.',
        schema(),
        false,
      ],
      [
        'lab_export_regression',
        'Return runnable regression test source for the recorded failing sequence (or sample). Does not download, execute, or transmit files. Tests import the lab engine from this project.',
        schema(),
        true,
      ],
      [
        'lab_list_sessions',
        'Read metadata for the current recording and sessions saved locally in this browser. Does not change the application or transmit recordings.',
        schema(),
        true,
      ],
      [
        'lab_open_session',
        'Open a saved session in the visible receipt inspector. Does not restore application state or execute recorded actions.',
        schema({ sessionId: { type: 'string' } }, ['sessionId']),
        false,
      ],
      [
        'lab_export_session',
        'Return session JSON for the current or named recording without downloading or executing files.',
        schema({ sessionId: { type: 'string' } }),
        true,
      ],
      [
        'lab_import_session',
        'Validate and import reservation-v2 session JSON into this browser archive, and open it for inspection. This stores data locally but never executes the imported recording. Use lab_replay with its sessionId to explicitly replay supported actions.',
        schema({ json: { type: 'string', maxLength: 1500000 } }, ['json']),
        false,
      ],
    ];
    const tools: SiteTool[] = definitions.map(
      ([name, description, inputSchema, readOnlyHint]) => ({
        name,
        description,
        inputSchema,
        annotations: { readOnlyHint },
        execute(input, options) {
          let result: unknown;
          flushSync(() => {
            const invoke = () => actionsRef.current[name](input, options);
            result = [
              'reservation_capture',
              'reservation_reserve',
              'reservation_release',
              'reservation_cancel',
              'lab_hold_response',
              'lab_inject_human_edit',
            ].includes(name)
              ? adapter.recorder.run(name, input, 'native', invoke)
              : invoke();
          });
          return result;
        },
      }),
    );
    return registerSiteTools(tools, (status, count, registrationError) =>
      setNative({ status, count, error: registrationError }),
    );
  }, [adapter]);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const event =
    state.events.find((e) => e.id === selected) ?? state.events.at(-1);
  const run = (action: () => unknown) => {
    try {
      action();
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
  };
  const reservation = state.reservation;
  const assertion = state.assertion;
  return (
    <main className="lab-app">
      <header className="app-header">
        <Link
          className="brand"
          href="/"
          prefetch={false}
          aria-label="Interleave home"
        >
          <span className="brand-mark">
            <GitBranch size={21} />
          </span>
          interleave<span className="brand-suffix">/ lab</span>
        </Link>
        <div className="header-path">
          <span>Workspace</span>
          <ChevronRight size={14} />
          <span>Reservation race</span>
        </div>
        <span
          className={`native-status ${native.status}`}
          title={
            native.error ??
            (native.status === 'unsupported'
              ? 'Open in a WebMCP-capable browser to use the native tools. Manual controls remain available.'
              : 'Native document.modelContext tools')
          }
        >
          <span className="status-dot" />
          {native.status === 'ready'
            ? `${native.count} native tools`
            : native.status === 'unsupported'
              ? 'Manual mode'
              : native.status === 'error'
                ? 'Tool registration failed'
                : 'Connecting tools'}
        </span>
        <span className="version-chip">
          EXPERIMENTAL <span>v0.3</span>
        </span>
      </header>
      <div className="workspace">
        <aside className="sidebar">
          <div className="sidebar-heading">WORKBENCH</div>
          <div className="nav-active">
            <FlaskConical size={17} />
            Reservation fixture<span>01</span>
          </div>
          <Link className="nav-link" href="/todomvc" prefetch={false}>
            <Layers size={17} />
            TodoMVC integration<span>02</span>
          </Link>
          <div className="sidebar-heading scenario-heading">
            CURRENT SCENARIO
          </div>
          <div className="scenario-nav">
            <span className="scenario-dot" />
            <div>
              Reservation race<small>Human edit × agent write</small>
            </div>
          </div>
          <div className="sidebar-bottom">
            <div className="tiny-symbol">
              <Braces size={17} />
            </div>
            <strong>One page. Two actors.</strong>
            <p>Watch what happens between a read and a write.</p>
            <div className="local-indicator">
              <span />
              Local test fixture
            </div>
          </div>
        </aside>
        <section className="workbench">
          <div className="page-intro">
            <div>
              <div className="eyebrow">
                EXPERIMENT 001 <span>/</span> CONCURRENCY
              </div>
              <h1>
                Reservation race<span className="seeded">Seeded defect</span>
              </h1>
              <p>A human changes their mind. The agent is still working.</p>
            </div>
            <Button
              variant="outline"
              className="reset-button"
              onClick={() => reset()}
            >
              <RotateCcw />
              {playing ? 'Stop & reset' : 'Reset run'}
            </Button>
          </div>
          <div className="run-toolbar">
            <Tabs value={state.mode} onValueChange={(v) => reset(v as Mode)}>
              <TabsList className="mode-tabs">
                <TabsTrigger value="unguarded" disabled={playing}>
                  <CircleDot />
                  Original
                </TabsTrigger>
                <TabsTrigger value="guarded" disabled={playing}>
                  <ShieldCheck />
                  With version guard
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="proof-actions">
              <Button
                variant="outline"
                disabled={playing || !!operation || !hasRecording}
                onClick={() =>
                  void playSequence(chooseRecipe(), state.mode).catch(() => {})
                }
              >
                <RotateCcw />
                Replay recording
              </Button>
              <Button
                className="sample-button"
                disabled={playing || !!operation}
                onClick={() =>
                  void playSequence(
                    structuredClone(SAMPLE_RECIPE),
                    state.mode,
                  ).catch(() => {})
                }
              >
                <Play />
                {playing ? 'Replaying…' : 'Run sample'}
              </Button>
            </div>
          </div>
          <div className="experiment-grid">
            <section className="fixture-panel">
              <div className="panel-heading">
                <span>
                  <Layers size={15} />
                  APPLICATION UNDER TEST
                </span>
                <span className="small-label">In-memory sandbox</span>
              </div>
              <div className="fixture-stage">
                <div className="ticket-app">
                  <div className="ticket-top">
                    <span>
                      <Ticket size={17} />
                      open seat
                    </span>
                    <span>RESERVATIONS</span>
                  </div>
                  <div className="event-info">
                    <span className="event-kicker">THURSDAY SESSIONS</span>
                    <h2>
                      After hours.
                      <br />
                      Before the rush.
                    </h2>
                    <p>Studio 04 · Lagos</p>
                    <span className="event-date">
                      OCT 08<span>19:00 — 22:00</span>
                    </span>
                  </div>
                  <div className="ticket-booking">
                    <div className="quantity-label">
                      <div>
                        <strong>General admission</strong>
                        <span>₦8,500 / person</span>
                      </div>
                      <div className="stepper">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Remove one ticket"
                          disabled={playing || reservation.quantity <= 1}
                          onClick={() =>
                            run(() => adapter.edit(reservation.quantity - 1))
                          }
                        >
                          <Minus size={14} />
                        </Button>
                        <output aria-label="Selected tickets">
                          {reservation.quantity}
                        </output>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Add one ticket"
                          disabled={playing || reservation.quantity >= 4}
                          onClick={() =>
                            run(() => adapter.edit(reservation.quantity + 1))
                          }
                        >
                          <Plus size={14} />
                        </Button>
                      </div>
                    </div>
                    <div className="ticket-total">
                      <span>Total</span>
                      <strong>
                        ₦{(reservation.quantity * 8500).toLocaleString('en-NG')}
                      </strong>
                    </div>
                    <div className={`booking-status ${reservation.phase}`}>
                      {reservation.phase === 'committed' ? (
                        <>
                          <Check size={16} />
                          {reservation.confirmed} tickets reserved in sandbox
                        </>
                      ) : reservation.phase === 'blocked' ? (
                        <>
                          <ShieldCheck size={16} />
                          Selection protected · refresh required
                        </>
                      ) : reservation.phase === 'cancelled' ? (
                        <>Cancelled · nothing committed</>
                      ) : operation ? (
                        <>
                          <Activity size={16} />
                          Working · your selection is still editable
                        </>
                      ) : (
                        <>
                          <CircleDot size={16} />
                          Your selection is ready
                        </>
                      )}
                    </div>
                    <small>No payment. Disposable sample data.</small>
                  </div>
                </div>
              </div>
              <div className="live-state">
                <span>LIVE STATE</span>
                <code>
                  quantity <b>{reservation.quantity}</b>
                </code>
                <code>
                  revision <b>{reservation.revision}</b>
                </code>
                <code>
                  captured <b>{reservation.pending?.quantity ?? '—'}</b>
                </code>
              </div>
            </section>
            <section className="controls-panel">
              <div className="panel-heading">
                <span>
                  <FlaskConical size={15} />
                  CONTROL THE EXPERIMENT
                </span>
              </div>
              <div className="control-content">
                <span className="step-index">
                  {reservation.pending
                    ? '02 / INTERVENE'
                    : reservation.phase === 'blocked'
                      ? '03 / RECOVER'
                      : '01 / CAPTURE'}
                </span>
                <h3>
                  {reservation.pending
                    ? 'Change selection while it runs.'
                    : reservation.phase === 'blocked'
                      ? 'Read again. Finish safely.'
                      : 'Start a delayed reservation.'}
                </h3>
                <p>
                  {reservation.pending
                    ? operation
                      ? 'The call is still running. Change the ticket count before it finishes, or hold completion to inspect it.'
                      : 'Use the − or + control in the ticket app. Then release the captured write.'
                    : reservation.phase === 'blocked'
                      ? 'The old write was refused. Retry to read the current selection and complete the reservation.'
                      : 'One call starts, waits, and completes. Change the tickets during the wait to expose the stale write.'}
                </p>
                <label className="delay-control">
                  Finish after
                  <select
                    aria-label="Completion delay"
                    value={delayMs}
                    disabled={playing || !!reservation.pending}
                    onChange={(event) => setDelayMs(Number(event.target.value))}
                  >
                    <option value={8000}>8 seconds</option>
                    <option value={15000}>15 seconds</option>
                    <option value={30000}>30 seconds</option>
                  </select>
                </label>
                <Button
                  className="primary-action"
                  disabled={playing || !!reservation.pending}
                  onClick={() => {
                    setError('');
                    void adapter.reserve(delayMs).catch((error) => {
                      if (
                        !(error instanceof Error && error.name === 'AbortError')
                      )
                        setError(
                          error instanceof Error
                            ? error.message
                            : 'Reservation failed.',
                        );
                    });
                  }}
                >
                  <Bot />
                  {reservation.phase === 'blocked'
                    ? 'Retry current selection'
                    : 'Start reservation'}
                  <ArrowRight />
                </Button>
                <div
                  className={`checkpoint ${reservation.pending ? 'checkpoint-active' : ''}`}
                >
                  <span className="checkpoint-line" />
                  <span>
                    <Pause size={13} />
                    {operation ? (
                      <CompletionClock
                        dueAt={operation.dueAt}
                        delayMs={operation.delayMs}
                      />
                    ) : reservation.pending ? (
                      `Holding revision ${reservation.pending.revision}`
                    ) : (
                      'Before commit'
                    )}
                  </span>
                  <span className="checkpoint-line" />
                </div>
                <Button
                  variant="outline"
                  className="release-button"
                  disabled={playing || !reservation.pending}
                  onClick={() => run(() => adapter.release())}
                >
                  <Play />
                  {operation ? 'Complete now' : 'Release pending write'}
                </Button>
                <div className="operation-actions">
                  <Button
                    variant="outline"
                    disabled={playing || !operation || operation.held}
                    onClick={() => run(() => adapter.hold())}
                  >
                    <Pause />
                    Hold completion
                  </Button>
                  <Button
                    variant="outline"
                    disabled={playing || !reservation.pending}
                    onClick={() => run(() => adapter.cancel())}
                  >
                    <X />
                    Cancel operation
                  </Button>
                </div>
                <p className="operation-note">
                  The delay models application work locally. No network booking
                  is made. Native agent calls and manual launches are labeled in
                  the recorder.
                </p>
                <details className="legacy-controls">
                  <summary>Step-by-step capture controls</summary>
                  <Button
                    variant="outline"
                    disabled={playing || !!reservation.pending}
                    onClick={() => run(() => adapter.capture())}
                  >
                    <Bot />
                    Capture selection
                  </Button>
                  <p>
                    Capture returns immediately. Use the release control above
                    to commit this staged write.
                  </p>
                </details>
                <div className="rule-box">
                  <ShieldCheck size={17} />
                  <div>
                    <strong>The invariant</strong>
                    <p>
                      A stale agent write must preserve the newer human
                      selection.
                    </p>
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
          <section
            className={`verdict ${assertion ? (assertion.passed ? 'passed' : 'failed') : ''}`}
            aria-live="polite"
          >
            <span className="verdict-icon">
              {assertion ? (
                assertion.passed ? (
                  <ShieldCheck />
                ) : (
                  <X />
                )
              ) : (
                <Activity />
              )}
            </span>
            <div>
              <strong>
                {assertion
                  ? assertion.passed
                    ? 'Human intent preserved'
                    : 'Human intent overwritten'
                  : 'Waiting for the first write'}
              </strong>
              <p>
                {assertion?.message ??
                  'Capture → change ticket count → release. The outcome is checked against actual state.'}
              </p>
            </div>
            {assertion && (
              <span className="verdict-value">
                {assertion.passed ? 'PASS' : 'FAIL'}
              </span>
            )}
          </section>
          <section className="trace-section">
            <div className="trace-title">
              <h2>
                <Activity size={18} />
                Execution trace
                <span>
                  {String(state.events.length).padStart(2, '0')} EVENTS
                </span>
              </h2>
              <Button
                variant="ghost"
                className="trace-download"
                disabled={!state.events.length || playing}
                onClick={() =>
                  download(
                    'interleave-trace.json',
                    JSON.stringify(
                      {
                        format: 'interleave.fixture-trace.v1',
                        fixtureVersion: 1,
                        environment: {
                          browser: navigator.userAgent,
                          nativeWebMCP: native.status === 'ready',
                        },
                        ...state,
                      },
                      null,
                      2,
                    ),
                    'application/json',
                  )
                }
              >
                <Download />
                Trace JSON
              </Button>
            </div>
            <div className="trace-grid">
              <div className="event-list">
                {state.events.length === 0 ? (
                  <div className="empty-trace">
                    <GitBranch size={26} />
                    <strong>Your next action starts the trace.</strong>
                    <p>Use manual controls or run the labeled sample replay.</p>
                  </div>
                ) : (
                  state.events.map((e) => (
                    <button
                      key={e.id}
                      className={`trace-event ${e.kind} ${event?.id === e.id ? 'selected' : ''}`}
                      onClick={() => setSelected(e.id)}
                      aria-pressed={event?.id === e.id}
                    >
                      <span className="event-number">
                        {String(e.id).padStart(2, '0')}
                      </span>
                      <span className={`actor-icon ${e.actor}`}>
                        {e.actor === 'human' ? (
                          <UserRound size={16} />
                        ) : e.actor === 'agent' ? (
                          <Bot size={16} />
                        ) : e.actor === 'guard' ? (
                          <ShieldCheck size={16} />
                        ) : (
                          <Braces size={16} />
                        )}
                      </span>
                      <span className="event-text">
                        <strong>{e.title}</strong>
                        <small>
                          {e.source === 'native'
                            ? 'Native WebMCP'
                            : e.source === 'replay'
                              ? 'Scripted replay'
                              : 'Manual control'}{' '}
                          · +{e.elapsedMs} ms
                        </small>
                      </span>
                      <ChevronRight size={14} />
                    </button>
                  ))
                )}
              </div>
              <div className="event-inspector">
                <div className="inspector-heading">
                  STATE INSPECTOR
                  <span>
                    {event
                      ? `EVENT ${String(event.id).padStart(2, '0')}`
                      : 'NO EVENT'}
                  </span>
                </div>
                {event ? (
                  <>
                    <p>{event.detail}</p>
                    <div className="diff-head">
                      <span>FIELD</span>
                      <span>BEFORE</span>
                      <span>AFTER</span>
                    </div>
                    {(
                      [
                        'quantity',
                        'revision',
                        'humanIntent',
                        'confirmed',
                      ] as const
                    ).map((k) => (
                      <div
                        className={`diff-row ${event.before[k] !== event.after[k] ? 'changed' : ''}`}
                        key={k}
                      >
                        <code>{k}</code>
                        <code>{event.before[k] ?? 'null'}</code>
                        <code>{event.after[k] ?? 'null'}</code>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="inspector-empty">
                    <Braces size={24} />
                    <p>Select an event to inspect its state changes.</p>
                  </div>
                )}
              </div>
            </div>
          </section>
          <SessionPanel
            live={recording}
            sessions={archiveState.sessions}
            selected={selectedSession}
            onSelect={setSelectedSession}
            warning={archiveState.warning}
            busy={playing || !!operation}
            onImport={importSession}
            onExport={(session) =>
              download(
                `interleave-session-${session.id}.json`,
                JSON.stringify(session, null, 2),
                'application/json',
              )
            }
            onReplay={(session) =>
              run(() => {
                const recipe = recipeFromSession(session);
                void playSequence(recipe, state.mode).catch(() => {});
              })
            }
          />
          <section className="proof-panel">
            <div className="proof-heading">
              <div>
                <span className="eyebrow">FROM FAILURE TO PROOF</span>
                <h2>Same sequence. A different outcome.</h2>
              </div>
              <div className="proof-actions">
                <Button
                  variant="outline"
                  disabled={playing || !!operation}
                  onClick={() => run(compare)}
                >
                  <Workflow />
                  Compare modes
                </Button>
                <Button
                  variant="outline"
                  disabled={playing || !!operation}
                  onClick={() => run(minimize)}
                >
                  <Minimize2 />
                  Reduce failure
                </Button>
              </div>
            </div>
            <p className="proof-caption">
              Uses your latest witnessed failure, or the included six-step
              sample.
            </p>
            {comparison && (
              <div className="comparison-grid" aria-live="polite">
                {[
                  { label: 'Original', snapshot: comparison.baseline },
                  { label: 'With version guard', snapshot: comparison.guarded },
                ].map(({ label, snapshot }) => (
                  <div
                    className={`comparison-card ${snapshot.assertion?.passed ? 'pass' : 'fail'}`}
                    key={label}
                  >
                    <div>
                      <strong>{label}</strong>
                      <span>
                        {snapshot.assertion?.passed
                          ? 'PASS'
                          : snapshot.assertion
                            ? 'FAIL'
                            : 'INCOMPLETE'}
                      </span>
                    </div>
                    <p>
                      <span>Human intent</span>
                      <b>{snapshot.reservation.humanIntent} tickets</b>
                    </p>
                    <p>
                      <span>Final selection</span>
                      <b>{snapshot.reservation.quantity} tickets</b>
                    </p>
                    <small>
                      {snapshot.reservation.phase === 'blocked'
                        ? 'Stale commit rejected · refresh required'
                        : snapshot.reservation.phase === 'committed'
                          ? 'Reservation committed in sandbox'
                          : 'No completed write'}
                    </small>
                  </div>
                ))}
              </div>
            )}
            {reduction && (
              <div className="reduction-result" aria-live="polite">
                <div>
                  <span className="reduction-count">
                    {reduction.originalLength}
                    <ArrowRight size={18} />
                    <b>{reduction.reducedLength}</b>
                  </span>
                  <div>
                    <strong>Commands in the reproduction</strong>
                    <p>
                      {reduction.attempts} candidate checks · failure reproduced
                      after reduction
                    </p>
                  </div>
                </div>
                <div className="recipe-strip">
                  {reduction.recipe.map((command, i) => (
                    <span key={i}>
                      {command.type === 'begin'
                        ? 'Capture selection'
                        : command.type === 'cancel'
                          ? 'Cancel operation'
                          : command.type === 'edit'
                            ? `Human → ${command.quantity} ticket${command.quantity === 1 ? '' : 's'}`
                            : command.type === 'release'
                              ? 'Release write'
                              : 'Observe'}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="export-row">
              <div>
                <FileCode2 size={20} />
                <span>
                  A regression test you can keep.
                  <small>
                    Checks delayed completion and recovery through this adapter.
                  </small>
                </span>
              </div>
              <Button
                variant="outline"
                disabled={playing || !!operation}
                onClick={() =>
                  run(() => {
                    download(
                      recipeName,
                      exportAsyncRegression(chooseFailureRecipe()),
                      'text/javascript',
                    );
                    setNotice(
                      'Async test exported. Save under tests/ and run with Node 22.13+. The guarded implementation must preserve the selection and complete recovery; INTERLEAVE_IMPLEMENTATION=unguarded makes the same test fail.',
                    );
                  })
                }
              >
                <Download />
                Export regression
              </Button>
            </div>
            {notice && (
              <p className="export-notice" aria-live="polite">
                {notice}
              </p>
            )}
          </section>
          <footer className="workbench-footer">
            <span>
              <span className="status-dot" />
              Sessions saved in this browser · no recording uploads.
            </span>
            <span>
              Real mutations. Explicit checkpoints. Observable outcomes.
            </span>
          </footer>
        </section>
      </div>
    </main>
  );
}
