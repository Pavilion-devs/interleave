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
  ReservationLab,
  SAMPLE_RECIPE,
  assertMode,
  assertQuantity,
  replayRecipe,
  reduceFailure,
  exportRegression,
  type Command,
  type Mode,
} from '@/lib/lab-engine';
import { objectInput, registerSiteTools, type SiteTool } from '@/lib/webmcp';

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

export default function Home() {
  const [lab] = useState(() => new ReservationLab());
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
  const generation = useRef(0);
  const selectedRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  const actionsRef = useRef<Record<string, (input: unknown) => unknown>>({});
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
        }
      }),
    [lab],
  );
  const chooseRecipe = () =>
    structuredClone(
      savedRecipe.current.length ? savedRecipe.current : SAMPLE_RECIPE,
    );
  const checkBusy = () => {
    if (busyRef.current)
      throw new Error('A replay is in progress. Wait for it to finish.');
  };
  const reset = (mode: Mode = lab.getSnapshot().mode) => {
    generation.current++;
    busyRef.current = false;
    setPlaying(false);
    lab.reset(mode);
    setSelected(null);
    selectedRef.current = null;
    setError('');
    setNotice('');
    setComparison(null);
    setReduction(null);
  };
  const playSequence = async (recipe: Command[], mode: Mode) => {
    checkBusy();
    reset(mode);
    const token = generation.current;
    busyRef.current = true;
    setPlaying(true);
    try {
      for (const command of recipe) {
        await new Promise((resolve) =>
          setTimeout(resolve, command.type === 'observe' ? 230 : 650),
        );
        if (token !== generation.current) return;
        lab.execute(command, 'replay');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Replay failed.');
    } finally {
      if (token === generation.current) {
        busyRef.current = false;
        setPlaying(false);
      }
    }
  };
  const compare = () => {
    const recipe = chooseRecipe();
    const result = {
      baseline: replayRecipe(recipe, 'unguarded'),
      guarded: replayRecipe(recipe, 'guarded'),
      steps: recipe.length,
    };
    setComparison(result);
    return result;
  };
  const minimize = () => {
    const result = reduceFailure(chooseRecipe());
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
      source: 'disposable_browser_fixture',
    };
  };
  const recipeName = 'interleave-regression.test.mjs';
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
        lab.release('native');
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
      lab_replay(input) {
        const args = objectInput(input, ['mode']);
        assertMode(args.mode);
        checkBusy();
        const recipe = chooseRecipe();
        reset(args.mode);
        for (const command of recipe) lab.execute(command, 'replay');
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
        return {
          filename: recipeName,
          content: exportRegression(chooseRecipe()),
          instructions:
            "Save this file under the project's tests/ directory and run node --test tests/interleave-regression.test.mjs. Requires Node 22.13+ and the project's lab-engine.ts.",
        };
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
        schema({ mode: modes }, ['mode']),
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
    ];
    const tools: SiteTool[] = definitions.map(
      ([name, description, inputSchema, readOnlyHint]) => ({
        name,
        description,
        inputSchema,
        annotations: { readOnlyHint },
        execute(input) {
          let result: unknown;
          flushSync(() => {
            result = actionsRef.current[name](input);
          });
          return result;
        },
      }),
    );
    return registerSiteTools(tools, (status, count, registrationError) =>
      setNative({ status, count, error: registrationError }),
    );
  }, []);
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
        <Link className="brand" href="/" aria-label="Interleave home">
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
          EXPERIMENTAL <span>v0.1</span>
        </span>
      </header>
      <div className="workspace">
        <aside className="sidebar">
          <div className="sidebar-heading">WORKBENCH</div>
          <div className="nav-active">
            <FlaskConical size={17} />
            Experiments<span>01</span>
          </div>
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
                disabled={playing || !hasRecording}
                onClick={() => void playSequence(chooseRecipe(), state.mode)}
              >
                <RotateCcw />
                Replay recording
              </Button>
              <Button
                className="sample-button"
                disabled={playing}
                onClick={() =>
                  void playSequence(structuredClone(SAMPLE_RECIPE), state.mode)
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
                            run(() => lab.edit(reservation.quantity - 1))
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
                            run(() => lab.edit(reservation.quantity + 1))
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
                    ? 'Change the human’s choice.'
                    : reservation.phase === 'blocked'
                      ? 'Read again. Finish safely.'
                      : 'Hold the agent’s write.'}
                </h3>
                <p>
                  {reservation.pending
                    ? 'Use the − or + control in the ticket app. Then release the captured write.'
                    : reservation.phase === 'blocked'
                      ? 'The old write was refused. Capture the current selection and release it to complete the reservation.'
                      : 'Capture the selection, change the ticket count, then release the old write.'}
                </p>
                <Button
                  className="primary-action"
                  disabled={playing || !!reservation.pending}
                  onClick={() => run(() => lab.begin())}
                >
                  <Bot />
                  {reservation.phase === 'blocked'
                    ? 'Capture fresh selection'
                    : 'Capture selection'}
                  <ArrowRight />
                </Button>
                <div
                  className={`checkpoint ${reservation.pending ? 'checkpoint-active' : ''}`}
                >
                  <span className="checkpoint-line" />
                  <span>
                    <Pause size={13} />
                    {reservation.pending
                      ? `Holding revision ${reservation.pending.revision}`
                      : 'Before commit'}
                  </span>
                  <span className="checkpoint-line" />
                </div>
                <Button
                  variant="outline"
                  className="release-button"
                  disabled={playing || !reservation.pending}
                  onClick={() => run(() => lab.release())}
                >
                  <Play />
                  Release pending write
                </Button>
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
          <section className="proof-panel">
            <div className="proof-heading">
              <div>
                <span className="eyebrow">FROM FAILURE TO PROOF</span>
                <h2>Same sequence. A different outcome.</h2>
              </div>
              <div className="proof-actions">
                <Button
                  variant="outline"
                  disabled={playing}
                  onClick={() => run(compare)}
                >
                  <Workflow />
                  Compare modes
                </Button>
                <Button
                  variant="outline"
                  disabled={playing}
                  onClick={() => run(minimize)}
                >
                  <Minimize2 />
                  Reduce failure
                </Button>
              </div>
            </div>
            <p className="proof-caption">
              Uses your last completed recording, or the included six-step
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
                    Runs against this project’s actual fixture engine.
                  </small>
                </span>
              </div>
              <Button
                variant="outline"
                disabled={playing}
                onClick={() =>
                  run(() => {
                    download(
                      recipeName,
                      exportRegression(chooseRecipe()),
                      'text/javascript',
                    );
                    setNotice(
                      'Test exported. Save under tests/ in this project, then run it with Node 22.13 or later.',
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
              All fixture state stays in this tab.
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
